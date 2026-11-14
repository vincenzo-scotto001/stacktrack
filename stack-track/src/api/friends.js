import { supabase } from '../supabaseClient';
import { getUid, check, AppError, unique } from './core';
import { getProfiles, profileColumns, getProfile } from './profiles';
import { fullName } from '../lib/format';

/** All of the signed-in player's friendships in one query. */
export async function getConnections() {
  const uid = await getUid();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
  check(error, "Couldn't load your friends.");
  const rows = data || [];
  const otherId = (r) => (r.user_id === uid ? r.friend_id : r.user_id);
  const profiles = await getProfiles(rows.map(otherId));
  const withProfile = (r) => ({ requestId: r.id, id: otherId(r), since: r.created_at, profile: profiles[otherId(r)] || null });

  const byName = (a, b) => fullName(a.profile).localeCompare(fullName(b.profile));
  return {
    friends: rows.filter((r) => r.status === 'accepted').map(withProfile).sort(byName),
    incoming: rows.filter((r) => r.status === 'pending' && r.friend_id === uid).map(withProfile),
    outgoing: rows.filter((r) => r.status === 'pending' && r.user_id === uid).map(withProfile),
  };
}

export async function getFriendIds() {
  const uid = await getUid();
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
  check(error, "Couldn't load your friends.");
  return unique((data || []).map((r) => (r.user_id === uid ? r.friend_id : r.user_id)));
}

/** 'self' | 'friends' | 'incoming' | 'outgoing' | 'none' */
export async function getRelationship(otherId) {
  const uid = await getUid();
  if (otherId === uid) return { status: 'self' };
  const { data, error } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status')
    .or(`and(user_id.eq.${uid},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${uid})`)
    .limit(1);
  check(error, "Couldn't check your connection.");
  const row = data && data[0];
  if (!row) return { status: 'none' };
  if (row.status === 'accepted') return { status: 'friends', requestId: row.id };
  return { status: row.user_id === uid ? 'outgoing' : 'incoming', requestId: row.id };
}

export async function sendFriendRequest(friendId) {
  const uid = await getUid();
  const rel = await getRelationship(friendId);
  if (rel.status === 'friends') throw new AppError("You're already friends.");
  if (rel.status === 'outgoing') throw new AppError('Request already sent.');
  if (rel.status === 'incoming') return acceptFriendRequest(rel.requestId);
  const { error } = await supabase.from('friendships').insert({ user_id: uid, friend_id: friendId, status: 'pending' });
  check(error, "Couldn't send the request.");
  return 'sent';
}

export async function acceptFriendRequest(requestId) {
  const uid = await getUid();
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('friend_id', uid)
    .select('user_id')
    .single();
  check(error, "Couldn't accept the request.");
  try {
    const friend = await getProfile(data.user_id);
    await supabase.from('activity_feed').insert({
      user_id: uid,
      activity_type: 'friend_joined',
      tournament_id: null,
      metadata: { friend_id: data.user_id, friend_name: fullName(friend) },
    });
  } catch (e) {
    // feed post is optional
  }
  return 'accepted';
}

/** Decline an incoming request or cancel an outgoing one. */
export async function deleteFriendRequest(requestId) {
  const uid = await getUid();
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', requestId)
    .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
  check(error, "Couldn't update the request.");
}

export async function removeFriend(friendId) {
  const uid = await getUid();
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${uid},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${uid})`);
  check(error, "Couldn't remove that friend.");
}

/**
 * Friends of friends ranked by mutual friends. Falls back to recently joined
 * players when friendships of others aren't readable.
 */
export async function getSuggestions() {
  const uid = await getUid();
  // friend_suggestions() comes from migration 002. Row-level security stops
  // players reading other people's friendships, so mutual friends are
  // counted on the server.
  try {
    const { data: rpc, error: rpcError } = await supabase.rpc('friend_suggestions');
    if (!rpcError && Array.isArray(rpc) && rpc.length) {
      const profiles = await getProfiles(rpc.map((r) => r.id));
      return rpc.filter((r) => profiles[r.id]).map((r) => ({ id: r.id, profile: profiles[r.id], mutual: r.mutual || 0 }));
    }
  } catch (e) {
    // fall through to the client-side version
  }
  const { data: mine } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
  const connected = new Set([uid, ...(mine || []).flatMap((r) => [r.user_id, r.friend_id])]);
  const friendIds = unique(
    (mine || []).map((r) => (r.user_id === uid ? r.friend_id : r.user_id)),
  );

  const mutual = new Map();
  if (friendIds.length) {
    const list = friendIds.join(',');
    const { data: theirs } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.in.(${list}),friend_id.in.(${list})`);
    (theirs || []).forEach((r) => {
      [[r.user_id, r.friend_id], [r.friend_id, r.user_id]].forEach(([a, b]) => {
        if (friendIds.includes(a) && !connected.has(b)) mutual.set(b, (mutual.get(b) || 0) + 1);
      });
    });
  }

  let ids = [...mutual.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 8);
  if (ids.length < 6) {
    const { data: recent } = await supabase
      .from('stacktrackmaster')
      .select(profileColumns())
      .order('datetime', { ascending: false })
      .limit(30);
    (recent || []).forEach((p) => {
      if (!connected.has(p.id) && !ids.includes(p.id) && ids.length < 8) ids.push(p.id);
    });
  }
  const profiles = await getProfiles(ids);
  return ids.filter((id) => profiles[id]).map((id) => ({ id, profile: profiles[id], mutual: mutual.get(id) || 0 }));
}
