// Pure poker math. No React, no Supabase — everything here is unit tested.
//
// Money model (matches how backing works in tournament poker):
//   buy_in       – what the player paid in total (include re-entries)
//   winnings     – gross amount paid out by the tournament
//   action_sold  – % of the player's action sold to backers at 1.0 markup.
//                  Backers pay that share of the buy-in and receive that share
//                  of the winnings, so the player's own result is
//                  (winnings − buy_in) × (1 − sold).

import { parseDay, toDayString, formatDay, formatMonth } from './format';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Attach derived money fields to a tournament row. */
export function enrich(t) {
  const buyIn = num(t.buy_in);
  const cash = num(t.winnings);
  const sold = clamp(num(t.action_sold), 0, 100) / 100;
  const keep = 1 - sold;
  const cost = buyIn * keep;
  const payout = cash * keep;
  const place = t.place ? parseInt(t.place, 10) || null : null;
  return {
    ...t,
    buyIn,
    cash,
    sold,
    cost,
    payout,
    net: payout - cost,
    cashed: cash > 0,
    place,
    day: parseDay(t.date),
  };
}

/** Player's own result for one tournament, after action sold. */
export function netResult(t) {
  return enrich(t).net;
}

export function hasResult(t) {
  return num(t.winnings) > 0 || !!t.place;
}

function byDate(a, b) {
  const da = a.day ? a.day.getTime() : 0;
  const db = b.day ? b.day.getTime() : 0;
  if (da !== db) return da - db;
  const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
  const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (ca !== cb) return ca - cb;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

/** Enrich and sort oldest → newest. */
export function prepare(tournaments) {
  return (tournaments || []).map(enrich).sort(byDate);
}

const EMPTY_SUMMARY = Object.freeze({
  count: 0,
  volume: 0,
  cost: 0,
  payout: 0,
  net: 0,
  roi: 0,
  cashes: 0,
  itm: 0,
  wins: 0,
  topNine: 0,
  biggestCash: null,
  bestResult: null,
  worstResult: null,
  avgBuyIn: 0,
  avgCash: 0,
  avgNet: 0,
  stdDev: 0,
  median: 0,
  longestCashStreak: 0,
  longestDryStreak: 0,
  currentStreak: { type: null, length: 0 },
  maxDrawdown: 0,
  soldValue: 0,
});

/** Every headline number on the stats page, from a list of tournaments. */
export function summarize(tournaments) {
  const list = prepare(tournaments);
  const count = list.length;
  if (!count) return { ...EMPTY_SUMMARY };

  let volume = 0;
  let cost = 0;
  let payout = 0;
  let cashes = 0;
  let wins = 0;
  let topNine = 0;
  let cashTotal = 0;
  let soldValue = 0;
  let biggestCash = null;
  let bestResult = null;
  let worstResult = null;

  let run = 0;
  let longestCashStreak = 0;
  let longestDryStreak = 0;
  let streakType = null;

  let cum = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const t of list) {
    volume += t.buyIn;
    cost += t.cost;
    payout += t.payout;
    soldValue += t.buyIn * t.sold;
    if (t.cashed) {
      cashes += 1;
      cashTotal += t.cash;
      if (!biggestCash || t.cash > biggestCash.cash) biggestCash = t;
      if (t.place && t.place <= 9) topNine += 1;
    }
    if (t.place === 1) wins += 1;
    if (!bestResult || t.net > bestResult.net) bestResult = t;
    if (!worstResult || t.net < worstResult.net) worstResult = t;

    const type = t.cashed ? 'cash' : 'dry';
    if (type === streakType) run += 1;
    else {
      streakType = type;
      run = 1;
    }
    if (type === 'cash') longestCashStreak = Math.max(longestCashStreak, run);
    else longestDryStreak = Math.max(longestDryStreak, run);

    cum += t.net;
    peak = Math.max(peak, cum);
    maxDrawdown = Math.max(maxDrawdown, peak - cum);
  }

  const net = payout - cost;
  const nets = list.map((t) => t.net);
  const avgNet = net / count;
  const variance = nets.reduce((s, n) => s + (n - avgNet) ** 2, 0) / count;
  const sorted = [...nets].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    count,
    volume,
    cost,
    payout,
    net,
    roi: cost > 0 ? (net / cost) * 100 : 0,
    cashes,
    itm: (cashes / count) * 100,
    wins,
    topNine,
    biggestCash,
    bestResult,
    worstResult,
    avgBuyIn: volume / count,
    avgCash: cashes ? cashTotal / cashes : 0,
    avgNet,
    stdDev: Math.sqrt(variance),
    median,
    longestCashStreak,
    longestDryStreak,
    currentStreak: { type: streakType, length: run },
    maxDrawdown,
    soldValue,
  };
}

/** Running total of net results, one point per tournament (plus a zero start). */
export function cumulativeSeries(tournaments) {
  const list = prepare(tournaments);
  let cum = 0;
  const points = [{ index: 0, cum: 0, net: 0, label: 'Start', name: '' }];
  list.forEach((t, i) => {
    cum += t.net;
    points.push({
      index: i + 1,
      cum: round2(cum),
      net: round2(t.net),
      date: toDayString(t.day),
      label: formatDay(t.day, { short: true }),
      name: t.tournament_name,
    });
  });
  return points;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

/** Net result grouped by week, month or year, oldest first. */
export function periodSeries(tournaments, unit = 'month') {
  const groups = new Map();
  for (const t of prepare(tournaments)) {
    if (!t.day) continue;
    let key;
    let label;
    let start;
    if (unit === 'year') {
      key = String(t.day.getFullYear());
      label = key;
      start = new Date(t.day.getFullYear(), 0, 1);
    } else if (unit === 'week') {
      start = weekStart(t.day);
      key = toDayString(start);
      label = formatDay(start, { short: true });
    } else {
      start = new Date(t.day.getFullYear(), t.day.getMonth(), 1);
      key = toDayString(start).slice(0, 7);
      label = formatMonth(start);
    }
    const g = groups.get(key) || { key, label, start, net: 0, cost: 0, count: 0 };
    g.net += t.net;
    g.cost += t.cost;
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.start - b.start)
    .map(({ start, ...g }) => ({ ...g, net: round2(g.net), roi: g.cost ? (g.net / g.cost) * 100 : 0 }));
}

/** Group tournaments by any key and return per-group results. */
export function breakdown(tournaments, keyFn, { sortBy = 'count' } = {}) {
  const groups = new Map();
  for (const t of prepare(tournaments)) {
    const k = keyFn(t);
    if (k == null || k === '') continue;
    const key = typeof k === 'object' ? k.key : k;
    const label = typeof k === 'object' ? k.label : k;
    const order = typeof k === 'object' ? k.order : 0;
    const g = groups.get(key) || { key, label, order, count: 0, cost: 0, net: 0, cashes: 0 };
    g.count += 1;
    g.cost += t.cost;
    g.net += t.net;
    if (t.cashed) g.cashes += 1;
    groups.set(key, g);
  }
  const rows = [...groups.values()].map((g) => ({
    ...g,
    roi: g.cost ? (g.net / g.cost) * 100 : 0,
    itm: g.count ? (g.cashes / g.count) * 100 : 0,
  }));
  if (sortBy === 'order') rows.sort((a, b) => a.order - b.order);
  else if (sortBy === 'net') rows.sort((a, b) => b.net - a.net);
  else rows.sort((a, b) => b.count - a.count || b.net - a.net);
  return rows;
}

export const BUY_IN_BUCKETS = [
  { max: 100, label: 'Under $100' },
  { max: 300, label: '$100–$299' },
  { max: 1000, label: '$300–$999' },
  { max: 5000, label: '$1k–$4.9k' },
  { max: Infinity, label: '$5k and up' },
];

export function buyInBucket(t) {
  const b = num(t.buyIn ?? t.buy_in);
  const i = BUY_IN_BUCKETS.findIndex((x) => b < x.max);
  return { key: `b${i}`, label: BUY_IN_BUCKETS[i].label, order: i };
}

export const RANGE_PRESETS = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'ytd', label: 'This year' },
  { id: '1y', label: '12 months' },
  { id: 'all', label: 'All time' },
];

/** Resolve a preset id to inclusive {from, to} dates (null = unbounded). */
export function rangeBounds(preset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d;
  };
  switch (preset) {
    case '30d': return { from: back(29), to: null };
    case '90d': return { from: back(89), to: null };
    case 'ytd': return { from: new Date(today.getFullYear(), 0, 1), to: null };
    case '1y': return { from: back(364), to: null };
    case 'month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: null };
    default: return { from: null, to: null };
  }
}

/** Filter by a preset id or an explicit {from, to} (YYYY-MM-DD strings or Dates). */
export function filterByRange(tournaments, range, now = new Date()) {
  const { from, to } = typeof range === 'string'
    ? rangeBounds(range, now)
    : { from: parseDay(range?.from), to: parseDay(range?.to) };
  if (!from && !to) return tournaments || [];
  return (tournaments || []).filter((t) => {
    const d = parseDay(t.date);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}
