// Minimal RFC 4180 CSV helpers for product import/export (opens in Excel/Sheets).

export function toCsv(rows, columns) {
  const escape = (value) => {
    let s = value === null || value === undefined ? '' : String(value);
    // Stop spreadsheet apps from running customer-entered text as a formula.
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text).replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim().replace(/^'(?=[=+\-@])/, '')])),
  );
}
