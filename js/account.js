/* Aion 2 Market — Discord login (Supabase): profile, favourites, server, account deletion. Classic script: shares globals with the others, loaded in order by index.html. */
/* ---------- Discord login (Supabase): favourites + server saved in the user's profile ---------- */
const SB_URL = 'https://xmtenkcpocwwqcpfhkgr.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGVua2Nwb2N3d3FjcGZoa2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NTkxNTcsImV4cCI6MjEwNzUzNTE1N30.OyMn5OjdXWPf38L5qPDGePKOk1eFmsPJY8Dr4cYSnmk';
const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
let USER = null, saveTimer = null, profileReady = false;
const DC = '<svg class="dc" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.7 3a19.5 19.5 0 0 0-4.9 1.5C.7 9.1-.2 13.6.3 18a19.7 19.7 0 0 0 6 3l1.3-2.1a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.6 19.6 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8.1 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm7.8 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z"/></svg>';
function paintAcct() {
  const el = document.getElementById('acct'); el.replaceChildren();
  if (!sb) return;
  if (!USER) {
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = DC + '<span>Accedi con Discord</span>';
    b.addEventListener('click', () => sb.auth.signInWithOAuth({provider: 'discord', options: {redirectTo: location.origin + location.pathname}}));
    el.appendChild(b); return;
  }
  const m = USER.user_metadata || {};
  if (m.avatar_url) { const img = document.createElement('img'); img.src = m.avatar_url; img.alt = ''; el.appendChild(img); }
  const nm = document.createElement('span'); nm.textContent = m.full_name || m.name || m.user_name || 'Account'; el.appendChild(nm);
  const out = document.createElement('button'); out.type = 'button'; out.className = 'out'; out.textContent = 'Esci';
  out.addEventListener('click', () => sb.auth.signOut());
  // delete the account and everything saved with it (GDPR): two clicks, the second within 5 seconds
  const del = document.createElement('button'); del.type = 'button'; del.className = 'out del'; del.textContent = 'Elimina account';
  del.title = 'Elimina il tuo account e i dati salvati (preferiti, server, avvisi)';
  del.addEventListener('click', async () => {
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Sicuro? Clicca di nuovo'; setTimeout(() => { delete del.dataset.armed; del.textContent = 'Elimina account'; }, 5000); return; }
    del.disabled = true;
    const {error} = await sb.rpc('delete_my_account');
    if (error) { del.textContent = 'Errore, riprova'; del.disabled = false; return; }
    FAVS.clear(); ALERTS = []; store.set('aion-favs', '[]'); await sb.auth.signOut(); paintFav(); drawTable();
  });
  el.append(out, del);
}
function saveProfile() {
  if (!sb || !USER || !profileReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => sb.from('profiles').upsert({id: USER.id, server_id: SERVER, favorites: [...FAVS], updated_at: new Date().toISOString()}), 600);
}
async function loadProfile() {
  profileReady = false;
  const m = USER.user_metadata || {};
  const {data, error} = await sb.from('profiles').select('server_id,favorites,alerts').eq('id', USER.id).maybeSingle();
  if (error) { console.warn('profile', error.message); return; }
  if (data) {
    (data.favorites || []).forEach((f) => FAVS.add(f));
    ALERTS = Array.isArray(data.alerts) ? data.alerts : [];          // keep favourites added before logging in
    if (data.server_id && data.server_id !== SERVER && [...srvSel.options].some((o) => +o.value === data.server_id)) {
      SERVER = data.server_id; srvSel.value = String(SERVER); store.set('aion-server', String(SERVER)); await loadServer();
    }
  }
  store.set('aion-favs', JSON.stringify([...FAVS]));
  await sb.from('profiles').upsert({id: USER.id, discord_name: m.full_name || m.name || null, server_id: SERVER, favorites: [...FAVS], updated_at: new Date().toISOString()});
  profileReady = true; paintFav(); drawTable(); drawChart();
}
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    const was = USER?.id; USER = session?.user || null; paintAcct();
// if Discord / Supabase sent the user back with an error, say so instead of silently showing the logged-out page
(() => {
  const q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
  const err = q.get('error_description') || q.get('error');
  if (!err) return;
  const box = document.createElement('div'); box.className = 'loginerr'; box.setAttribute('role', 'alert');
  box.textContent = 'Accesso con Discord non riuscito: ' + err.replace(/\+/g, ' ');
  document.body.prepend(box); setTimeout(() => box.remove(), 15000);
  history.replaceState(null, '', location.pathname);
})();
    if (USER && USER.id !== was) setTimeout(loadProfile, 0);       // after the auth callback returns
    if (!USER) { profileReady = false; ALERTS = []; }
    if (ITEMS.length) drawChart();
  });
}
paintAcct();
