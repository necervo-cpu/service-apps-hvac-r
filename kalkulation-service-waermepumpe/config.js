/* =====================================================================
   Kalkulation WÄRMEPUMPE – alles, was diese App von der Klima-Kalkulation unterscheidet.
   index.html ist in beiden Apps identisch, nur diese Datei ist verschieden.

   stamm   = Stammdaten. key = Spalte "Schlüssel" im Blatt "Stammdaten" des Google Sheets.
             def = Standardwert, solange die App das Sheet noch nicht geladen hat.
   geraete = Positionen mit Richtzeit (t = Stammdaten-Schlüssel der Richtzeit in Minuten).
   material= Positionen mit Preis (price = Stammdaten-Schlüssel des Einzelpreises).
   auto    = Vorschlag aus den Gerätezahlen; sobald man den Wert selbst ändert, bleibt er stehen.
   ===================================================================== */
const odu = q => q.mono + q.split;   // Anzahl Außengeräte

window.CFG = {
  id: 'kalk-wp',
  ls: 'kalkwp1',                                   // Speicher-Name auf dem Gerät
  appName: 'Kalkulation Service Wärmepumpe',
  header: 'Kalkulation Service Wärmepumpe',
  pdfTitle: 'Wärmepumpe · Service & Wartung',
  geraeteTitle: 'Wärmepumpe, Hydraulik & Speicher',
  erschwernisLabel: 'Steigtechnik / Dachzugang / Erschwernis',
  sonderPh: 'z. B. Frostschutz / Glykol',

  stamm: [
    {key:'satz_tech',     label:'Stundensatz Servicetechniker',               unit:'€/h', def:85},
    {key:'satz_helfer',   label:'Stundensatz Helfer / Azubi',                 unit:'€/h', def:48},
    {key:'mwst',          label:'Mehrwertsteuer',                             unit:'%',   def:19},
    {key:'t_mono',        label:'Richtzeit Außengerät Monoblock',             unit:'Min', def:30},
    {key:'t_split',       label:'Richtzeit Außengerät Split',                 unit:'Min', def:30},
    {key:'t_idu',         label:'Richtzeit Innengerät / Hydraulikstation',    unit:'Min', def:10},
    {key:'t_wanne',       label:'Richtzeit Kondensatwanne & Begleitheizung',  unit:'Min', def:5},
    {key:'t_abscheider',  label:'Richtzeit Schlamm- / Magnetitabscheider',    unit:'Min', def:10},
    {key:'t_speicher',    label:'Richtzeit Trinkwasserspeicher / FriWa',      unit:'Min', def:10},
    {key:'t_puffer',      label:'Richtzeit Pufferspeicher',                   unit:'Min', def:10},
    {key:'t_mag',         label:'Richtzeit Ausdehnungsgefäß (MAG)',           unit:'Min', def:15},
    {key:'t_param',       label:'Richtzeit Prüfung Parameter & Messwerte',    unit:'Min', def:15},
    {key:'t_dicht',       label:'Richtzeit F-Gase-Dichtheitsprüfung je Kältekreis', unit:'Min', def:45},
    {key:'t_r290',        label:'Richtzeit R290-Sicherheitsprüfung je Kältekreis', unit:'Min', def:20},
    {key:'p_reiniger',    label:'Preis Reiniger Außengerät',                  unit:'€/L', def:24.5},
    {key:'p_wasser',      label:'Preis Wasseranalyse VDI 2035',               unit:'€/Set', def:38},
    {key:'p_klein',       label:'Preis Kleinteile & Dichtungen',              unit:'€/Pauschale', def:25},
    {key:'f_reiniger',    label:'Automatik: Reiniger je Außengerät',          unit:'L',   def:0.5},
    {key:'text_angebot',  label:'Hinweistext im Pauschalangebot', unit:'Text',
      def:'Pauschalpreis für die oben beschriebenen Leistungen. Darüber hinaus erforderliche Arbeiten, Ersatzteile und Betriebsmittel werden nach Aufwand berechnet.'},
    {key:'text_intern',   label:'Hinweistext in der internen Kalkulation', unit:'Text',
      def:'Interne Kalkulation (Orientierungshilfe). Vor Weitergabe oder Angebotslegung auf Plausibilität, Richtigkeit und Vollständigkeit prüfen.'}
  ],

  geraete: [
    {id:'mono',       label:'Außengerät Monoblock',                 t:'t_mono',       unit:'Stk.', kat:'Hauptgerät', umfang:'Grundwartung, Verdampferreinigung & Funktionsprüfung'},
    {id:'split',      label:'Außengerät Split',                     t:'t_split',      unit:'Stk.', kat:'Hauptgerät', umfang:'Grundwartung, Verdampferreinigung & Funktionsprüfung'},
    {id:'idu',        label:'Innengerät / Hydraulikstation',        t:'t_idu',        unit:'Stk.', kat:'Hydraulik',  umfang:'Reglerprüfung, Sensorik & Sicherheitsgruppe'},
    {id:'wanne',      label:'Kondensatwanne & Begleitheizung',      t:'t_wanne',      unit:'Stk.', kat:'Peripherie', umfang:'Freier Ablauf & Funktion Begleitheizung'},
    {id:'abscheider', label:'Schlamm- / Magnetitabscheider',        t:'t_abscheider', unit:'Stk.', kat:'Hydraulik',  umfang:'Magnetkern reinigen & Abscheider spülen'},
    {id:'speicher',   label:'Trinkwasserspeicher / FriWa',          t:'t_speicher',   unit:'Stk.', kat:'Speicher',   umfang:'Anodenprüfung, Dichtheit & Funktionskontrolle'},
    {id:'puffer',     label:'Pufferspeicher prüfen & entlüften',    t:'t_puffer',     unit:'Stk.', kat:'Speicher',   umfang:'Sichtprüfung & Entlüftung'},
    {id:'mag',        label:'Ausdehnungsgefäß (MAG Vordruck)',      t:'t_mag',        unit:'Stk.', kat:'Hydraulik',  umfang:'Kappenventil schließen, Vordruck prüfen & anpassen'},
    {id:'param',      label:'Prüfung Parameter & Messwerte',        t:'t_param',      unit:'Pauschale', kat:'Regelung', umfang:'Soll-/Ist-Vergleich, Heizkurve, Fehlerspeicher & Laufzeiten',
      auto:q => odu(q) > 0 ? 1 : 0, autoHint:() => '1× sobald ein Außengerät eingetragen ist'}
  ],

  material: [
    {id:'reiniger', label:'Reiniger für Außengerät',        price:'p_reiniger', unit:'L',   step:0.5,
      auto:(q, S) => odu(q) * S.f_reiniger, autoHint:S => `${fmtNum(S.f_reiniger)} L je Außengerät`},
    {id:'wasser',   label:'Wasseranalyse VDI 2035',         price:'p_wasser',   unit:'Set', step:1,
      auto:q => odu(q) > 0 ? 1 : 0, autoHint:() => '1× je Anlage'},
    {id:'klein',    label:'Kleinteile & Dichtungen',        price:'p_klein',    unit:'Pauschale', step:1}
  ],

  // Kältemittel → GWP (für das CO₂-Äquivalent). Andere Kältemittel: Name eintippen und GWP selbst eingeben.
  kaeltemittel: {R290:3, R32:675, R410A:2088, R454B:466, R454C:148, R407C:1774, R134a:1430},
  r290Key: 't_r290',           // R290: jährliche Sicherheits- und Dichtheitsprüfung einrechnen
  hermAuto: q => odu(q) === 0 ? '' : q.split === 0 ? 'Ja' : 'Nein',   // reine Monoblock-Anlagen gelten als hermetisch geschlossen

  zweck: 'Vor-Ort- und Büro-Kalkulation von Service- und Wartungseinsätzen an Luft/Wasser-Wärmepumpen (Monoblock und Split) inklusive Hydraulik, Speicherprüfung, Wasseranalyse nach VDI 2035 sowie F-Gase- und R290-Sicherheitsprüfung.',

  fragen: [
    {h:'Wärmepumpen-Typ & Komponenten', items:[
      '<b>Anlagentyp:</b> Monoblock-Außengerät oder Split-System?',
      '<b>Inneneinheit / Hydraulik:</b> Welcher Typ Inneneinheit bzw. Hydraulikstation ist installiert?',
      '<b>Peripherie:</b> Gibt es eine beheizte Kondensatwanne und einen Schlamm- oder Magnetitabscheider im Heizkreis?']},
    {h:'Speicher & Sicherheitseinrichtungen', items:[
      '<b>Trinkwasser & Puffer:</b> Sind ein Trinkwasserspeicher (oder eine Frischwasserstation) und / oder ein Pufferspeicher vorhanden?',
      '<b>Ausdehnungsgefäße (MAG):</b> Wie viele Gefäße (Heizung / Warmwasser) müssen geprüft werden?']},
    {h:'Kältemittel & F-Gase / R290', items:[
      'Welches Kältemittel ist in der Wärmepumpe (z. B. R32, R410A oder R290 / Propan)?',
      'Wie groß ist die <b>Füllmenge in kg</b> und wie viele Kältekreise hat die Anlage? (Typenschild)',
      'Gibt es ein <b>Leckage-Erkennungssystem</b>?']},
    {h:'Historie & Zustand', items:[
      'Wie alt ist die Anlage bzw. wann war die letzte Wartung?',
      'Gab es Störungen, Fehlercodes, Druckverlust in der Heizung oder Auffälligkeiten beim Warmwasser?',
      'Wurde in den letzten Jahren eine <b>Heizungswasseranalyse nach VDI 2035</b> gemacht?']},
    {h:'Bauliche Gegebenheiten & Logistik', items:[
      'Besonderheiten am Aufstellort? (Flachdach, schwieriger Zugang, Erschwernisse)']}
  ]
};
