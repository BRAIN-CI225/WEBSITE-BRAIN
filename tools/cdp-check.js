#!/usr/bin/env node
/* BRAIN — Vérification navigateur réelle via CDP (Chrome headless).
   Usage : node tools/cdp-check.js <url> [attente_ms]
   Signal : erreurs console, exceptions, images cassées (naturalWidth=0),
            échantillon du DOM (titres, cartes, images). */
'use strict';

const RUN_MS = parseInt(process.argv[3] || '10000', 10);
const TARGET = process.argv[2];
if (!TARGET) { console.error('Usage : node tools/cdp-check.js <url> [attente_ms]'); process.exit(2); }

const CDP = 'http://127.0.0.1:9222';
let nextId = 1;
const pending = new Map();
const issues = [];
const consoleLog = [];

async function main() {
  const tab = await (await fetch(CDP + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails || {};
      issues.push('EXCEPTION: ' + (d.text || '') + ' ' + ((d.exception && d.exception.description) || '').split('\n')[0]);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const args = (msg.params.args || []).map(a => a.value != null ? a.value : (a.description || a.type)).join(' ');
      issues.push('CONSOLE ERROR: ' + args);
    }
  };

  function send(method, params) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((res) => pending.set(id, res));
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: TARGET });

  await new Promise((res) => setTimeout(res, RUN_MS));

  await send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, document.body.scrollHeight); document.documentElement.scrollTop = document.documentElement.scrollHeight; "scrolled"'
  });
  await new Promise((res) => setTimeout(res, 2500));

  const js = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      titleOk: document.title.indexOf('â€') === -1 && document.title.indexOf('Ã') === -1 && document.title.trim().length > 5,
      title: document.title,
      hasBase: !!document.getElementById('root-base'),
      cards: document.querySelectorAll('.article-card').length,
      detail: !!document.querySelector('.article-detail'),
      featured: !!document.querySelector('.article-featured'),
      covers: document.querySelectorAll('img.article-detail-cover').length,
      proseImgs: document.querySelectorAll('.article-prose img').length,
      brokenImgs: Array.from(document.images).filter(function(i){ return !i.complete || i.naturalWidth === 0; }).map(function(i){ return i.src; }),
      imgTotal: document.images.length
    })`,
    returnByValue: true
  });

  const dom = JSON.parse(js.result.result.value);
  console.log(JSON.stringify({ page: TARGET, dom, issues }, null, 2));

  ws.close();
  try { await fetch(CDP + '/json/close/' + tab.id); } catch (e) {}
  process.exit(issues.length ? 1 : 0);
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });