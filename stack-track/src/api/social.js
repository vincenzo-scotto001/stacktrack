import { supabase } from '../supabaseClient';
import { getCaps, getUid, check } from './core';
import { getProfiles, sharesResults } from './profiles';
import { getFriendIds } from './friends';
import { listTournamentsForUsers } from './tournaments';
import { summarize, rangeBounds } from '../lib/stats';
import { toDayString } from '../lib/format';

/** You + friends ranked over a period. Players with private results are listed but not ranked. */
export async function getLeaderboard(preset = 'ytd') {
  const uid = await getUid();
  const ids = [uid, ...(await getFriendIds())];
  const { from } = rangeBounds(preset);
  const [profiles, tournaments] = await Promise.all([
    getProfiles(ids),
    listTournamentsForUsers(ids, { from: from ? toDayString(from) : undefined }),
  ]);
  const rows = ids.map((id) => {
    const profile = profiles[id] || null;
    const hidden = id !== uid && !sharesResults(profile);
    const stats = hidden ? null : summarize(tournaments.filter((t) => t.user_id === id));
    return { id, profile, isMe: id === uid, hidden, stats };
  });
  return rows;
}

export async function listNotifications() {
  if (!getCaps().notifications) return [];
  const uid = await getUid();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, actor_id, type, activity_id, read_at, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(60);
  check(error, "Couldn't load notifications.");
  const profiles = await getProfiles((data || []).map((n) => n.actor_id));
  return (data || []).map((n) => ({ ...n, actor: profiles[n.actor_id] || null }));
}

export async function unreadNotificationCount() {
  if (!getCaps().notifications) return 0;
  const uid = await getUid();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .is('read_at', null);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationsRead() {
  if (!getCaps().notifications) return;
  const uid = await getUid();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null);
}
