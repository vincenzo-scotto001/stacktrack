// CSV export and import for tournaments.

import { netResult } from './stats';
import { parseDay, toDayString } from './format';

const EXPORT_COLUMNS = [
  ['Tournament Name', (t) => t.tournament_name],
  ['Date', (t) => t.date],
  ['Location', (t) => t.location],
  ['Game', (t) => t.game_type || ''],
  ['Buy-in ($)', (t) => t.buy_in ?? 0],
  ['Action Sold (%)', (t) => t.action_sold ?? 0],
  ['Entries', (t) => t.entries ?? ''],
  ['Place', (t) => t.place ?? ''],
  ['Winnings ($)', (t) => t.winnings ?? 0],
  ['Net Result ($)', (t) => Math.round(netResult(t) * 100) / 100],
  ['Notes', (t) => t.notes || ''],
];

function escapeCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tournamentsToCsv(tournaments) {
  const header = EXPORT_COLUMNS.map(([h]) => h).join(',');
  const rows = tournaments.map((t) => EXPORT_COLUMNS.map(([, get]) => escapeCell(get(t))).join(','));
  return [header, ...rows].join('\n');
}

export function downloadText(filename, text, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC 4180-ish parser: handles quoted cells, escaped quotes and CRLF. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Header aliases, matched case-insensitively against the start of the header.
const FIELD_ALIASES = {
  tournament_name: ['tournament name', 'tournament', 'event', 'name'],
  date: ['date', 'day'],
  location: ['location', 'venue', 'casino', 'site', 'room'],
  game_type: ['game', 'game type', 'variant'],
  buy_in: ['buy-in', 'buy in', 'buyin', 'cost'],
  action_sold: ['action sold', 'sold', '% sold'],
  entries: ['entries', 'field', 'field size', 'players'],
  place: ['place', 'finish', 'position'],
  winnings: ['winnings', 'cash', 'payout', 'prize', 'won'],
  notes: ['notes', 'note', 'comments'],
};

function matchField(header) {
  const h = header.trim().toLowerCase().replace(/\s*\(.*\)\s*$/, '');
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

function toNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[$,%\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Turn CSV text into tournament rows ready to insert.
 * Returns { rows, errors, mapped } where mapped lists the recognised columns.
 */
export function importTournamentsFromCsv(text) {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { rows: [], errors: ['The file needs a header row and at least one tournament.'], mapped: [] };
  }
  const header = grid[0];
  const fields = header.map(matchField);
  const mapped = fields.filter(Boolean);
  const missing = ['tournament_name', 'date', 'buy_in'].filter((f) => !fields.includes(f));
  if (missing.length) {
    const names = { tournament_name: 'Tournament Name', date: 'Date', buy_in: 'Buy-in' };
    return {
      rows: [],
      errors: [`Add a column for ${missing.map((m) => names[m]).join(', ')} and try again.`],
      mapped,
    };
  }

  const rows = [];
  const errors = [];
  grid.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const raw = {};
    fields.forEach((f, i) => {
      if (f) raw[f] = (cells[i] ?? '').trim();
    });
    const day = parseDay(raw.date) || parseDay(new Date(raw.date));
    const buyIn = toNumber(raw.buy_in);
    const winnings = toNumber(raw.winnings);
    const sold = toNumber(raw.action_sold);
    const place = toNumber(raw.place);
    const entries = toNumber(raw.entries);

    if (!raw.tournament_name) return errors.push(`Row ${line}: missing tournament name.`);
    if (!day || Number.isNaN(day.getTime())) return errors.push(`Row ${line}: "${raw.date}" isn't a date.`);
    if (buyIn == null || Number.isNaN(buyIn) || buyIn < 0) return errors.push(`Row ${line}: buy-in must be a number.`);
    if (Number.isNaN(winnings) || Number.isNaN(sold) || Number.isNaN(place) || Number.isNaN(entries)) {
      return errors.push(`Row ${line}: winnings, action sold, place and entries must be numbers.`);
    }

    rows.push({
      tournament_name: raw.tournament_name,
      date: toDayString(day),
      location: raw.location || '',
      buy_in: buyIn,
      action_sold: sold == null ? 0 : Math.min(100, Math.max(0, sold)),
      place: place ? Math.round(place) : null,
      winnings: winnings == null ? 0 : Math.max(0, winnings),
      game_type: raw.game_type || null,
      entries: entries ? Math.round(entries) : null,
      notes: raw.notes || null,
    });
    return null;
  });

  return { rows, errors, mapped };
}
