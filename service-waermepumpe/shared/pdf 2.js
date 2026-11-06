/* shared/pdf.js – PDF-Erzeugung für die Service-Apps
   Inhalt: layoutReport (Blöcke auf A4-Seiten verteilen), reportFontsReady, reportPdfBlob (PDF als Blob),
           pdfName (Dateiname), isStandalone, blobB64, pdfBase64 (PDF als Base64 für die Synchronisierung).
   Optionale Parameter: reportPdfBlob(r, opts) und pdfBase64(p, r, opts) – opts.waitImages wartet vor dem Rendern, bis alle Bilder
   im Bericht geladen sind (z. B. Unterschrift); r = fertiger Bericht statt buildReport(p). Ohne diese Parameter unverändert.
   Benötigt aus der App: reportParts(r) und buildReport(p) (Funktionen), jsPDF + html2canvas (shared/lib);
   vor dem App-Skript laden.
   Änderungen am PDF immer in der App (index.html UND shared/pdf.js) und in google-apps-script/PdfDialog.html machen (von Hand gepflegt). */

/* ===== identisch in PdfDialog.html (Teil 2 von 2; Teil 1 = LISTS, reportParts in der App) ===== */
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
  host.innerHTML = '';
  newPage();
  b.blocks.forEach(blk => {
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
  await reportFontsReady();
  const box = document.createElement('div');
  box.className = 'report flat';
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:220mm;background:#fff';
  document.body.appendChild(box);
  try{
    const pages = layoutReport(r, box);
    if(opts && opts.waitImages) await Promise.all([...box.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(res => { i.onload = i.onerror = res; })));
    const pdf = new window.jspdf.jsPDF({unit:'mm', format:'a4'});
    for(let i = 0; i < pages.length; i++){
      const canvas = await html2canvas(pages[i], {scale:2, backgroundColor:'#ffffff', logging:false});
      if(i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297);
    }
    return pdf.output('blob');
  } finally {
    box.remove();
  }
}
/* ===== Ende identischer Teil ===== */

/* Dateiname = Projekt-Nr. (wie in Google Drive) */
function pdfName(proj, leer = 'ohne-Projektnummer'){ return String(proj || leer).replace(/[\/\\:*?"<>|]+/g, '-').trim(); }
function isStandalone(){ return !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches; }
const blobB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); });
/* Beim Synchronisieren: dasselbe PDF erzeugen und mitschicken – landet 1:1 in Google Drive */
async function pdfBase64(p, r, opts){
  if(!window.jspdf || !window.html2canvas) return '';
  try{ return await blobB64(await reportPdfBlob(r || buildReport(p), opts)); }catch(e){ return ''; }
}
