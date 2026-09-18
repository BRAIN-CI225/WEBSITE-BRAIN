#!/usr/bin/env node
/* =========================================================
   BRAIN — Génère js/data-blog.js (données de secours du blog)
   Contenu authentique extrait de articles/*.html : la page blog
   affiche ces articles si Supabase est indisponible ou vide
   (ex. avant application des migrations). Supabase reste la
   source prioritaire quand la requête renvoie des lignes.
   Usage : node tools/generer-data-blog.js
   Sortie : js/data-blog.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLE_DIR = path.join(ROOT, 'articles');
const OUT = path.join(ROOT, 'js', 'data-blog.js');
const SITE = 'https://www.braincobusiness.com';

const FEATURED = ['comment-digitaliser-une-pme-en-cote-divoire'];

function attr(html, name) {
  const re = new RegExp(name + '="([^"]*)"');
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, '&') : '';
}

function parseArticle(file) {
  const html = fs.readFileSync(path.join(ARTICLE_DIR, file), 'utf8');
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
  const contentEnd = html.indexOf('<a href="../blog.html" class="article-back"');
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
    slug,
    title,
    excerpt,
    content,
    image,
    category,
    author: 'BRAIN',
    tags,
    published_at: publishedAt,
    is_featured: FEATURED.includes(slug),
    is_visible: true,
    status: 'published',
    seo_title: description || title,
    seo_description: description,
    og_image: image,
    canonical_url: SITE + '/blog/' + slug,
    indexing: 'index'
  };
}

function main() {
  const files = fs.readdirSync(ARTICLE_DIR).filter((f) => /\.html$/i.test(f));
  const posts = files.map(parseArticle);

  const incomplete = posts.filter(
    (p) => !p.title || !p.excerpt || !p.image || !p.category || !p.published_at || !p.content
  );
  if (incomplete.length) {
    console.error('[data-blog] Métadonnées incomplètes : ' + incomplete.map((p) => p.slug).join(', '));
    process.exit(1);
  }

  const body = posts
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    .map((p) => '  ' + JSON.stringify(p, null, 2).replace(/\n/g, '\n  '))
    .join(',\n');

  const src = [
    '/* =========================================================',
    '   BRAIN — Données de secours du blog (fallback local)',
    '   Contenu authentique des articles du site. Utilisées par',
    '   js/page-blog.js UNIQUEMENT si Supabase est indisponible',
    '   ou sans article publié. N’est pas la source primaire.',
    '   Régénéré par : node tools/generer-data-blog.js',
    '   ========================================================= */',
    'window.BRAIN_BLOG_FALLBACK = [',
    body,
    '];',
    ''
  ].join('\n');

  fs.writeFileSync(OUT, src, 'utf8');
  console.log('[data-blog] Écrit   : ' + OUT);
  console.log('[data-blog] Articles: ' + posts.length + ' (' + posts.map((p) => p.slug).join(', ') + ')');
}

main();