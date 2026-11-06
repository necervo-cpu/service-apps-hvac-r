/* shared/sync.js – Sync-Gerüst für die Service-Apps (Google-Apps-Script-Schnittstelle)
   Inhalt: api(action, data) (POST an die Web-App), syncing + syncCanStart(hasPending, silent) + syncEnd()
           (Vorab-Prüfungen für syncAll), netRender(n) (Online-/Ausstehend-Anzeige in #net).
   Benötigt aus der App: globale Variable settings {url, token}; toast, $ aus core.js.
   Laden: vor dem App-Skript, nach core.js. */

async function api(action, data){
  if(!settings.url) throw new Error('Keine Web-App-URL in den Einstellungen.');
  const res = await fetch(settings.url, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},   // "simple request" → kein CORS-Preflight
    body: JSON.stringify(Object.assign({token:settings.token, action}, data || {}))
  });
  let j;
  try{ j = await res.json(); }catch(e){ throw new Error('Unerwartete Antwort – ist die Web-App für „Jeder“ freigegeben?'); }
  if(!j.ok) throw new Error(j.error || 'Unbekannter Fehler');
  return j;
}

let syncing = false;
/* Vorab-Prüfungen für syncAll; bei true ist syncing gesetzt (am Ende syncEnd() aufrufen). */
function syncCanStart(hasPending, silent){
  if(syncing) return false;
  if(!hasPending){ if(!silent) toast('Alles ist bereits im Google Sheet.'); return false; }
  if(!settings.url){ if(!silent) toast('Bitte zuerst die Web-App-URL in den Einstellungen eintragen.'); return false; }
  if(!navigator.onLine){ if(!silent) toast('Offline – wird automatisch übertragen, sobald Internet da ist.'); return false; }
  syncing = true;
  return true;
}
function syncEnd(){ syncing = false; }

/* Anzeige oben: online/offline und Anzahl ausstehender Datensätze n */
function netRender(n){
  const el = $('#net');
  const on = navigator.onLine;
  el.className = 'net' + (on ? '' : ' off');
  el.innerHTML = `<i class="nd"></i><span class="nt">${on ? 'online' : 'offline'}</span>${n ? `<span class="sep"> · </span><span class="np">${n}</span><span class="nl"> ausstehend</span>` : ''}`;
  el.title = (on ? 'online' : 'offline') + (n ? ` · ${n} ausstehend` : '');
}
