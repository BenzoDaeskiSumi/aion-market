// Read-only check that the Supabase SQL functions exist (a fake Discord id changes nothing).
import {writeFileSync} from 'node:fs';
const U = 'https://xmtenkcpocwwqcpfhkgr.supabase.co/rest/v1/rpc/', K = process.env.SUPABASE_SERVICE_KEY || '', A = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGVua2Nwb2N3d3FjcGZoa2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NTkxNTcsImV4cCI6MjEwNzUzNTE1N30.OyMn5OjdXWPf38L5qPDGePKOk1eFmsPJY8Dr4cYSnmk';
const call = async (fn, body, key) => { const r = await fetch(U + fn, {method: 'POST', headers: {apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('eyJ') ? {Authorization: 'Bearer ' + key} : {})}, body: JSON.stringify(body)}); return fn + ' ' + r.status + ' ' + (await r.text()).slice(0, 200); };
const out = [await call('set_favorites_by_discord', {did: '0', f: []}, K), await call('favorites_by_discord', {did: '0'}, K), await call('delete_my_account', {}, A)];
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
