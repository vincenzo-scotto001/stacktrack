// Shared formatting helpers. Every money / date / place string in the app goes
// through here so the whole UI reads the same way.

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a dollar amount.
 * @param {number} value
 * @param {{ sign?: boolean, cents?: boolean }} opts
 *   sign  – always show + / − (for profit numbers)
 *   cents – show two decimals
 */
export function money(value, { sign = false, cents = false } = {}) {
  const n = Number(value) || 0;
  const fmt = cents ? usd2 : usd0;
  const body = fmt.format(Math.abs(n));
  if (!sign) return n < 0 ? `−${body}` : body;
  if (Math.round(n) === 0 && !cents) return body;
  return n > 0 ? `+${body}` : `−${body}`;
}

/** Short money for chart axes: $1.2k, $14k, $1.1M */
export function compactMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const neg = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${neg}$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${neg}$${trim(abs / 1_000)}k`;
  return `${neg}$${Math.round(abs)}`;
}

function trim(n) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
}

/** 12.345 -> "12.3%"; sign adds + for positives */
export function percent(value, { sign = false, digits = 1 } = {}) {
  const n = Number(value) || 0;
  const body = `${Math.abs(n).toFixed(digits)}%`;
  if (n < 0) return `−${body}`;
  if (sign && n > 0) return `+${body}`;
  return body;
}

/** 1 -> 1st, 22 -> 22nd, 113 -> 113th */
export function ordinal(n) {
  const v = parseInt(n, 10);
  if (!v) return '';
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1: return `${v}st`;
    case 2: return `${v}nd`;
    case 3: return `${v}rd`;
    default: return `${v}th`;
  }
}

/**
 * Parse a YYYY-MM-DD string as a *local* date.
 * `new Date('2026-03-04')` is midnight UTC, which renders as March 3rd for
 * anyone west of London. Tournament dates are calendar days, not instants.
 */
export function parseDay(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> YYYY-MM-DD in local time */
export function toDayString(date) {
  const d = date instanceof Date ? date : parseDay(date);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString() {
  return toDayString(new Date());
}

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dayFmtShort = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

/** "Mar 4, 2026" – drops the year when it's the current year if short=true */
export function formatDay(value, { short = false } = {}) {
  const d = parseDay(value);
  if (!d) return '';
  if (short && d.getFullYear() === new Date().getFullYear()) return dayFmtShort.format(d);
  return dayFmt.format(d);
}

export function formatMonth(value) {
  const d = parseDay(value);
  return d ? monthFmt.format(d) : '';
}

/** "Mar 4 – Mar 18, 2026" */
export function formatDayRange(from, to) {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) return formatDay(from || to);
  if (a.getFullYear() === b.getFullYear()) {
    return `${dayFmtShort.format(a)} – ${dayFmt.format(b)}`;
  }
  return `${dayFmt.format(a)} – ${dayFmt.format(b)}`;
}

/** "3m", "2h", "5d", "Mar 4" */
export function timeAgo(value) {
  const d = value instanceof Date ? value : new Date(value);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return formatDay(d, { short: true });
}

export function fullName(profile) {
  if (!profile) return 'Unknown player';
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return name || (profile.username ? `@${profile.username}` : 'Unknown player');
}

export function initials(profile) {
  if (!profile) return '?';
  const a = (profile.first_name || '').trim().charAt(0);
  const b = (profile.last_name || '').trim().charAt(0);
  return (a + b).toUpperCase() || (profile.username || '?').charAt(0).toUpperCase();
}

export function pluralize(count, word, plural) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? word : plural || `${word}s`}`;
}
