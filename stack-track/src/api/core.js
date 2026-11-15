import { supabase } from '../supabaseClient';

// Which optional database features exist. Filled in once after sign-in by
// detectCapabilities(); every feature that needs the SQL migrations checks
// these flags so the app keeps working before the migrations are run.
const DEFAULT_CAPS = {
  profiles: false, // username, bio, home_venue, share_results on stacktrackmaster
  tournamentExtras: false, // entries, game_type, notes on tournaments
  notifications: false, // notifications table
  journeyLinks: false, // journey_tournaments.tournament_id
  catalog: false, // tournament catalog (migration 003)
  admin: false, // signed-in player can import official schedules
};

let caps = { ...DEFAULT_CAPS };

export function getCaps() {
  return caps;
}

async function probe(query) {
  try {
    const { error } = await query;
    return !error;
  } catch (e) {
    return false;
  }
}

export async function detectCapabilities() {
  const [profiles, tournamentExtras, notifications, journeyLinks, catalog] = await Promise.all([
    probe(supabase.from('stacktrackmaster').select('username,bio,home_venue,share_results').limit(1)),
    probe(supabase.from('tournaments').select('entries,game_type,notes').limit(1)),
    probe(supabase.from('notifications').select('id').limit(1)),
    probe(supabase.from('journey_tournaments').select('tournament_id').limit(1)),
    probe(supabase.from('tournaments').select('catalog_event_id').limit(1)),
  ]);
  let admin = false;
  if (catalog) {
    try {
      const { data } = await supabase.rpc('is_admin');
      admin = data === true;
    } catch (e) {
      admin = false;
    }
  }
  caps = { profiles, tournamentExtras, notifications, journeyLinks, catalog, admin };
  return caps;
}

export async function getUid() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new AppError('Your session has ended. Sign in again to continue.');
  return id;
}

export class AppError extends Error {}

/** Throw a readable error for a Supabase error object. */
export function check(error, fallback = 'Something went wrong. Try again.') {
  if (!error) return;
  // eslint-disable-next-line no-console
  console.error(error);
  if (error.code === '23505') throw new AppError('That already exists.');
  if (error.code === '42501') throw new AppError("You don't have permission to do that.");
  if (error.message && /fetch|network/i.test(error.message)) {
    throw new AppError("Can't reach StackTrack. Check your connection and try again.");
  }
  throw new AppError(fallback);
}

export const unique = (arr) => [...new Set(arr.filter(Boolean))];

/** Strip characters that would break a PostgREST filter string. */
export function sanitizeTerm(term) {
  return String(term || '').replace(/[%*,().:"'\\]/g, ' ').trim().slice(0, 40);
}
