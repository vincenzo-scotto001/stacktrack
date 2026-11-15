import { supabase } from '../supabaseClient';
import { getCaps, check, AppError } from './core';

function normalize(r) {
  return {
    ...r,
    key: `c:${r.id}`,
    buy_in: r.buy_in == null ? null : Number(r.buy_in),
    guarantee: r.guarantee == null ? null : Number(r.guarantee),
  };
}

/** Catalog entries matching what the player typed, ranked for the given date. */
export async function searchCatalog(q, onDate) {
  if (!getCaps().catalog || String(q || '').trim().length < 2) return [];
  const { data, error } = await supabase.rpc('search_catalog', { q: q.trim(), on_date: onDate || null, max_results: 8 });
  if (error) {
    // Suggestions are a convenience; never block typing on them.
    // eslint-disable-next-line no-console
    console.error(error);
    return [];
  }
  return (data || []).map(normalize);
}

export async function searchSeries(q = '') {
  if (!getCaps().catalog) return [];
  const { data, error } = await supabase.rpc('search_series', { q: q.trim(), max_results: 12 });
  check(error, "Couldn't search schedules.");
  return data || [];
}

export async function getSeries(id) {
  const [{ data: series, error }, { data: events, error: evError }] = await Promise.all([
    supabase.from('catalog_series').select('*').eq('id', id).maybeSingle(),
    supabase.from('catalog_events').select('*').eq('series_id', id)
      .order('event_date', { ascending: true }).order('start_time', { ascending: true }),
  ]);
  check(error || evError, "Couldn't load that schedule.");
  if (!series) throw new AppError('That schedule was deleted.');
  return { ...series, events: (events || []).map(normalize) };
}

// ---------- Admin: official schedules ----------

export async function createSeries(values) {
  const name = String(values.name || '').trim();
  if (name.length < 2) throw new AppError('Name the series.');
  if (values.start_date && values.end_date && values.start_date > values.end_date) {
    throw new AppError('The start date has to be on or before the end date.');
  }
  const { data, error } = await supabase
    .from('catalog_series')
    .insert({
      name,
      venue: String(values.venue || '').trim(),
      city: String(values.city || '').trim() || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      source_url: String(values.source_url || '').trim() || null,
    })
    .select()
    .single();
  check(error, "Couldn't create the series. Check you're an admin.");
  return data;
}

export async function deleteSeries(id) {
  const { error } = await supabase.from('catalog_series').delete().eq('id', id);
  check(error, "Couldn't delete the series.");
}

export async function deleteCatalogEvent(id) {
  const { error } = await supabase.from('catalog_events').delete().eq('id', id).eq('source', 'official');
  check(error, "Couldn't delete the event.");
}

const eventKey = (e) => `${String(e.name).trim().toLowerCase()}|${e.event_date || `w${e.weekday ?? 'd'}`}|${String(e.start_time || '').slice(0, 5)}`;

/** Add imported schedule rows to a series, skipping events it already has. */
export async function addSeriesEvents(series, rows) {
  const existing = new Set((series.events || []).map(eventKey));
  const fresh = rows.filter((r) => !existing.has(eventKey(r)));
  const payload = fresh.map((r) => ({
    series_id: series.id,
    source: 'official',
    name: r.name,
    venue: r.venue || series.venue || '',
    event_date: r.event_date,
    weekday: r.weekday,
    start_time: r.start_time,
    buy_in: r.buy_in,
    game_type: r.game_type,
    guarantee: r.guarantee,
  }));
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await supabase.from('catalog_events').insert(payload.slice(i, i + 200));
    check(error, `Added ${i} events, then hit an error. Check you're an admin.`);
  }
  return { added: payload.length, skipped: rows.length - payload.length };
}

export { eventKey };
