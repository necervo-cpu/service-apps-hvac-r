/* shared/pdf.js – PDF-Erzeugung für die Service-Apps
   Inhalt: layoutReport (Blöcke auf A4-Seiten verteilen), reportFontsReady, reportPdfBlob (PDF als Blob),
           pdfName (Dateiname), isStandalone, blobB64, pdfBase64 (PDF als Base64 für die Synchronisierung).
   Optionale Parameter: reportPdfBlob(r, opts) und pdfBase64(p, r, opts) – opts.waitImages wartet vor dem Rendern, bis alle Bilder
   im Bericht geladen sind (z. B. Unterschrift); r = fertiger Bericht statt buildReport(p); opts.onProgress(0..1) meldet den Fortschritt. Ohne diese Parameter unverändert.
   reportParts(r) darf zusätzlich maxSeiten liefern und Blöcke {splitText:{titel, text, art}} (langer Text über Seiten verteilt, „(FORTSETZUNG)“; Daikin).
   Benötigt aus der App: reportParts(r) und buildReport(p) (Funktionen), jsPDF + html2canvas (shared/lib);
   vor dem App-Skript laden.
   Änderungen am PDF in der App, shared/pdf.js, shared/pdf.css, shared/pdf-bausteine.js; PdfDialog.html danach mit tools/pdfdialog-bauen.js erzeugen. */

/* ===== wird von tools/pdfdialog-bauen.js in PdfDialog.html eingesetzt (Teil: layoutReport … reportPdfBlob) ===== */
/* @@quelle:layout */
/* Verteilt die Blöcke auf A4-Seiten. host muss im Dokument hängen (Messung der Höhen). */
function layoutReport(r, host){
  const b = reportParts(r), pages = [];
  let body;
  const el = html => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
  const newPage = () => {
    const pg = el(`<section class="page"><div class="page-body">${pages.length ? b.smallHead : b.head}</div><div class="pfoot"><span>${b.foot}</span><span class="pno"></span></div></section>`);
    host.appendChild(pg); pages.push(pg); body = pg.firstElementChild;
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  // Optional (nur wenn reportParts es liefert): b.maxSeiten = Höchstseitenzahl für lange Texte (blk.splitText), danach Kürzungs-Hinweis in der Fußzeile
  const maxP = b.maxSeiten || 0, CUT = '<b>… (gekürzt, vollständiger Text in der App)</b> ';
  const gekuerzt = () => { const ft = pages[pages.length - 1].querySelector('.pfoot span'); if(!ft.dataset.cut){ ft.dataset.cut = '1'; ft.insertAdjacentHTML('afterbegin', CUT); } };
  const escT = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  host.innerHTML = '';
  newPage();
  b.blocks.forEach(blk => {
    if(blk.splitText){
      // Langer Text (blk.splitText = {titel, text, art}): wortweise (zu lange Wörter in Stücken) auf Folgeseiten verteilen; Binärsuche je Seite.
      // Folgeseiten: Überschrift „… (FORTSETZUNG)“
      const st = blk.splitText, titelUp = escT(String(st.titel ?? '').toUpperCase());
      const tokens = String(st.text ?? '').split(/(\s+)/).flatMap(t => t.length > 100 ? t.match(/[\s\S]{1,100}/g) : [t]).filter(t => t !== '');
      let pos = 0, cont = false;
      while(pos < tokens.length){
        if(cont) while(pos < tokens.length && !tokens[pos].trim()) pos++;
        if(pos >= tokens.length) break;
        const nd = el(`<div class="note${st.art ? ' ' + st.art : ''}"><b>${titelUp}${cont ? ' (FORTSETZUNG)' : ''}</b><span class="tx"></span></div>`), tx = nd.querySelector('.tx');
        const setK = k => { tx.innerHTML = escT(tokens.slice(pos, pos + k).join('')).replace(/\n/g, '<br>'); };
        body.appendChild(nd);
        const rest = tokens.length - pos;
        setK(rest);
        let k = rest;
        if(!fits()){
          let lo = 0, hi = rest - 1;   // größtes k, das noch passt
          while(lo < hi){ const mid = (lo + hi + 1) >> 1; setK(mid); if(fits()) lo = mid; else hi = mid - 1; }
          k = lo;
          if(k < 1){   // nicht einmal ein Stück passt
            if(body.children.length > 2){ nd.remove(); if(maxP && pages.length >= maxP){ gekuerzt(); return; } newPage(); continue; }
            k = 1;   // leere Seite: mindestens ein Stück, damit es weitergeht
          }
          setK(k);
        }
        pos += k; cont = true;
        if(pos < tokens.length){ if(maxP && pages.length >= maxP){ gekuerzt(); return; } newPage(); }
      }
      return;
    }
    const node = el(blk.html);
    body.appendChild(node);
    if(fits()) return;
    node.remove();
    if(!blk.split){ newPage(); body.appendChild(node); return; }
    // Tabelle zeilenweise verteilen; auf der Folgeseite Überschrift „(Fortsetzung)“ und Tabellenkopf wiederholen
    const rows = [...node.querySelectorAll('tbody > tr')];
    const shell = cont => { const s = node.cloneNode(true); s.querySelector('tbody').innerHTML = ''; if(cont) s.querySelector('.tt').textContent += ' (Fortsetzung)'; return s; };
    let part = shell(false), placed = 0;
    body.appendChild(part);
    rows.forEach(tr => {
      part.querySelector('tbody').appendChild(tr);
      if(fits()){ placed++; return; }
      tr.remove();
      if(!placed) part.remove();
      const cont = placed > 0;
      newPage(); part = shell(cont); body.appendChild(part);
      part.querySelector('tbody').appendChild(tr); placed = 1;
    });
  });
  pages.forEach((p, i) => { p.querySelector('.pno').innerHTML = `${b.id} · Seite ${i + 1} von ${pages.length}`; });
  return pages;
}
async function reportFontsReady(){
  try{ await document.fonts.ready; }catch(e){}
}
/* PDF: jede A4-Seite wird einzeln aufgenommen (Bild) und als eigene PDF-Seite eingefügt */
async function reportPdfBlob(r, opts){
  const prog = v => { try{ if(opts && opts.onProgress) opts.onProgress(v); }catch(e){} };   // optional: Fortschritt 0..1 (Daikin)
  await reportFontsReady();
  prog(.12);
  const box = document.createElement('div');
  box.className = 'report flat';
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:220mm;background:#fff';
  document.body.appendChild(box);
  try{
    const pages = layoutReport(r, box);
    if(opts && opts.waitImages) await Promise.all([...box.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(res => { i.onload = i.onerror = res; })));
    prog(.2);
    const pdf = new window.jspdf.jsPDF({unit:'mm', format:'a4'});
    for(let i = 0; i < pages.length; i++){
      const canvas = await html2canvas(pages[i], {scale:2, backgroundColor:'#ffffff', logging:false});
      if(i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297);
      prog(.2 + .78 * (i + 1) / pages.length);
    }
    return pdf.output('blob');
  } finally {
    box.remove();
  }
}
/* @@ende */
/* ===== Ende des in PdfDialog.html eingesetzten Teils ===== */

/* Dateiname = Projekt-Nr. (wie in Google Drive) */
function pdfName(proj, leer = 'ohne-Projektnummer'){ return String(proj || leer).replace(/[\/\\:*?"<>|]+/g, '-').trim(); }
function isStandalone(){ return !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches; }
const blobB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); });
/* Beim Synchronisieren: dasselbe PDF erzeugen und mitschicken – landet 1:1 in Google Drive */
async function pdfBase64(p, r, opts){
  if(!window.jspdf || !window.html2canvas) return '';
  try{ return await blobB64(await reportPdfBlob(r || buildReport(p), opts)); }catch(e){ return ''; }
}
