#!/usr/bin/env node
/* =========================================================
   BRAIN — Audit SEO automatique
   Script Node (aucune dépendance) conforme à la mission SEO.
   Usage :  node tools/seo-audit.js
           node tools/seo-audit.js --json   (rapport brut JSON)
   Retour : code 0 = aucun problème bloquant, 1 = problèmes.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXAMINED_FILES = [
  'index.html',
  'services.html',
  'service-branding.html',
  'service-web.html',
  'service-social.html',
  'service-design.html',
  'service-films.html',
  'service-live.html',
  'service-digital.html',
  'portfolio.html',
  'a-propos.html',
  'contact.html',
  'produits.html',
  'blog.html',
  '404.html'
];

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo.config.json'), 'utf8'));
} catch (e) {
  console.error('[seo-audit] Impossible de lire seo.config.json :', e.message);
}

const ISSUES = [];
const INFO = [];

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch (e) {
    ISSUES.push({ file, severity: 'error', type: 'lecture', message: 'Fichier illisible : ' + e.message });
    return null;
  }
}

function getMeta(html, name) {
  let re = new RegExp('<meta\\s+name=["\']' + name + '["\']\\s+content="([^"]*)"', 'i');
  let m = html.match(re);
  if (!m) re = new RegExp('<meta\\s+name=["\']' + name + '["\']\\s+content=\'([^\']*)\'', 'i');
  m = m || html.match(re);
  return m ? m[1] : null;
}

function getProp(html, prop) {
  let re = new RegExp('<meta\\s+property=["\']' + prop + '["\']\\s+content="([^"]*)"', 'i');
  let m = html.match(re);
  if (!m) re = new RegExp('<meta\\s+property=["\']' + prop + '["\']\\s+content=\'([^\']*)\'', 'i');
  m = m || html.match(re);
  return m ? m[1] : null;
}

function count(html, tag, attrs) {
  const re = new RegExp('<h1\\b([^>]*)>', 'gi');
  const ms = html.match(re) || [];
  return ms.length;
}

function localLinkExists(href, fromFile) {
  if (!href) return false;
  if (/^(https?:|mailto:|tel:|#|data:|javascript:|wa\.me)/i.test(href)) return true;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return true;
  const base = fromFile ? path.dirname(path.join(ROOT, fromFile)) : ROOT;
  const p = path.resolve(base, clean);
  try {
    return fs.statSync(p).isFile();
  } catch (e) {
    return false;
  }
}

function auditPage(file) {
  const html = read(file);
  if (html === null) return {};

  const inArticles = file.startsWith('articles/');
  const base = inArticles ? '../' : '';
  const canonical = (html.match(/<link\s+rel="canonical"\s+href="([^"]+)">/i) || [])[1];
  const hreflang = (html.match(/hreflang=["']([^"']+)["']/g) || []);
  const ldScripts = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  const links = html.match(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/g) || [];

  const infos = {};
  infos.file = file;
  infos.title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  infos.description = getMeta(html, 'description');
  infos.keywords = getMeta(html, 'keywords');
  infos.robots = getMeta(html, 'robots');
  infos.canonical = canonical;
  infos.hreflang = hreflang;
  infos.h1count = count(html);
  infos.publishedJsonLd = ldScripts.length;
  infos.noIndex = (infos.robots || '').includes('noindex') || /<meta\s+name="robots"[^>]*noindex/i.test(html);
  infos.altMissing = [];
  imgs.forEach((img) => {
    if (!/\salt=["']/.test(img)) {
      const src = (img.match(/src=["']([^"']+)["']/) || [])[1];
      infos.altMissing.push(src || '(sans src)');
    }
  });
  infos.brokenLinks = [];
  links.forEach((a) => {
    const href = (a.match(/href=["']([^"']+)["']/) || [])[1];
    if (href && !localLinkExists(href, file)) infos.brokenLinks.push(href);
  });

  /* Titles */
  if (!infos.title) ISSUES.push({ file, severity: 'error', type: 'title', message: 'Balise <title> manquante.' });
  else if (infos.title.length > 65) ISSUES.push({ file, severity: 'warn', type: 'title', message: 'Title trop long (' + infos.title.length + ' caractères) : « ' + infos.title + ' »' });
  else if (infos.title.length < 20) INFO.push({ file, message: 'Title court (' + infos.title.length + ').' });
  if (38 <= infos.title.length && infos.title.length <= 60) INFO.push({ file, message: 'Title dans la zone idéale (' + infos.title.length + ').' });

  if (!infos.description) ISSUES.push({ file, severity: 'error', type: 'description', message: 'Meta description manquante.' });
  else if (infos.description.length > 165) ISSUES.push({ file, severity: 'warn', type: 'description', message: 'Meta description longue (' + infos.description.length + ').' });
  else if (infos.description.length < 70) ISSUES.push({ file, severity: 'warn', type: 'description', message: 'Meta description courte (' + infos.description.length + ').' });

  if (infos.h1count === 0) ISSUES.push({ file, severity: 'error', type: 'h1', message: 'Aucun H1.' });
  else if (infos.h1count > 1) ISSUES.push({ file, severity: 'error', type: 'h1', message: infos.h1count + ' balises H1.' });

  if (!infos.canonical && !infos.noIndex) ISSUES.push({ file, severity: 'error', type: 'canonical', message: 'Canonical manquant.' });
  else if (infos.canonical && !infos.canonical.includes('braincobusiness.com')) ISSUES.push({ file, severity: 'error', type: 'canonical', message: 'Canonical hors domaine : ' + infos.canonical });
  else if (!infos.canonical) INFO.push({ file, message: 'Canonical absent (page noindex).' });

  if (!/hreflang=["']fr["']/.test(html) && !infos.noIndex) ISSUES.push({ file, severity: 'warn', type: 'hreflang', message: 'hreflang fr manquant.' });
  if (!/hreflang=["']x-default["']/.test(html) && !infos.noIndex) ISSUES.push({ file, severity: 'warn', type: 'hreflang', message: 'hreflang x-default manquant.' });

  if (!infos.noIndex) {
    const ogRequired = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
    ogRequired.forEach((p) => {
      if (!getProp(html, p)) ISSUES.push({ file, severity: 'warn', type: 'opengraph', message: p + ' manquant.' });
    });
    ['twitter:card', 'twitter:title', 'twitter:description'].forEach((p) => {
      if (!getProp(html, p) && !getMeta(html, p)) ISSUES.push({ file, severity: 'warn', type: 'twitter', message: p + ' manquant.' });
    });

    if (ldScripts.length === 0) ISSUES.push({ file, severity: 'warn', type: 'jsonld', message: 'Aucun JSON-LD.' });
  }
  ldScripts.forEach((s, i) => {
    const raw = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed['@type']) && parsed['@type'].length === 0) {
        ISSUES.push({ file, severity: 'warn', type: 'jsonld', message: 'JSON-LD #' + (i + 1) + ' @type vide.' });
      }
    } catch (e) {
      ISSUES.push({ file, severity: 'error', type: 'jsonld', message: 'JSON-LD #' + (i + 1) + ' invalide : ' + e.message });
    }
  });

  if (infos.altMissing.length) ISSUES.push({ file, severity: 'warn', type: 'alt', message: infos.altMissing.length + ' image(s) sans alt : ' + infos.altMissing.slice(0, 5).join(', ') + (infos.altMissing.length > 5 ? '…' : '') });

  if (infos.brokenLinks.length) ISSUES.push({ file, severity: 'error', type: 'lien', message: infos.brokenLinks.length + ' lien(s) cassé(s) : ' + infos.brokenLinks.slice(0, 8).join(', ') });

  if (file === '404.html' && !(infos.robots || '').includes('noindex')) ISSUES.push({ file, severity: 'warn', type: 'robots', message: '404.html devrait être noindex.' });
  if (infos.robots && /noindex/.test(infos.robots)) INFO.push({ file, message: 'Page noindex (robots : ' + infos.robots + ').' });

  return infos;
}

function auditCrossPage(results) {
  const seenTitles = {};
  const seenDescs = {};
  results.forEach((r) => {
    if (!r.title) return;
    if (seenTitles[r.title]) ISSUES.push({ file: r.file, severity: 'warn', type: 'duplique', message: 'Title dupliqué avec ' + seenTitles[r.title] });
    else seenTitles[r.title] = r.file;
    if (!r.description) return;
    if (seenDescs[r.description]) ISSUES.push({ file: r.file, severity: 'warn', type: 'duplique', message: 'Meta description dupliquée avec ' + seenDescs[r.description] });
    else seenDescs[r.description] = r.file;
  });
}

function main() {
  const jsonOnly = process.argv.includes('--json');
  const results = EXAMINED_FILES.map(auditPage).filter(Boolean);

  const canonicalDomains = new Set();
  results.forEach((r) => {
    if (r.canonical) {
      const url = new URL(r.canonical).hostname;
      canonicalDomains.add(url);
    }
  });

  auditCrossPage(results);

  if (jsonOnly) {
    console.log(JSON.stringify({ issues: ISSUES, info: INFO, pages: results.map((r) => ({ file: r.file, title: r.title })) }, null, 2));
    process.exit(ISSUES.some((i) => i.severity === 'error') ? 1 : 0);
  }

  console.log('=========================================================');
  console.log(' BRAIN — RAPPORT D\'AUDIT SEO (node tools/seo-audit.js)');
  console.log('=========================================================');
  console.log('Domaine cible      : ' + (config.site ? config.site.siteUrl : 'seo.config.json introuvable'));
  console.log('Hôtes canoniques   : ' + Array.from(canonicalDomains).join(', '));
  console.log('Pages analysées    : ' + results.length);
  console.log('');
  console.log('--- PAGES ANALYSÉES ---');
  results.forEach((r) => {
    const len = r.title ? r.title.length : 0;
    console.log('  ' + r.file.padEnd(65) + ' title:' + len + '  H1:' + r.h1count + '  JSON-LD:' + r.publishedJsonLd + '  imgs sans alt:' + r.altMissing.length);
  });

  console.log('');
  console.log('--- PROBLÈMES (' + ISSUES.length + ') ---');
  if (!ISSUES.length) console.log('  Aucun problème détecté.');
  ISSUES.forEach((i) => console.log('  [' + i.severity.toUpperCase() + '] ' + i.type + ' — ' + i.file + ' : ' + i.message));

  console.log('');
  console.log('--- INFORMATIONS —------------');
  if (!INFO.length) console.log('  —');
  INFO.forEach((i) => console.log('  • ' + i.file + ' : ' + i.message));

  console.log('');
  const errors = ISSUES.filter((i) => i.severity === 'error').length;
  const warns = ISSUES.filter((i) => i.severity === 'warn').length;
  console.log('Résultat : ' + errors + ' erreur(s), ' + warns + ' avertissement(s).');
  console.log('=========================================================');
  process.exit(errors ? 1 : 0);
}

main();