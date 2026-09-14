/* =========================================================
   BRAIN — Supabase
   Initialisation du client Supabase (chargée sur tout le site).
   ⚠️ Utiliser UNIQUEMENT la clé "anon" publique, jamais la
   clé "service_role" (secret) dans le frontend.
   ========================================================= */
(function(){
  const SUPABASE_URL = 'https://bbhiusqpeeblyvrsmszr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaGl1c3FwZWVibHl2cnNtc3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzEwNzUsImV4cCI6MjEwNDk0NzA3NX0.HzSNJ3MBrM74bWrj-dgH-Q1bLxea4cXKlMj-r3-Pz5U';

  window.brainSupabase = window.brainSupabase || {};

  function loadScript(src){
    return new Promise(function(resolve, reject){
      const existing = document.querySelector('script[src="' + src + '"]');
      if(existing){
        resolve();
        return;
      }
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = true;
      tag.onload = resolve;
      tag.onerror = reject;
      document.head.appendChild(tag);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(SUPABASE_ANON_KEY.indexOf('CLE_ANON') !== -1){
      window.brainSupabase.ready = false;
      window.brainSupabase.error = 'Clé anon non configurée : remplacer "CLE_ANON_A_REMPLACER" dans js/supabase.js';
      console.warn('[BRAIN Supabase]', window.brainSupabase.error);
      return;
    }
    loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')
      .then(function(){
        if(!window.supabase){
          throw new Error('Supabase JS introuvable');
        }
        window.brainSupabase.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth:{ persistSession:true, autoRefreshToken:true }
        });
        window.brainSupabase.ready = true;
      })
      .catch(function(error){
        window.brainSupabase.ready = false;
        window.brainSupabase.error = error.message || String(error);
        console.error('[BRAIN Supabase]', window.brainSupabase.error);
      });
  });
})();