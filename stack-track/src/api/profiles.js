import { supabase } from '../supabaseClient';
import { getCaps, getUid, check, unique, sanitizeTerm, AppError } from './core';

// Never select email or phone for other players.
export function profileColumns() {
  return getCaps().profiles
    ? 'id, first_name, last_name, username, bio, home_venue, share_results'
    : 'id, first_name, last_name';
}

const cache = new Map();

export function clearProfileCache() {
  cache.clear();
}

export async function getProfiles(ids) {
  const wanted = unique(ids);
  const missing = wanted.filter((id) => !cache.has(id));
  if (missing.length) {
    const { data, error } = await supabase.from('stacktrackmaster').select(profileColumns()).in('id', missing);
    check(error, "Couldn't load players.");
    (data || []).forEach((p) => cache.set(p.id, p));
  }
  const map = {};
  wanted.forEach((id) => {
    if (cache.has(id)) map[id] = cache.get(id);
  });
  return map;
}

export async function getProfile(id) {
  const map = await getProfiles([id]);
  return map[id] || null;
}

/** Results are visible unless the player has turned sharing off. */
export function sharesResults(profile) {
  return !profile || profile.share_results !== false;
}

/**
 * Load the signed-in player's profile, creating it from sign-up metadata if
 * the row is missing (the old app crashed on the dashboard in that case).
 */
export async function ensureOwnProfile(user) {
  const { data, error } = await supabase
    .from('stacktrackmaster')
    .select(profileColumns())
    .eq('id', user.id)
    .maybeSingle();
  check(error, "Couldn't load your profile.");
  if (data) {
    cache.set(data.id, data);
    return data;
  }

  const meta = user.user_metadata || {};
  const row = {
    id: user.id,
    first_name: meta.first_name || (user.email || 'Player').split('@')[0],
    last_name: meta.last_name || '',
    email: user.email,
    phone_number: meta.phone_number || null,
    datetime: new Date().toISOString(),
  };
  const { error: insertError } = await supabase.from('stacktrackmaster').insert(row);
  if (insertError && insertError.code !== '23505') check(insertError, "Couldn't create your profile.");
  cache.delete(user.id);
  let created = await getProfile(user.id);
  // Username chosen at sign-up lives in auth metadata until the row exists.
  if (created && getCaps().profiles && !created.username && meta.username) {
    const { data: withName } = await supabase
      .from('stacktrackmaster')
      .update({ username: meta.username })
      .eq('id', user.id)
      .select(profileColumns())
      .maybeSingle();
    if (withName) {
      cache.set(user.id, withName);
      created = withName;
    }
  }
  return created;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function updateProfile(patch) {
  const uid = await getUid();
  const allowed = ['first_name', 'last_name'];
  if (getCaps().profiles) allowed.push('username', 'bio', 'home_venue', 'share_results');
  const clean = {};
  allowed.forEach((k) => {
    if (patch[k] !== undefined) clean[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  });
  if (clean.username !== undefined) {
    clean.username = clean.username.toLowerCase().replace(/^@/, '') || null;
    if (clean.username && !USERNAME_RE.test(clean.username)) {
      throw new AppError('Usernames are 3–20 characters: lowercase letters, numbers and underscores.');
    }
  }
  if (!clean.first_name) throw new AppError('Add your first name.');
  const { data, error } = await supabase
    .from('stacktrackmaster')
    .update(clean)
    .eq('id', uid)
    .select(profileColumns())
    .single();
  if (error && error.code === '23505') throw new AppError('That username is taken. Try another.');
  check(error, "Couldn't save your profile.");
  cache.set(uid, data);
  return data;
}

export async function searchPlayers(rawTerm) {
  const uid = await getUid();
  const term = sanitizeTerm(rawTerm);
  if (term.replace(/\s/g, '').length < 2) return [];
  const words = term.split(/\s+/).filter(Boolean);
  let query = supabase.from('stacktrackmaster').select(profileColumns()).neq('id', uid).limit(20);
  if (words.length >= 2) {
    query = query.ilike('first_name', `%${words[0]}%`).ilike('last_name', `%${words[words.length - 1]}%`);
  } else {
    const w = words[0].replace(/^@/, '');
    const parts = [`first_name.ilike.%${w}%`, `last_name.ilike.%${w}%`];
    if (getCaps().profiles) parts.push(`username.ilike.%${w}%`);
    query = query.or(parts.join(','));
  }
  const { data, error } = await query;
  check(error, "Couldn't search players.");
  (data || []).forEach((p) => cache.set(p.id, p));
  return data || [];
}
