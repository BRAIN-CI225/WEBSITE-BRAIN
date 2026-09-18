#!/usr/bin/env node
/* =========================================================
   BRAIN — Générateur du seed SQL blog_posts (aucune dépendance)
   Lit les fichiers statiques articles/*.html (contenu authentique)
   et produit une migration Supabase :
     1) UPDATE des 2 articles déjà seedés : image/og_image/canonical
        alignés sur les nouveaux visuels ASSET/BLOG (cohérence og:image)
     2) INSERT des 5 nouveaux articles (contenu du site, rien d'inventé)
   Usage : node tools/generer-seed-blog.js
   Sortie : supabase/migrations/2026-09-18-seed-blog-5-articles.sql
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLE_DIR = path.join(ROOT, 'articles');
const OUT = path.join(ROOT, 'supabase', 'migrations', '2026-09-18-seed-blog-5-articles.sql');
const SITE = 'https://www.braincobusiness.com';

const ALREADY_SEEDED = [
  'combien-coute-la-creation-d-un-site-web-en-cote-divoire',
  'comment-digitaliser-une-pme-en-cote-divoire'
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function escSql(str) {
  return String(str == null ? '' : str).replace(/'/g, "''");
}

function attr(html, name) {
  const re = new RegExp(name + '="([^"]*)"');
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, '&') : '';
}

function parseArticle(file) {
  const html = read('articles/' + file);
  const slug = file.replace(/\.html$/i, '');
  const title = attr(html, '<meta property="og:title" content') || '';
  const description = attr(html, '<meta property="og:description" content') || '';
  const excerpt = attr(html, '<meta name="description" content') || description;
  const ogImage = attr(html, '<meta property="og:image" content') || '';
  const image = ogImage.replace(SITE + '/', '');
  const category = attr(html, '<meta property="article:section" content') || '';
  const keywords = attr(html, '<meta name="keywords" content') || '';
  const publishedAt = attr(html, '<meta property="article:published_time" content') || '';

  const coverStart = html.indexOf('<img class="article-detail-cover"');
  const coverEnd = coverStart === -1 ? -1 : html.indexOf('>', coverStart) + 1;
  const backLink = '<a href="../blog.html" class="article-back"';
  const contentEnd = html.indexOf(backLink);
  let content = '';
  if (coverEnd !== -1 && contentEnd !== -1) {
    content = html.substring(coverEnd, contentEnd).trim();
  }

  const tags = keywords.split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');

  return {
    slug, title, description, excerpt, image, category, tags,
    publishedAt, content
  };
}

function quote(str) {
  return "'" + escSql(str) + "'";
}

function buildInsert(rows) {
  const head = [
    'insert into public.blog_posts',
    '  (title, slug, excerpt, content, image, category, author, tags, published_at,',
    '   is_featured, is_visible, status, seo_title, seo_description, og_image, canonical_url, indexing)',
    'values'
  ];
  const parts = rows.map((r) => {
    return [
      '(',
      '  ' + quote(r.title) + ',',
      '  ' + quote(r.slug) + ',',
      '  ' + quote(r.excerpt) + ',',
      '  $PROSE$',
      r.content,
      '$PROSE$,',
      '  ' + quote(r.image) + ',',
      '  ' + quote(r.category) + ',',
      "  'BRAIN',",
      '  ' + quote(r.tags) + ',',
      '  ' + quote(r.publishedAt) + ',',
      '  false,',
      '  true,',
      "  'published',",
      '  ' + quote(r.title) + ',',
      '  ' + quote(r.description) + ',',
      '  ' + quote(r.image) + ',',
      '  ' + quote(SITE + '/blog/' + r.slug) + ',',
      "  'index'",
      ')'
    ].join('\n');
  });
  return head.join('\n') + '\n' + parts.join(',\n') + '\n' + 'on conflict (slug) do nothing;\n';
}

function buildUpdates(already) {
  return already.map((slug) => {
    const p = parseArticle(slug + '.html');
    return (
      'update public.blog_posts\n' +
      'set image = ' + quote(p.image) + ',\n' +
      '    og_image = ' + quote(p.image) + ',\n' +
      '    canonical_url = ' + quote(SITE + '/blog/' + slug) + ',\n' +
      '    updated_at = now()\n' +
      "where slug = " + quote(slug) + ';\n'
    );
  }).join('\n');
}

function main() {
  const files = fs.readdirSync(ARTICLE_DIR).filter((f) => /\.html$/i.test(f));
  const newRows = [];
  const updates = [];

  files.forEach((f) => {
    const slug = f.replace(/\.html$/i, '');
    const p = parseArticle(f);
    if (!p.content) {
      console.error('[seed] Contenu introuvable pour ' + f + ' — abandon.');
      process.exit(1);
    }
    if (ALREADY_SEEDED.includes(slug)) updates.push(slug);
    else newRows.push(p);
  });

  const contentOk = newRows.concat(
    updates.map((s) => parseArticle(s + '.html'))
  ).every((p) => p.title && p.excerpt && p.image && p.category && p.publishedAt);

  if (!contentOk) {
    console.error('[seed] Métadonnées incomplètes sur un article — abandon.');
    process.exit(1);
  }

  const sql = [
    '-- ============================================================',
    '-- BRAIN CMS — SEED COMPLET DU BLOG (idempotent)',
    '-- Généré le ' + new Date().toISOString().slice(0, 10) + ' depuis articles/*.html',
    '-- Contenu : reproduction fidèle des articles du site (aucun contenu inventé).',
    '--  • UPDATE : images + canonical des articles déjà seedés (cohérence ASSET/BLOG)',
    '--  • INSERT : les 5 nouveaux articles, on conflict (slug) do nothing',
    '-- À exécuter dans le SQL Editor du dashboard Supabase.',
    '-- ============================================================',
    '',
    buildUpdates(updates),
    '',
    buildInsert(newRows),
    '',
    "notify pgrst, 'reload schema';",
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, sql, 'utf8');
  console.log('[seed] Écrit   : ' + OUT);
  console.log('[seed] UPDATE  : ' + updates.length + ' article(s) déjà seedé(s) aligné(s) sur ASSET/BLOG');
  console.log('[seed] INSERT  : ' + newRows.length + ' nouvel(aux) article(s) (' + newRows.map((r) => r.slug).join(', ') + ')');
}

main();