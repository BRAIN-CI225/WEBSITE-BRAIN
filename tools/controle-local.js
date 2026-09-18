#!/usr/bin/env node
/* =========================================================
   BRAIN — Contrôle local + prévisualisation (aucune dépendance)
   Usage :
     node tools/controle-local.js              analyse + serveur (port 4173)
     node tools/controle-local.js --check      analyse uniquement (code 0/1)
     node tools/controle-local.js --serve      serveur uniquement
     node tools/controle-local.js --port 8080  changer le port
     node tools/controle-local.js --no-open    ne pas ouvrir le navigateur
     node tools/controle-local.js --json       rapport brut JSON (analyse)
   Serveur : site statique + route SPA /blog/<slug> -> blog.html
   Contrôles :
     1) Images référencées vs fichiers présents (ASSET/BLOG en attente)
     2) Cohérence des slugs : teaser accueil, _redirects, canoniques articles
     3) Conformité directive visuelle (AGENTS.md) dans ASSET/prompts-images-blog.md
   ========================================================= */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTICLE_DIR = path.join(ROOT, 'articles');
const PROMPTS_FILE = path.join(ROOT, 'ASSET', 'prompts-images-blog.md');
const REDIRECTS_FILE = path.join(ROOT, '_redirects');
const TEASER_INDEX = path.join(ROOT, 'index.html');
const BLOG_HTML = path.join(ROOT, 'blog.html');
const PRODUITS_HTML = path.join(ROOT, 'produits.html');

/* URL propres (sans .html) servies comme leurs fichiers statiques, comme Netlify (_redirects) */
const CLEAN_ROUTES = {
  '/contact': 'contact.html',
  '/services': 'services.html',
  '/portfolio': 'portfolio.html',
  '/a-propos': 'a-propos.html'
};

const ISSUES = [];
const INFO = [];

function add(severity, type, file, message) {
  ISSUES.push({ severity, type, file, message });
}

/* ---------- Utilitaires ---------- */
function read(rel) {
  try { return fs.readFileSync(rel, 'utf8'); }
  catch (e) { return null; }
}

function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }

function listArticles() {
  return fs.readdirSync(ARTICLE_DIR).filter((f) => /\.html$/i.test(f));
}

function resolveAsset(relPath, baseDir) {
  try {
    const p = path.resolve(baseDir, relPath);
    return p.startsWith(ROOT + path.sep) ? p : null;
  } catch (e) { return null; }
}

function missingImageCheck() {
  const htmlFiles = ['index.html', 'blog.html']
    .concat(listArticles().map((f) => path.join('articles', f)));
  const seen = new Set();
  const imgs = /(?:src|content)="([^"]+\.(?:jpe?g|png|webp|svg|avif|gif))"/gi;
  htmlFiles.forEach((rel) => {
    const baseDir = rel.startsWith('articles') ? ARTICLE_DIR : ROOT;
    const html = read(path.join(ROOT, rel));
    if (!html) return;
    let m;
    while ((m = imgs.exec(html))) {
      const src = m[1];
      if (/^(https?:|data:|blob:|{)/i.test(src) || src.startsWith('//')) continue;
      const key = rel + ' :: ' + src;
      if (seen.has(key)) continue;
      seen.add(key);
      const filePath = resolveAsset(decodeURIComponent(src), baseDir);
      const isBlogAsset = /[\\/]BLOG[\\/]/i.test(src) || /ASSET[\\/]BLOG/i.test(src);
      if (filePath && !fs.existsSync(filePath)) {
        add(isBlogAsset ? 'warn' : 'error', 'image',
          rel, 'Image manquante : ' + src + (isBlogAsset ? '  → à générer dans ASSET/BLOG/' : ''));
      }
    }
  });
}

function expectedBlogImages() {
  const md = read(PROMPTS_FILE);
  const expected = [];
  if (!md) return expected;
  const re = /ASSET\/BLOG\/([A-Za-z0-9._-]+\.(?:jpe?g|png|webp))/g;
  let m;
  while ((m = re.exec(md))) expected.push(m[1]);
  return uniq(expected);
}

function slugCheck() {
  const teaserHtml = read(TEASER_INDEX) || '';
  const redirects = read(REDIRECTS_FILE) || '';
  const pageBlogJs = read(path.join(ROOT, 'js', 'page-blog.js')) || '';

  const teaserSlugs = uniq(
    Array.from(teaserHtml.matchAll(/blog\.html\?p=([A-Za-z0-9_\-]+)/g), (m) => m[1])
  );
  const blogSlugs = uniq(
    Array.from(redirects.matchAll(/\/blog\/([A-Za-z0-9_\-]+)/g), (m) => m[1])
  );
  const staticSlugs = listArticles().map((f) => f.replace(/\.html$/i, ''));

  const spaRuleOk = /^\s*\/blog\/\*\s+\/blog\.html\s+200\s*$/m.test(redirects);
  const queryRouteOk = /\.get\(['"]p['"]\)/.test(pageBlogJs);
  const pathRouteOk = /parts\[0\]\s*===\s*['"]blog['"]/.test(pageBlogJs);

  teaserSlugs.forEach((s) => {
    if (!blogSlugs.includes(s)) add('error', 'slug', 'index.html',
      'Teaser sans route /blog/' + s + ' dans _redirects.');
    if (!staticSlugs.includes(s)) add('error', 'slug', 'index.html',
      'Teaser sans fichier articles/' + s + '.html.');
  });

  staticSlugs.forEach((s) => {
    const fromStatic = new RegExp('/articles/' + s + '\\.html\\s+\\S*?\\/blog\\/' + s + '(?:\\s|$)', 'm');
    if (fromStatic.test(redirects)) {
      INFO.push({ message: 'articles/' + s + '.html → /blog/' + s + ' (301) : OK.' });
    } else {
      add('error', 'slug', '_redirects',
        'articles/' + s + '.html n\'est pas redirigé (301) vers /blog/' + s + '.');
    }
  });

  let canonicalHtmlSources = 0;
  listArticles().forEach((f) => {
    const html = read(path.join(ARTICLE_DIR, f));
    if (html && /<link\s+rel="canonical"\s+href="[^"]+\/articles\/.+\.html"/i.test(html)) canonicalHtmlSources++;
  });
  if (canonicalHtmlSources) INFO.push({ message: canonicalHtmlSources + ' article(s) statiques gardent un canonical .html (acceptable — viser /blog/<slug> est préférable).' });

  blogSlugs.forEach((s) => {
    if (!staticSlugs.includes(s)) add('warn', 'slug', '_redirects',
      '/blog/' + s + ' annoncé dans _redirects mais aucun fichier articles/' + s + '.html.');
  });

  if (!spaRuleOk) add('error', 'slug', '_redirects', 'Règle SPA "/blog/*  /blog.html  200" absente.');
  if (!queryRouteOk) add('error', 'slug', 'js/page-blog.js', 'Le routage via ?p=<slug> est introuvable.');
  if (!pathRouteOk) add('error', 'slug', 'js/page-blog.js', 'Le routage par chemin /blog/<slug> est introuvable.');

  if (staticSlugs.length) INFO.push({ message: staticSlugs.length + ' article(s) statique(s) dans /articles.' });
  if (blogSlugs.length) INFO.push({ message: blogSlugs.length + ' slug(s) /blog/<slug> dans _redirects.' });
  if (teaserSlugs.length) INFO.push({ message: teaserSlugs.length + ' teaser(s) d\'article sur l\'accueil.' });
}

function directiveCheck() {
  const md = read(PROMPTS_FILE);
  if (!md) { add('error', 'directive', 'ASSET/prompts-images-blog.md', 'Fichier introuvable.'); return; }

  const REQUIRED = [
    'Black African people',
    'dark Black skin',
    'African facial features',
    'contemporary Black African professional',
    'No white people'
  ];
  const CONTEXT = ['Côte d\'Ivoire', 'Abidjan'];

  const blocks = [];
  const lines = md.split(/\r?\n/);
  let currentFile = null;
  let currentArticle = null;
  let inCode = false;
  let buf = [];

  for (const line of lines) {
    const f = line.match(/\*\*Fichier suggéré :\*\*\s*`([^`]+)`/);
    if (f) currentFile = f[1];
    if (/^##\s+(?:Article|Conseil)\s/i.test(line)) currentArticle = line.replace(/^##\s+/, '');
    if (/^\s*```/.test(line)) {
      if (!inCode) { inCode = true; buf = []; }
      else { blocks.push({ article: currentArticle, file: currentFile, text: buf.join('\n') }); inCode = false; }
      continue;
    }
    if (inCode) buf.push(line);
  }

  if (!blocks.length) { add('error', 'directive', PROMPTS_FILE, 'Aucun prompt détecté (délimiteurs ``` introuvables).'); return; }

  let ok = 0;
  blocks.forEach((b, i) => {
    const missing = REQUIRED.filter((tok) => !b.text.includes(tok));
    const hasContext = CONTEXT.some((c) => b.text.includes(c));
    if (!hasContext) missing.push('contexte Côte d\'Ivoire / Abidjan');
    const label = b.file ? ' ' + b.file : (' prompt #' + (i + 1));
    if (missing.length) {
      add('error', 'directive', PROMPTS_FILE,
        (b.article || ('Prompt #' + (i + 1))) + ' — ' + label + ' : mention(s) manquante(s) : ' + missing.join(', '));
    } else ok++;
  });
  INFO.push({ message: ok + '/' + blocks.length + ' prompt(s) conformes à la directive visuelle (AGENTS.md).' });

  const expected = expectedBlogImages();
  if (expected.length) {
    const dir = path.join(ROOT, 'ASSET', 'BLOG');
    const present = expected.filter((f) => fs.existsSync(path.resolve(dir, f)));
    INFO.push({ message: 'Images blog : ' + present.length + '/' + expected.length + ' générées dans ASSET/BLOG/.' });
    expected.forEach((f) => {
      if (!fs.existsSync(path.resolve(dir, f)))
        add('warn', 'image', 'ASSET/prompts-images-blog.md', 'À générer (absent) : ASSET/BLOG/' + f);
    });
  }
}

/* ---------- Rapport ---------- */
function buildReport() {
  missingImageCheck();
  slugCheck();
  directiveCheck();
  return { issues: ISSUES, info: INFO };
}

function printReport(report, jsonOnly) {
  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return report.issues.some((i) => i.severity === 'error') ? 1 : 0;
  }
  const errors = report.issues.filter((i) => i.severity === 'error').length;
  const warns = report.issues.filter((i) => i.severity === 'warn').length;
  console.log('=========================================================');
  console.log(' BRAIN — CONTRÔLE LOCAL (node tools/controle-local.js)');
  console.log('=========================================================');
  console.log('Racine du site : ' + ROOT);
  console.log('');
  console.log('--- PROBLÈMES (' + report.issues.length + ') ---');
  if (!report.issues.length) console.log('  Aucun problème détecté.');
  report.issues.forEach((i) => console.log('  [' + i.severity.toUpperCase() + '] ' + i.type + ' — ' + i.file + ' : ' + i.message));
  console.log('');
  console.log('--- INFORMATIONS ---');
  if (!report.info.length) console.log('  —');
  report.info.forEach((i) => console.log('  • ' + i.message));
  console.log('');
  console.log('Résultat : ' + errors + ' erreur(s), ' + warns + ' avertissement(s).');
  console.log('=========================================================');
  return errors ? 1 : 0;
}

/* ---------- Serveur local ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf'
};

function serveStatic(port, wantOpen) {
  let server;
  try { server = http.createServer(); }
  catch (e) {
    console.error('[serveur] Impossible de créer le serveur : ' + e.message);
    process.exit(1);
  }

  server.on('request', (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (e) { pathname = '/'; }

    if (pathname.includes('\0')) { res.writeHead(400); res.end('Bad Request'); return; }

    let filePath = path.resolve(ROOT, '.' + pathname);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

    if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

    let status = 200;
    let finalPath = filePath;
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      if (/^\/blog\//.test(pathname) || pathname === '/blog') {
        finalPath = BLOG_HTML;
      } else if (/^\/produits\//.test(pathname) || pathname === '/produits') {
        finalPath = PRODUITS_HTML;
      } else if (CLEAN_ROUTES[pathname]) {
        finalPath = path.join(ROOT, CLEAN_ROUTES[pathname]);
      } else {
        finalPath = path.join(ROOT, '404.html');
        status = 404;
      }
    }

    fs.readFile(finalPath, (err, data) => {
      if (err) { res.writeHead(404); res.end('404 - Fichier introuvable'); return; }
      const ext = path.extname(finalPath).toLowerCase();
      res.writeHead(status, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': /^\/ASSET\//i.test(pathname) ? 'public, max-age=3600' : 'no-cache'
      });
      res.end(data);
    });
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error('[serveur] Port ' + port + ' déjà utilisé. Utilisez --port <n> (ex. node tools/controle-local.js --port 8080).');
      process.exit(1);
    }
    throw e;
  });

  server.listen(port, () => {
    const url = 'http://localhost:' + port + '/';
    console.log('');
    console.log('Serveur local démarré : ' + url);
    console.log('  Liste blog           : ' + url + 'blog.html');
    console.log('  Article (démo)       : ' + url + 'blog/referencement-local-abidjan');
    console.log('  Produits             : ' + url + 'produits');
    console.log('  Produit (démo)       : ' + url + 'produits/brain-care');
    console.log('  Quitter : Ctrl+C');
    if (wantOpen && os.platform() === 'win32') {
      try { spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore' }).unref(); }
      catch (e) { /* navigation manuelle */ }
    }
  });
}

/* ---------- Arguments ---------- */
function parseArgs(argv) {
  const a = { check: false, serve: false, json: false, open: true, port: 4173 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') a.check = true;
    else if (argv[i] === '--serve') a.serve = true;
    else if (argv[i] === '--json') a.json = true;
    else if (argv[i] === '--no-open') a.open = false;
    else if (argv[i] === '--help') { a.help = true; }
    else if (argv[i] === '--port') {
      const n = parseInt(argv[i + 1], 10);
      if (n > 0 && n < 65536) a.port = n;
      i++;
    }
  }
  return a;
}

/* ---------- Main ---------- */
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('BRAIN — Contrôle local et prévisualisation');
    console.log('  node tools/controle-local.js              analyse + serveur (port 4173)');
    console.log('  node tools/controle-local.js --check      analyse uniquement');
    console.log('  node tools/controle-local.js --serve      serveur uniquement');
    console.log('  node tools/controle-local.js --port 8080  changer le port');
    console.log('  node tools/controle-local.js --no-open    ne pas ouvrir le navigateur');
    console.log('  node tools/controle-local.js --json       rapport brut JSON');
    return;
  }

  let exitCode = 0;
  if (!args.serve) {
    const report = buildReport();
    exitCode = printReport(report, args.json);
  }
  if (!args.check && !args.json) {
    serveStatic(args.port, args.open);
  }
  process.exitCode = exitCode;
}

main();