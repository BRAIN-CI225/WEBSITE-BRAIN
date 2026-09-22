/* ============================================================
   BRAIN — Lib Supabase REST (zéro dépendance)
   Utilisée UNIQUEMENT côté serveur (Netlify Functions).
   Nécessite dans l'environnement Netlify :
     - SUPABASE_URL
     - SUPABASE_SERVICE_KEY (clé service_role, secrète)
   ============================================================ */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function authHeader() {
  return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
}

function apiUrl(table, queryParams) {
  let url = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + encodeURIComponent(table);
  if (queryParams) url += '?' + queryParams;
  return url;
}

async function select(table, queryParams) {
  const res = await fetch(apiUrl(table, queryParams), { headers: authHeader() });
  const data = await res.json();
  if (!res.ok) throw new Error('Supabase select ' + table + ' : ' + (data.message || res.status));
  return data;
}

async function insert(table, rows) {
  const res = await fetch(apiUrl(table), {
    method: 'POST',
    headers: Object.assign(authHeader(), { Prefer: 'return=representation' }),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Supabase insert ' + table + ' : ' + (data.message || res.status));
  return data;
}

async function update(table, matchQuery, values) {
  const res = await fetch(apiUrl(table, matchQuery), {
    method: 'PATCH',
    headers: Object.assign(authHeader(), { Prefer: 'return=representation' }),
    body: JSON.stringify(values)
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Supabase update ' + table + ' : ' + (data.message || res.status));
  return data;
}

module.exports = { SUPABASE_URL, SERVICE_KEY, select, insert, update };