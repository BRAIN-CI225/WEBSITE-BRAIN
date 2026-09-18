#!/usr/bin/env node
/* =========================================================
   BRAIN — Test de secours du blog (fallback local, aucun navigateur)
   Vérifie que js/page-blog.js affiche la liste et le détail des
   articles depuis js/data-blog.js lorsque Supabase est absent.
   Usage : node tools/test-blog-fallback.js list|article
   Retour : code 0 = OK, 1 = échec.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const scenario = process.argv[2] || 'list';

function makeEl(tag, id) {
  return {
    tagName: String(tag).toUpperCase(),
    id: id || '',
    className: '',
    style: {},
    innerHTML: '',
    textContent: '',
    classList: {
      add: function () { }, remove: function () { }, contains: function () { return false; }
    },
    addEventListener: function () { }, removeEventListener: function () { },
    setAttribute: function () { }, getAttribute: function () { return ''; },
    appendChild: function () { }, insertBefore: function () { },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }
  };
}

const window = {};
global.window = window;
global.location = {
  pathname: scenario === 'article' ? '/blog/referencement-local-abidjan' : '/blog.html',
  search: ''
};
global.document = {
  readyState: 'complete',
  addEventListener: function () { },
  createElement: function (t) { return makeEl(t); },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  head: makeEl('head'),
  body: makeEl('body')
};

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', 'data-blog.js'), 'utf8'), { filename: 'data-blog.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', 'page-blog.js'), 'utf8'), { filename: 'page-blog.js' });

const fallback = window.BRAIN_BLOG_FALLBACK || [];
if (!Array.isArray(fallback) || !fallback.length) {
  console.error('ÉCHEC : window.BRAIN_BLOG_FALLBACK vide ou absent.');
  process.exit(1);
}

const grid = makeEl('div', 'blog-grid');
const detailRoot = makeEl('div', 'blog-detail-root');
const search = makeEl('input', 'blog-search');
const els = {};
document.getElementById = function (id) {
  if (id === 'blog-grid') return grid;
  if (id === 'blog-detail-root') return detailRoot;
  if (id === 'blog-search') return search;
  if (id === 'seo-dynamic' || id === 'toast-hint') return null;
  if (id === 'blog-pagination') {
    const nav = makeEl('nav', 'blog-pagination');
    nav.querySelectorAll = function () { return [makeEl('button'), makeEl('button')]; };
    return nav;
  }
  if (!els[id]) els[id] = makeEl('div', id);
  return els[id];
};

function waitFor(check, label, done, ms) {
  const t0 = Date.now();
  const iv = setInterval(function () {
    const lines = check();
    if (lines) { clearInterval(iv); console.log('OK   ' + label); console.log(lines.join('\n')); done(); }
    else if (Date.now() - t0 > ms) { clearInterval(iv); console.error('ÉCHEC ' + label + ' (timeout)'); process.exit(1); }
  }, 250);
}

if (scenario === 'article') {
  waitFor(function () {
    if (detailRoot.innerHTML.indexOf('article-detail') === -1) return null;
    const imgs = (detailRoot.innerHTML.match(/<img\b/g) || []).length;
    const srcs = (detailRoot.innerHTML.match(/src="[^"]*BLOG[^"]*"/g) || []).slice(0, 8);
    const lines = [];
    lines.push('  - détail rendu : OUI');
    lines.push('  - titre présent : ' + (detailRoot.innerHTML.indexOf('Référencement local à Abidjan') !== -1));
    lines.push('  - contenu <article-prose> : ' + (detailRoot.innerHTML.indexOf('article-prose') !== -1));
    lines.push('  - partage présent : ' + (detailRoot.innerHTML.indexOf('article-share') !== -1));
    lines.push('  - balises <img> : ' + imgs);
    lines.push('  - sources BLOG : ' + srcs.length + (srcs.length ? ' -> ' + srcs.join(', ') : ''));
    return lines;
  }, 'article /blog/referencement-local-abidjan', function () { process.exit(0); }, 15000);
} else {
  waitFor(function () {
    if (grid.innerHTML.indexOf('article-card') === -1) return null;
    const cards = (grid.innerHTML.match(/<article class="article-card/g) || []).length;
    const lines = [];
    lines.push('  - cartes sur la grille : ' + cards + ' (attendu min 6)');
    lines.push('  - 1ère carte SEO local : ' + (grid.innerHTML.indexOf('referencement-local-abidjan') !== -1));
    lines.push('  - image ASSET/BLOG : ' + (grid.innerHTML.indexOf('/ASSET/BLOG/') !== -1));
    lines.push('  - fallback chargé : ' + fallback.length + ' articles');
    return lines;
  }, 'liste /blog.html', function () { process.exit(0); }, 15000);
}