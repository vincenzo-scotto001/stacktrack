import { supabase } from '../supabaseClient';
import { getCaps, getUid, check, AppError } from './core';
import { createActivity } from './feed';
import { hasResult } from '../lib/stats';

const BASE_FIELDS = ['tournament_name', 'date', 'location', 'buy_in', 'action_sold', 'place', 'winnings'];
const EXTRA_FIELDS = ['entries', 'game_type', 'notes'];

/** Validate and normalise form values into a row for the tournaments table. */
export function toRow(values) {
  const n = (v) => (v === '' || v == null ? null : Number(v));
  const name = String(values.tournament_name || '').trim();
  if (!name) throw new AppError('Add the tournament name.');
  if (!values.date) throw new AppError('Add the date you played.');
  const buyIn = n(values.buy_in);
  if (buyIn == null || Number.isNaN(buyIn) || buyIn < 0) throw new AppError('Buy-in must be zero or more.');
  const sold = n(values.action_sold) || 0;
  if (sold < 0 || sold > 100) throw new AppError('Action sold must be between 0 and 100%.');
  const winnings = n(values.winnings) || 0;
  if (winnings < 0) throw new AppError("Winnings can't be negative.");
  const place = n(values.place);
  if (place != null && (place < 1 || !Number.isInteger(place))) throw new AppError('Place must be a whole number, 1 or higher.');
  const entries = n(values.entries);
  if (entries != null && (entries < 1 || !Number.isInteger(entries))) throw new AppError('Entries must be a whole number.');
  if (place && entries && place > entries) throw new AppError("Your place can't be higher than the number of entries.");

  const row = {
    tournament_name: name,
    date: values.date,
    location: String(values.location || '').trim(),
    buy_in: buyIn,
    action_sold: sold,
    place: place || null,
    winnings,
  };
  if (getCaps().tournamentExtras) {
    row.entries = entries || null;
    row.game_type = values.game_type || null;
    row.notes = String(values.notes || '').trim() || null;
  }
  return row;
}

function pick(row) {
  const fields = getCaps().tournamentExtras ? [...BASE_FIELDS, ...EXTRA_FIELDS] : BASE_FIELDS;
  const out = {};
  fields.forEach((f) => {
    if (row[f] !== undefined) out[f] = row[f];
  });
  return out;
}

export async function listTournaments(userId) {
  const uid = userId || (await getUid());
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false });
  check(error, "Couldn't load tournaments.");
  return data || [];
}

export async function listTournamentsForUsers(userIds, { from } = {}) {
  if (!userIds.length) return [];
  let query = supabase.from('tournaments').select('*').in('user_id', userIds);
  if (from) query = query.gte('date', from);
  const { data, error } = await query.order('date', { ascending: false });
  check(error, "Couldn't load results.");
  return data || [];
}

export async function getTournament(id) {
  const uid = await getUid();
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).eq('user_id', uid).maybeSingle();
  check(error, "Couldn't load that tournament.");
  if (!data) throw new AppError("That tournament doesn't exist or isn't yours.");
  return data;
}

/** Create a tournament and post it to friends' feeds. */
export async function createTournament(values, { postToFeed = true } = {}) {
  const uid = await getUid();
  const row = { ...pick(toRow(values)), user_id: uid };
  const { data, error } = await supabase.from('tournaments').insert(row).select().single();
  check(error, "Couldn't save the tournament.");
  if (postToFeed) {
    try {
      await createActivity(hasResult(data) ? 'tournament_finished' : 'tournament_added', data.id);
    } catch (e) {
      // The tournament is saved; a missing feed post shouldn't block the user.
    }
  }
  return data;
}

export async function updateTournament(id, values, previous) {
  const uid = await getUid();
  const row = pick(toRow(values));
  const { data, error } = await supabase
    .from('tournaments')
    .update(row)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();
  check(error, "Couldn't save your changes.");
  // Adding a result to a shared registration posts the result once. If the
  // registration wasn't shared ("Share with friends" off), stay quiet.
  if (previous && !hasResult(previous) && hasResult(data)) {
    try {
      const { data: posts } = await supabase
        .from('activity_feed')
        .select('activity_type')
        .eq('tournament_id', id);
      const types = (posts || []).map((p) => p.activity_type);
      if (types.includes('tournament_added') && !types.includes('tournament_finished')) {
        await createActivity('tournament_finished', id);
      }
    } catch (e) {
      // non-blocking
    }
  }
  return data;
}

async function deleteActivitiesFor(tournamentIds) {
  const { data: acts } = await supabase.from('activity_feed').select('id').in('tournament_id', tournamentIds);
  const ids = (acts || []).map((a) => a.id);
  if (!ids.length) return;
  await supabase.from('activity_likes').delete().in('activity_id', ids);
  await supabase.from('activity_comments').delete().in('activity_id', ids);
  await supabase.from('activity_feed').delete().in('id', ids);
}

export async function deleteTournaments(ids) {
  const uid = await getUid();
  if (!ids.length) return;
  // Feed posts point at tournaments; remove them first so the delete never
  // trips a foreign key and friends don't see posts for deleted results.
  try {
    await deleteActivitiesFor(ids);
  } catch (e) {
    // fall through; the delete below reports real failures
  }
  const { error } = await supabase.from('tournaments').delete().in('id', ids).eq('user_id', uid);
  check(error, "Couldn't delete those tournaments.");
}

/** Bulk insert from a CSV import. Imports don't post to the feed. */
export async function importTournaments(rows) {
  const uid = await getUid();
  const payload = rows.map((r) => ({ ...pick(r), user_id: uid }));
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await supabase.from('tournaments').insert(payload.slice(i, i + 200));
    check(error, `Imported ${i} rows, then hit an error. Check the file and try again.`);
  }
  return payload.length;
}
