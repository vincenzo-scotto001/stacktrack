// Pure helpers for tournament suggestions: your own history, merging with
// catalog results, and schedule labels. Unit tested.

import { formatDay } from './format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const identity = (name, venue, buyIn) => `${nameKey(name)}|${nameKey(venue)}|${Number(buyIn) || 0}`;

/** "19:00" or "19:00:00" → "7:00 PM" */
export function formatTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!m) return '';
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** When an entry runs: "Jan 12, 11:00 AM", "Every Monday, 7:00 PM", "Daily, 11:00 AM" or "" */
export function scheduleLabel(s) {
  const time = formatTime(s.start_time);
  let when = '';
  if (s.event_date) when = formatDay(s.event_date, { short: true });
  else if (s.weekday != null && s.weekday !== '') when = `Every ${DAYS[s.weekday]}`;
  else if (s.source === 'official') when = 'Daily';
  if (!when) return time;
  return time ? `${when}, ${time}` : when;
}

/** Distinct tournaments from your own history that match the typed words. */
export function historySuggestions(history, term, limit = 5) {
  const groups = new Map();
  (history || []).forEach((t) => {
    if (!t.tournament_name) return;
    const key = identity(t.tournament_name, t.location, t.buy_in);
    const g = groups.get(key) || {
      key: `h:${key}`,
      source: 'history',
      name: t.tournament_name.trim().replace(/\s+/g, ' '),
      venue: t.location || '',
      buy_in: Number(t.buy_in) || 0,
      game_type: t.game_type || null,
      count: 0,
      last_played: t.date,
    };
    g.count += 1;
    if (t.date > g.last_played) g.last_played = t.date;
    groups.set(key, g);
  });
  const words = nameKey(term).split(' ').filter(Boolean);
  const list = [...groups.values()].filter((g) => {
    const hay = `${nameKey(g.name)} ${nameKey(g.venue)}`;
    return words.every((w) => hay.includes(w));
  });
  const starts = (g) => (words.length && nameKey(g.name).startsWith(words[0]) ? 1 : 0);
  list.sort((a, b) => starts(b) - starts(a) || b.count - a.count || String(b.last_played).localeCompare(String(a.last_played)));
  return list.slice(0, limit);
}

/** Catalog results first (already ranked), then history entries the catalog didn't cover. */
export function mergeSuggestions(catalog, history, limit = 8) {
  const seen = new Set((catalog || []).map((c) => identity(c.name, c.venue, c.buy_in)));
  const extra = (history || []).filter((h) => !seen.has(identity(h.name, h.venue, h.buy_in)));
  return [...(catalog || []), ...extra].slice(0, limit);
}

/** Form values to fill in when a suggestion is picked. */
export function fillFromSuggestion(s, current) {
  return {
    tournament_name: s.name,
    location: s.venue || '',
    buy_in: s.buy_in != null ? String(s.buy_in) : current.buy_in,
    game_type: s.game_type || current.game_type,
    date: s.event_date || current.date,
    catalog_event_id: s.source === 'history' ? null : s.id,
  };
}
