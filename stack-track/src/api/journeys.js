import { supabase } from '../supabaseClient';
import { getCaps, getUid, check, AppError } from './core';
import { createActivity } from './feed';
import { createTournament, updateTournament, deleteTournaments, importTournaments } from './tournaments';
import { summarize } from '../lib/stats';

const EVENT_FIELDS = ['tournament_name', 'date', 'location', 'buy_in', 'action_sold', 'notes', 'is_completed', 'place', 'winnings'];

function cleanEvent(e) {
  const n = (v) => (v === '' || v == null ? null : Number(v));
  if (!String(e.tournament_name || '').trim()) throw new AppError('Every event needs a name.');
  if (!e.date) throw new AppError(`Add a date for ${e.tournament_name}.`);
  const buyIn = n(e.buy_in);
  if (buyIn == null || Number.isNaN(buyIn) || buyIn < 0) throw new AppError(`Add a buy-in for ${e.tournament_name}.`);
  const sold = n(e.action_sold) || 0;
  if (sold < 0 || sold > 100) throw new AppError('Action sold must be between 0 and 100%.');
  const done = !!e.is_completed;
  const place = n(e.place);
  return {
    tournament_name: String(e.tournament_name).trim(),
    date: e.date,
    location: String(e.location || '').trim(),
    buy_in: buyIn,
    action_sold: sold,
    notes: String(e.notes || '').trim(),
    is_completed: done,
    place: done && place ? Math.round(place) : null,
    winnings: done ? n(e.winnings) || 0 : 0,
  };
}

function validateJourney(j) {
  if (!String(j.name || '').trim()) throw new AppError('Name your journey.');
  if (!j.start_date || !j.end_date) throw new AppError('Add start and end dates.');
  if (j.start_date > j.end_date) throw new AppError('The start date has to be on or before the end date.');
}

export async function listJourneys() {
  const uid = await getUid();
  const { data, error } = await supabase
    .from('journeys')
    .select('*')
    .eq('user_id', uid)
    .order('start_date', { ascending: false });
  check(error, "Couldn't load your journeys.");
  const journeys = data || [];
  if (!journeys.length) return [];
  const { data: events, error: evError } = await supabase
    .from('journey_tournaments')
    .select('*')
    .in('journey_id', journeys.map((j) => j.id))
    .order('date', { ascending: true });
  check(evError, "Couldn't load journey events.");
  return journeys.map((j) => ({ ...j, events: (events || []).filter((e) => e.journey_id === j.id) }));
}

export async function getJourney(id) {
  const uid = await getUid();
  const { data, error } = await supabase.from('journeys').select('*').eq('id', id).eq('user_id', uid).maybeSingle();
  check(error, "Couldn't load that journey.");
  if (!data) throw new AppError("That journey doesn't exist or isn't yours.");
  const { data: events, error: evError } = await supabase
    .from('journey_tournaments')
    .select('*')
    .eq('journey_id', id)
    .order('date', { ascending: true });
  check(evError, "Couldn't load journey events.");
  return { ...data, events: events || [] };
}

export async function createJourney(journey, events) {
  const uid = await getUid();
  validateJourney(journey);
  if (!events.length) throw new AppError('Add at least one event.');
  const rows = events.map(cleanEvent);
  const outside = rows.find((r) => r.date < journey.start_date || r.date > journey.end_date);
  if (outside) throw new AppError(`${outside.tournament_name} is outside the journey dates.`);

  const { data, error } = await supabase
    .from('journeys')
    .insert({
      user_id: uid,
      name: journey.name.trim(),
      start_date: journey.start_date,
      end_date: journey.end_date,
      is_completed: false,
      total_buy_ins: rows.reduce((s, r) => s + r.buy_in, 0),
    })
    .select()
    .single();
  check(error, "Couldn't create the journey.");
  const { error: evError } = await supabase
    .from('journey_tournaments')
    .insert(rows.map((r) => ({ ...r, journey_id: data.id })));
  if (evError) {
    await supabase.from('journeys').delete().eq('id', data.id);
    check(evError, "Couldn't save the events.");
  }
  try {
    await createActivity('journey_created', null, { journey_name: data.name, events: rows.length });
  } catch (e) {
    // optional
  }
  return data;
}

export async function updateJourneyDetails(id, patch) {
  const uid = await getUid();
  validateJourney(patch);
  const { error } = await supabase
    .from('journeys')
    .update({ name: patch.name.trim(), start_date: patch.start_date, end_date: patch.end_date })
    .eq('id', id)
    .eq('user_id', uid);
  check(error, "Couldn't save the journey.");
}

export async function deleteJourney(id) {
  const uid = await getUid();
  const { error: evError } = await supabase.from('journey_tournaments').delete().eq('journey_id', id);
  check(evError, "Couldn't delete the journey's events.");
  const { error } = await supabase.from('journeys').delete().eq('id', id).eq('user_id', uid);
  check(error, "Couldn't delete the journey.");
}

function trackerValues(e) {
  return {
    tournament_name: e.tournament_name,
    date: e.date,
    location: e.location,
    buy_in: e.buy_in,
    action_sold: e.action_sold,
    place: e.place,
    winnings: e.winnings,
    notes: e.notes,
  };
}

/** Recalculate totals; returns the updated journey row. */
async function refreshTotals(journey) {
  const { data: events } = await supabase.from('journey_tournaments').select('*').eq('journey_id', journey.id);
  const list = events || [];
  const allDone = list.length > 0 && list.every((e) => e.is_completed);
  const patch = { total_buy_ins: list.reduce((s, e) => s + (Number(e.buy_in) || 0), 0), is_completed: allDone };
  await supabase.from('journeys').update(patch).eq('id', journey.id);

  // Without per-event links (migration not run) keep the original behaviour:
  // when the last event is completed, copy the whole journey to the tracker.
  if (!getCaps().journeyLinks && allDone && !journey.is_completed) {
    await importTournaments(list.map(trackerValues));
  }
  if (allDone && !journey.is_completed) {
    const s = summarize(list);
    try {
      await createActivity('journey_completed', null, { journey_name: journey.name, events: list.length, net: Math.round(s.net) });
    } catch (e) {
      // optional
    }
  }
  return { ...journey, ...patch };
}

/**
 * Save one event (insert when it has no id). With migration 001, completed
 * events are copied to the tracker immediately and kept in sync.
 */
export async function saveEvent(journey, event, previous) {
  const row = cleanEvent(event);
  if (row.date < journey.start_date || row.date > journey.end_date) {
    throw new AppError('Event dates have to fall inside the journey dates.');
  }
  let saved;
  if (event.id) {
    const { data, error } = await supabase.from('journey_tournaments').update(row).eq('id', event.id).select().single();
    check(error, "Couldn't save the event.");
    saved = data;
  } else {
    const { data, error } = await supabase.from('journey_tournaments').insert({ ...row, journey_id: journey.id }).select().single();
    check(error, "Couldn't add the event.");
    saved = data;
  }

  if (getCaps().journeyLinks) {
    const linked = saved.tournament_id;
    if (saved.is_completed && linked) {
      await updateTournament(linked, trackerValues(saved), previous ? trackerValues(previous) : null);
    } else if (saved.is_completed && !linked) {
      const t = await createTournament(trackerValues(saved));
      await supabase.from('journey_tournaments').update({ tournament_id: t.id }).eq('id', saved.id);
      saved = { ...saved, tournament_id: t.id };
    } else if (!saved.is_completed && linked) {
      await deleteTournaments([linked]);
      await supabase.from('journey_tournaments').update({ tournament_id: null }).eq('id', saved.id);
      saved = { ...saved, tournament_id: null };
    }
  }
  const updatedJourney = await refreshTotals(journey);
  return { event: saved, journey: updatedJourney };
}

export async function deleteEvent(journey, event) {
  const { error } = await supabase.from('journey_tournaments').delete().eq('id', event.id);
  check(error, "Couldn't delete the event.");
  return refreshTotals(journey);
}

export { EVENT_FIELDS };
