#!/usr/bin/env node
/* BRAIN - Portfolio : generation de la source de donnees video Wistia.
   Source  : URL de partage Wistia (/s/) resolues via l'oEmbed officiel
             (https://fast.wistia.net/oembed?url=...) -> media id, titre,
             miniature, duree. L'ordre de la playlist est celui de la liste
             source (deduplication faite en amont).
   Sortie  : js/wistia-videos.js (window.BRAIN_WISTIA_VIDEOS)
   Usage   : node tools/build-wistia.js
   Le dossier est public si l'oEmbed repond 200 => l'embed iframe est utilisable. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'wistia-videos.js');

const ORDER = [
  'nbjb32bnbeki3y2', 'bmsbdsmxwureevz', 'l6uh5p3sxdkuhfq', 'vd68wp9mfxojhmx',
  'pcvz5ip2liyv8oz', '1iw8dnr0hs3a0s3', '2krzfn4zomb5l6h', 'h675ew1ocom5h1h',
  'jt36qqetfzudsv1', '90u365cfmagp8as', 'nnkvsq63xse44bq', 'gzgq6zbqi6l4wf3',
  'y15e6uqpf4heysb', '4njsx4b7ybclpgp', 'bil2ic59i75few5', 'jw0nmw81ltpsbql',
  '62kp6j9jt0kd7ol', 'axku20na2cdalna', 'qpvks5db0pl6pcw', 'pzivhwxe3jjgt9l',
  '0zecq5uee3ll471', '36evjcrf5xfk50u', 'raxa0dytf2hf9m6', 'gxzj3f1pg54kbeq',
  'xi4f03bv533f43w', 'qgdibxjypkyo3ae', '0b4a3t2seafz71d', 'gjvghijmips1lgp',
  '21uraecskf9j9pn', 'y61sjfz9bhnxyqz', 'q80x7hs2i6jl6rt', 'k73zf7rq8vqskjb',
  'enkmljpnq4w7ql3', 't79p6oqo7kjjdmn', 'owolwmri6wutyll', '0fjwky1pntcizgf',
  'jcktmu00sfbsi7e', '0kufzd6tdvjbu0q'
];

function asciiSafeJson(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/[\u007F-\uFFFF]/g, (ch) => '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4));
}

async function resolve(share) {
  const url = 'https://cocomultimedia2016.wistia.com/s/' + share;
  const base = 'https://fast.wistia.net/oembed?url=' + encodeURIComponent(url);
  const r = await fetch(base, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return { available: false, httpStatus: r.status };
  const j = await r.json();
  const m = (j.html || '').match(/embed\/iframe\/([a-z0-9]+)/i);
  return {
    available: true,
    id: m ? m[1] : '',
    title: j.title || '',
    thumb: j.thumbnail_url || '',
    duration: Math.round(Number(j.duration) || 0),
    width: j.width || 960,
    height: j.height || 540,
    playerColor: j.player_color || ''
  };
}

async function main() {
  const items = [];
  let ok = 0, fail = 0;
  for (const share of ORDER) {
    const meta = await resolve(share);
    const item = {
      index: items.length + 1,
      share,
      available: meta.available,
      httpStatus: meta.httpStatus || null,
      id: meta.id || '',
      title: meta.title || '',
      thumb: meta.thumb || '',
      duration: meta.duration || 0,
      width: meta.width || 0,
      height: meta.height || 0
    };
    if (item.available) ok++; else fail++;
    items.push(item);
    console.log((item.available ? '  + ' : '  ! ') + item.share + '  -> ' + (item.id || 'non disponible (HTTP ' + item.httpStatus + ')'));
  }

  const payload = {
    generatedAt: new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'),
    provider: 'Wistia',
    source: 'https://cocomultimedia2016.wistia.com/',
    count: items.length,
    category: 'Audiovisuel',
    items
  };

  const banner = [
    '/* =========================================================',
    '   BRAIN - Catalogue video Wistia (genere par tools/build-wistia.js)',
    '   Ne pas editer a la main ; relancer le script apres un',
    '   changement dans le compte Wistia pour mettre a jour tout le fichier.',
    '   ========================================================= */'
  ].join('\n') + '\n';

  fs.writeFileSync(OUT, banner + 'window.BRAIN_WISTIA_VIDEOS = ' + asciiSafeJson(payload) + ';\n', 'utf8');
  console.log('OK : ' + ok + ' disponible(s), ' + fail + ' indisponible(s).');
  console.log('Ecrit : ' + OUT);
}

main().catch((e) => { console.error('ERREUR:', e); process.exit(1); });