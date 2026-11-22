/* shared/wizard.js – Formular-Rahmen (Kopf-Unterzeile, Schrittanzeige, untere Leiste, Seitenwechsel, Berichtsanzeige)
   Inhalt: setHeader(animate), barRender(h), showReport().
   Benötigt aus der App (globale Namen, erst zur Laufzeit gelesen): app, render, view, navBusy, enterT, hsubAnim,
   hsubText(), wizSnapshot() (liefert eine Funktion, die true ist, solange noch dieselbe Formular-Ansicht offen ist),
   reportForView(); aus core.js: $, esc, RM; aus pdf.js: reportFontsReady, layoutReport.
   Laden: nach core.js und pdf.js (klassisches Skript, kein Modul). */

function setHeader(animate) {
  const hs = $('#hsub'),
    t = hsubText();
  if (hsubAnim) {
    hsubAnim.cancel();
    hsubAnim = null;
  }
  const changed = hs.textContent !== t;
  hs.textContent = t;
  if (animate && changed && !RM() && hs.animate)
    hsubAnim = hs.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 0.75, transform: 'none' },
      ],
      { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
}
/* Feste Leiste unten */
function barRender(h) {
  const b = $('#bar');
  if (b._lastHtml !== h) {
    b._lastHtml = h;
    b.innerHTML = h;
  }
  b.hidden = !h;
  document.body.classList.toggle('hasbar', !!h);
}
/* Bericht seitenweise (A4) anzeigen – auf schmalen Bildschirmen verkleinert */
async function showReport() {
  const host = $('#sheet'),
    r = reportForView();
  if (!host || !r) return;
  await reportFontsReady();
  if (!host.isConnected) return;
  layoutReport(r, host);
  host.style.zoom = Math.min(
    1,
    (host.parentElement.clientWidth - 8) / host.querySelector('.page').offsetWidth,
  );
}
