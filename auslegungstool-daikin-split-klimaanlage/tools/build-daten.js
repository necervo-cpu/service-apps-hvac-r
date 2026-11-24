#!/usr/bin/env node
/* Erzeugt daten.js aus daten/*.csv (Semikolon-getrennt, UTF-8, optional BOM).
   Aufruf:  node tools/build-daten.js [Ausgabedatei]     (Standard: daten.js neben engine.js)
   Format:  window.DATEN_SEED = { Tabellenname: [ {Spalte: 'Wert', ...}, ... ], ... };  (alle Werte als Text) */
const fs = require('fs'),
  path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'daten');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'daten.js');

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [],
    f = '',
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ';') {
      row.push(f);
      f = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f);
      f = '';
      rows.push(row);
      row = [];
    } else f += c;
  }
  if (f !== '' || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const DATEN = {};
fs.readdirSync(dir)
  .filter((n) => n.toLowerCase().endsWith('.csv'))
  .sort()
  .forEach((n) => {
    const rows = parseCsv(fs.readFileSync(path.join(dir, n), 'utf8'));
    const head = rows.shift().map((h) => h.trim());
    DATEN[n.replace(/\.csv$/i, '')] = rows.map((r) => {
      const o = {};
      head.forEach((h, i) => {
        o[h] = r[i] == null ? '' : r[i];
      });
      return o;
    });
  });
fs.writeFileSync(out, 'window.DATEN_SEED = ' + JSON.stringify(DATEN) + ';\n');
console.log(
  'geschrieben: ' +
    out +
    ' (' +
    Object.keys(DATEN)
      .map((k) => k + ' ' + DATEN[k].length)
      .join(', ') +
    ')',
);
