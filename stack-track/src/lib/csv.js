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

/**
 * RFC 4180-ish parser: handles quoted cells, escaped quotes and CRLF.
 * Cells pasted from a spreadsheet arrive tab-separated, so the delimiter is
 * detected from the first line unless given.
 */
export function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = delimiter || (firstLine.includes('\t') ? '\t' : ',');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
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

// ---------------------------------------------------------------------
// Schedules (admin import of official series schedules)
// ---------------------------------------------------------------------

const SCHEDULE_ALIASES = {
  event_date: ['date', 'event date', 'start date'],
  weekday: ['day', 'weekday', 'every', 'repeats'],
  start_time: ['time', 'start', 'start time', 'starts'],
  name: ['event', 'name', 'tournament', 'tournament name', 'event name', 'title'],
  event_number: ['#', 'no', 'no.', 'event #', 'event number', 'number'],
  buy_in: ['buy-in', 'buy in', 'buyin', 'cost', 'entry'],
  game_type: ['game', 'game type', 'variant'],
  guarantee: ['guarantee', 'gtd', 'guaranteed', 'prize pool'],
  venue: ['venue', 'location', 'casino', 'room'],
};

function matchScheduleField(header) {
  const h = header.trim().toLowerCase().replace(/\s*\(.*\)\s*$/, '');
  for (const [field, aliases] of Object.entries(SCHEDULE_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "Mon", "Monday", "mondays" → 1; "Daily"/"Every day" → 'daily'; else null. */
export function parseWeekday(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (/^(daily|every ?day|all)$/.test(v)) return 'daily';
  const i = WEEKDAYS.indexOf(v.slice(0, 3));
  return i === -1 ? undefined : i;
}

/** "11:00 AM", "11am", "7:10 pm", "19:00", "1900" → "HH:MM" (24h); bad → undefined. */
export function parseTime(value) {
  const v = String(value || '').trim().toLowerCase().replace(/\./g, '');
  if (!v) return null;
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/.exec(v);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3];
  if (ap) {
    if (h < 1 || h > 12) return undefined;
    if (ap.startsWith('p') && h !== 12) h += 12;
    if (ap.startsWith('a') && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "$500K GTD" → 500000, "$1.5M" → 1500000, "$25,000" → 25000. */
export function parseAmount(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase().replace(/gtd|guaranteed|\$|,|\s/g, '');
  if (v === '' || v === '-' || v === '—') return null;
  const m = /^(\d+(?:\.\d+)?)([km])?$/.exec(v);
  if (!m) return NaN;
  const mult = m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1000 : 1;
  return Math.round(Number(m[1]) * mult * 100) / 100;
}

/**
 * Turn a pasted or uploaded schedule into catalog event rows.
 * Each row needs an event name, a buy-in, and either a Date (one-off event)
 * or a Day (weekly: "Monday"; or "Daily").
 * Returns { rows, errors, mapped }.
 */
export function importScheduleFromCsv(text) {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { rows: [], errors: ['Paste a header row and at least one event.'], mapped: [] };
  }
  const fields = grid[0].map(matchScheduleField);
  const mapped = fields.filter(Boolean);
  const missing = [];
  if (!fields.includes('name')) missing.push('Event');
  if (!fields.includes('buy_in')) missing.push('Buy-in');
  if (!fields.includes('event_date') && !fields.includes('weekday')) missing.push('Date (or Day for weekly events)');
  if (missing.length) {
    return { rows: [], errors: [`Add a column for ${missing.join(', ')} and try again.`], mapped };
  }

  const rows = [];
  const errors = [];
  grid.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const raw = {};
    fields.forEach((f, i) => {
      if (f) raw[f] = (cells[i] ?? '').trim();
    });
    let name = raw.name || '';
    if (raw.event_number && !/^event\s*#/i.test(name)) {
      const n = raw.event_number.replace(/^#/, '');
      name = `Event #${n}${name ? ` ${name}` : ''}`;
    }
    if (!name) return errors.push(`Row ${line}: missing event name.`);

    let eventDate = null;
    let weekday = null;
    if (raw.event_date) {
      const d = parseDay(raw.event_date);
      if (!d || Number.isNaN(d.getTime())) return errors.push(`Row ${line}: "${raw.event_date}" isn't a date.`);
      eventDate = toDayString(d);
    } else if (raw.weekday) {
      const w = parseWeekday(raw.weekday);
      if (w === undefined) return errors.push(`Row ${line}: "${raw.weekday}" isn't a day of the week.`);
      weekday = w === 'daily' ? null : w;
    } else {
      return errors.push(`Row ${line}: add a date, or a day for weekly events.`);
    }

    const time = parseTime(raw.start_time);
    if (time === undefined) return errors.push(`Row ${line}: "${raw.start_time}" isn't a time.`);
    const buyIn = parseAmount(raw.buy_in);
    if (buyIn == null || Number.isNaN(buyIn)) return errors.push(`Row ${line}: buy-in must be an amount.`);
    const guarantee = parseAmount(raw.guarantee);
    if (Number.isNaN(guarantee)) return errors.push(`Row ${line}: "${raw.guarantee}" isn't an amount.`);

    rows.push({
      name: name.replace(/\s+/g, ' ').trim(),
      event_date: eventDate,
      weekday,
      start_time: time,
      buy_in: buyIn,
      game_type: raw.game_type || null,
      guarantee: guarantee || null,
      venue: raw.venue || null,
    });
    return null;
  });
  return { rows, errors, mapped };
}
