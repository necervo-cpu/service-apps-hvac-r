/* =====================================================================
   Kalkulation KLIMAANLAGE – alles, was diese App von der WP-Kalkulation unterscheidet.
   index.html ist in beiden Apps identisch, nur diese Datei ist verschieden.

   stamm   = Stammdaten. key = Spalte "Schlüssel" im Blatt "Stammdaten" des Google Sheets.
             def = Standardwert, solange die App das Sheet noch nicht geladen hat.
   geraete = Positionen mit Richtzeit (t = Stammdaten-Schlüssel der Richtzeit in Minuten).
   material= Positionen mit Preis (price = Stammdaten-Schlüssel des Einzelpreises).
   auto    = Vorschlag aus den Gerätezahlen; sobald man den Wert selbst ändert, bleibt er stehen.
   ===================================================================== */
window.CFG = {
  id: 'kalk-klima',
  ls: 'kalkkl1',                                   // Speicher-Name auf dem Gerät
  appName: 'Kalkulation Service Klimaanlage',
  header: 'Kalkulation Service Klimaanlage',
  pdfTitle: 'Klimaanlage · Service & Wartung',
  geraeteTitle: 'Anlagen & Geräte',
  erschwernisLabel: 'Steigtechnik / Hubarbeitsbühne / Gerüst',
  sonderPh: 'z. B. Kleinmaterial',

  stamm: [
    {key:'satz_tech',     label:'Stundensatz Servicetechniker',               unit:'€/h', def:65},
    {key:'satz_helfer',   label:'Stundensatz Helfer / Azubi',                 unit:'€/h', def:48},
    {key:'mwst',          label:'Mehrwertsteuer',                             unit:'%',   def:19},
    {key:'t_ag',          label:'Richtzeit Außengerät Split / Multi-Split',   unit:'Min', def:30},
    {key:'t_vrv',         label:'Richtzeit VRV / VRF Außengerät / Modul',     unit:'Min', def:60},
    {key:'t_wand',        label:'Richtzeit Innengerät Wandgerät',             unit:'Min', def:15},
    {key:'t_kassette',    label:'Richtzeit Innengerät Kassette / Kanal / Truhe', unit:'Min', def:30},
    {key:'t_pumpe',       label:'Richtzeit Kondensatpumpe',                   unit:'Min', def:10},
    {key:'t_dicht',       label:'Richtzeit Dichtheitsprüfung je Kältekreis',  unit:'Min', def:30},
    {key:'p_verdampfer',  label:'Preis Verdampferreiniger',                   unit:'€/L', def:14.5},
    {key:'p_kondensator', label:'Preis Kondensatorreiniger',                  unit:'€/L', def:16},
    {key:'p_tabs',        label:'Preis Kondensatpumpen-Tabs',                 unit:'€/Stk.', def:4.5},
    {key:'p_sonstige',    label:'Preis Sonstiges / Ersatzfilter',             unit:'€/Stk.', def:25},
    {key:'f_verdampfer',  label:'Automatik: Verdampferreiniger je Innengerät', unit:'L',  def:0.25},
    {key:'f_kond_split',  label:'Automatik: Kondensatorreiniger je Split-Außengerät', unit:'L', def:0.25},
    {key:'f_kond_vrv',    label:'Automatik: Kondensatorreiniger je VRV-Modul', unit:'L',  def:0.5},
    {key:'f_tabs',        label:'Automatik: Tabs je Kondensatpumpe',          unit:'Stk.', def:1},
    {key:'text_angebot',  label:'Hinweistext im Pauschalangebot', unit:'Text',
      def:'Pauschalpreis für die oben beschriebenen Leistungen. Darüber hinaus erforderliche Arbeiten, Ersatzteile und Kältemittel werden nach Aufwand berechnet.'},
    {key:'text_intern',   label:'Hinweistext in der internen Kalkulation', unit:'Text',
      def:'Interne Kalkulation (Orientierungshilfe). Vor Weitergabe oder Angebotslegung auf Plausibilität, Richtigkeit und Vollständigkeit prüfen.'}
  ],

  geraete: [
    {id:'ag',       label:'Außengerät Split / Multi-Split',      t:'t_ag',       unit:'Stk.', kat:'Außeneinheit',     umfang:'Wartung, Reinigung & Funktionsprüfung'},
    {id:'vrv',      label:'VRV / VRF Außengerät / Modul',        t:'t_vrv',      unit:'Stk.', kat:'VRV / VRF-System', umfang:'Wartung, Reinigung & Systeminspektion'},
    {id:'wand',     label:'Innengerät Wandgerät',                t:'t_wand',     unit:'Stk.', kat:'Inneneinheit',     umfang:'Filter- / Registerreinigung & Funktionsprüfung'},
    {id:'kassette', label:'Innengerät Kassette / Kanal / Truhe', t:'t_kassette', unit:'Stk.', kat:'Inneneinheit',     umfang:'Filter- / Registerreinigung & Funktionsprüfung'},
    {id:'pumpe',    label:'Kondensatpumpe (warten / reinigen)',  t:'t_pumpe',    unit:'Stk.', kat:'Zusatzkomponente', umfang:'Wartung, Reinigung & Funktionsprüfung'}
  ],

  material: [
    {id:'verdampfer',  label:'Verdampferreiniger',        price:'p_verdampfer',  unit:'L',    step:0.25,
      auto:(q, S) => (q.wand + q.kassette) * S.f_verdampfer, autoHint:S => `${fmtNum(S.f_verdampfer)} L je Innengerät`},
    {id:'kondensator', label:'Kondensatorreiniger',       price:'p_kondensator', unit:'L',    step:0.25,
      auto:(q, S) => q.ag * S.f_kond_split + q.vrv * S.f_kond_vrv, autoHint:S => `${fmtNum(S.f_kond_split)} L je Split-Außengerät + ${fmtNum(S.f_kond_vrv)} L je VRV-Modul`},
    {id:'tabs',        label:'Kondensatpumpen-Tabs',      price:'p_tabs',        unit:'Stk.', step:1,
      auto:(q, S) => q.pumpe * S.f_tabs, autoHint:S => `${fmtNum(S.f_tabs)} je Kondensatpumpe`},
    {id:'sonstige',    label:'Sonstiges / Ersatzfilter',  price:'p_sonstige',    unit:'Stk.', step:1}
  ],

  // Kältemittel → GWP (für das CO₂-Äquivalent). Andere Kältemittel: Name eintippen und GWP selbst eingeben.
  kaeltemittel: {R32:675, R410A:2088, R454B:466, R454C:148, R407C:1774, R134a:1430, R290:3},
  r290Key: '',                 // Klima: keine eigene R290-Sicherheitsprüfung einrechnen
  hermAuto: null,              // "Hermetisch geschlossen" wird von Hand gewählt

  zweck: 'Vor-Ort- und Büro-Kalkulation von Service- und Wartungseinsätzen an Split-, Multi-Split- und VRV/VRF-Klimaanlagen.',

  fragen: [
    {h:'Anlagentyp & Anzahl', items:[
      '<b>Wie viele Außengeräte</b> sind vorhanden? Klassische Split- / Multi-Split-Geräte oder größere VRV/VRF-Module?',
      '<b>Wie viele Innengeräte</b> sind angeschlossen und welche Bauform haben sie? (Wandgeräte, Kassetten, Kanalgeräte, Truhen)',
      '<b>Gibt es Kondensatpumpen?</b> Vor allem bei Deckenkassetten oder Innengeräten ohne freies Gefälle.']},
    {h:'Kältemittel & F-Gase-Prüfung', items:[
      'Welches Kältemittel ist eingefüllt (z. B. R32, R410A) und wie groß ist die <b>Füllmenge in kg je Kältekreis</b>? (Typenschild am Außengerät / Anlagenbuch)',
      'Wie viele getrennte Kältekreise hat die Anlage?',
      'Ist die Anlage <b>hermetisch geschlossen</b> (Herstellerangabe) und gibt es ein <b>Leckage-Erkennungssystem</b>?']},
    {h:'Bauliche Gegebenheiten & Logistik', items:[
      '<b>Wo hängen bzw. stehen die Außengeräte?</b> Gut erreichbar oder auf dem Dach / in großer Höhe (Steigtechnik, Hubarbeitsbühne)?',
      'Besonderheiten beim Zugang zu Innen- oder Außengeräten? (Sicherheitsvorschriften, nur außerhalb der Geschäftszeiten …)']},
    {h:'Historie & Zustand', items:[
      'Wann war die letzte Wartung (oder ist es die Erstwartung)?',
      'Gab es Störungen, Fehlercodes oder Auffälligkeiten? (schlechte Kühlleistung, Geruch, tropfende Innengeräte)']}
  ]
};
