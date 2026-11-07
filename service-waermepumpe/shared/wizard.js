/* shared/wizard.js – Formular-Rahmen (Kopf-Unterzeile, Schrittanzeige, untere Leiste, Seitenwechsel, Berichtsanzeige)
   Inhalt: setHeader(animate), stepsRender(m), barRender(h), stepTo(dir, change), showReport().
   stepsRender(m): m = null (Schrittanzeige ausblenden) oder {key, pages, index, done(k), pauseAct}.
   Benötigt aus der App (globale Namen, erst zur Laufzeit gelesen): app, render, view, navBusy, enterT, hsubAnim,
   hsubText(), wizSnapshot() (liefert eine Funktion, die true ist, solange noch dieselbe Formular-Ansicht offen ist),
   reportForView(); aus core.js: $, esc, RM; aus pdf.js: reportFontsReady, layoutReport.
   Laden: nach core.js und pdf.js (klassisches Skript, kein Modul). */

function setHeader(animate){
  const hs = $('#hsub'), t = hsubText();
  if(hsubAnim){ hsubAnim.cancel(); hsubAnim = null; }
  const changed = hs.textContent !== t;
  hs.textContent = t;
  if(animate && changed && !RM() && hs.animate) hsubAnim = hs.animate([{opacity:0, transform:'translateY(6px)'}, {opacity:.75, transform:'none'}], {duration:260, easing:'cubic-bezier(.2,.8,.2,1)'});
}
/* Schrittanzeige: bleibt beim Schrittwechsel im DOM stehen (Balken gleitet, Punkte wechseln nur die Klasse) */
function stepsRender(m){
  const w = $('#stepwrap');
  if(!m){ w.hidden = true; w.dataset.pid = ''; return; }
  const pages = m.pages, n = pages.length, i = m.index, key = m.key, fresh = w.dataset.pid !== key;
  if(fresh){
    w.dataset.pid = key;
    w.innerHTML = `<div class="steplab"><span id="stlab"></span><button class="btn small" data-act="${m.pauseAct}">Pause</button></div>
      <div class="progress"><div id="stbar" style="transform:scaleX(0)"></div></div>
      <div class="steps">${pages.map((x, k) => `<button type="button" data-act="jump" data-i="${k}" aria-label="Schritt ${k + 1}: ${esc(x.title)}">${k + 1}<span class="sl"> ${esc(x.short)}</span></button>`).join('')}</div>`;
  }
  const wasHidden = w.hidden; w.hidden = false;
  if(fresh || wasHidden) void w.offsetWidth;
  $('#stlab').innerHTML = `<b>Schritt ${i + 1} von ${n}</b> · ${esc(pages[i].short)}`;
  $('#stbar').style.transform = 'scaleX(' + ((i + 1) / n).toFixed(4) + ')';   // transform statt width: kein Neu-Layout je Bild
  w.querySelectorAll('.steps button').forEach((b, k) => {
    b.classList.toggle('done', k !== i && m.done(k));
    b.classList.toggle('on', k === i);
    if(k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}
/* Feste Leiste unten */
function barRender(h){
  const b = $('#bar');
  b.innerHTML = h; b.hidden = !h; document.body.classList.toggle('hasbar', !!h);
}
/* Schrittwechsel: alte Seite gleitet weg (0,18 s), Zustand ändern + neu zeichnen, neue Seite gleitet herein (0,26 s).
   Doppeltipp während des Übergangs wird ignoriert (navBusy). Animation-Klassen werden danach vollständig entfernt
   (wichtig für die Unterschrift-Felder: Koordinaten werden live per getBoundingClientRect gelesen). */
function stepTo(dir, change){
  if(navBusy) return;
  /* Handy: Ist noch die Bildschirmtastatur offen (z. B. direkt nach dem Tippen auf Weiter), erst die Tastatur schließen
     und warten, bis sie weg ist – sonst ändert sich mitten im Gleiten die Bildschirmhöhe und alles ruckelt. */
  const ae = document.activeElement, vv = window.visualViewport;
  if(ae && ae.matches && ae.matches('input,textarea,select') && vv && vv.height < window.innerHeight * 0.85){
    navBusy = true; ae.blur();
    let t = null, done = false;
    const go = () => { if(done) return; done = true; vv.removeEventListener('resize', wait); clearTimeout(t); clearTimeout(max); navBusy = false; stepTo(dir, change); };
    const wait = () => { clearTimeout(t); t = setTimeout(go, 80); };
    const max = setTimeout(go, 500);
    vv.addEventListener('resize', wait);
    return;
  }
  const still = wizSnapshot();
  if(RM() || !app.animate){ change(); render(); window.scrollTo(0, 0); return; }
  navBusy = true;
  app.className = 'pg-out-' + dir;
  setTimeout(() => {
    let ok = false;
    try{
      if(!still()){ app.className = ''; return; }
      change(); render(); window.scrollTo(0, 0);
      /* Neue Seite erst außerhalb bereitlegen und zeichnen lassen; das Gleiten startet 2 Bilder später.
         Sonst schluckt das Neuzeichnen die ersten Bilder und die Seite springt (beim Weiter am stärksten sichtbar).
         Kein gestaffeltes Einblenden der Karten (.entering) während des Gleitens – das ruckelt zusätzlich. */
      const pre = 'pg-pre-' + dir, cls = 'pg-in-' + dir;
      clearTimeout(enterT);
      app.className = pre;
      ok = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if(app.className !== pre){ navBusy = false; return; }
        app.className = cls;
        setTimeout(() => { navBusy = false; }, 300);
        setTimeout(() => { if(app.className === cls) app.className = ''; }, 400);
      }));
    } finally {
      if(!ok){ navBusy = false; if(/pg-/.test(app.className)) app.className = ''; }   // Fehler oder Abbruch: App bleibt bedienbar
    }
  }, 180);
}
/* Bericht seitenweise (A4) anzeigen – auf schmalen Bildschirmen verkleinert */
async function showReport(){
  const host = $('#sheet'), r = reportForView();
  if(!host || !r) return;
  await reportFontsReady();
  if(!host.isConnected) return;
  layoutReport(r, host);
  host.style.zoom = Math.min(1, (host.parentElement.clientWidth - 8) / host.querySelector('.page').offsetWidth);
}
