import { supabase } from '../supabaseClient';
import { getCaps, getUid, check, unique, AppError } from './core';
import { getProfiles, sharesResults } from './profiles';
import { getFriendIds } from './friends';

export async function createActivity(type, tournamentId = null, metadata = {}) {
  const uid = await getUid();
  const { data, error } = await supabase
    .from('activity_feed')
    .insert({ user_id: uid, activity_type: type, tournament_id: tournamentId, metadata })
    .select()
    .single();
  check(error, "Couldn't post to your feed.");
  return data;
}

function tournamentColumns() {
  const base = 'id, tournament_name, date, location, buy_in, action_sold, place, winnings';
  return getCaps().tournamentExtras ? `${base}, entries, game_type` : base;
}

/**
 * One page of the feed with authors, tournaments, like and comment counts —
 * 5 queries total instead of 2 extra queries per post.
 * @param {{ limit?: number, before?: string, userIds?: string[] }} opts
 *   userIds – restrict to these authors (defaults to you + your friends)
 */
export async function listFeed({ limit = 15, before, userIds } = {}) {
  const uid = await getUid();
  const authors = userIds || [uid, ...(await getFriendIds())];
  let query = supabase
    .from('activity_feed')
    .select('id, user_id, activity_type, tournament_id, metadata, created_at')
    .in('user_id', authors)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  check(error, "Couldn't load the feed.");
  const acts = data || [];
  if (!acts.length) return { items: [], hasMore: false };

  const items = await hydrate(acts, uid);
  return { items, hasMore: acts.length === limit };
}

async function hydrate(acts, uid) {
  const ids = acts.map((a) => a.id);
  const tIds = unique(acts.map((a) => a.tournament_id));
  const [profiles, tRes, likeRes, commentRes] = await Promise.all([
    getProfiles(acts.map((a) => a.user_id)),
    tIds.length ? supabase.from('tournaments').select(tournamentColumns()).in('id', tIds) : { data: [] },
    supabase.from('activity_likes').select('activity_id, user_id').in('activity_id', ids),
    supabase.from('activity_comments').select('activity_id').in('activity_id', ids),
  ]);
  const tournaments = Object.fromEntries((tRes.data || []).map((t) => [t.id, t]));
  const likes = likeRes.data || [];
  const comments = commentRes.data || [];

  const items = acts.map((a) => {
    const profile = profiles[a.user_id] || null;
    const t = a.tournament_id ? tournaments[a.tournament_id] || null : null;
    const visible = a.user_id === uid || sharesResults(profile);
    return {
      id: a.id,
      userId: a.user_id,
      isMine: a.user_id === uid,
      profile,
      type: a.activity_type,
      // Private players' tournament details stay hidden, matching the
      // database rules in migration 002 (row-level security).
      tournament: visible ? t : null,
      showResults: visible,
      metadata: a.metadata || {},
      createdAt: a.created_at,
      likeCount: likes.filter((l) => l.activity_id === a.id).length,
      likedByMe: likes.some((l) => l.activity_id === a.id && l.user_id === uid),
      commentCount: comments.filter((c) => c.activity_id === a.id).length,
    };
  });
  return items;
}

/** A single post, for links from notifications. */
export async function getActivity(id) {
  const uid = await getUid();
  const { data, error } = await supabase
    .from('activity_feed')
    .select('id, user_id, activity_type, tournament_id, metadata, created_at')
    .eq('id', id)
    .maybeSingle();
  check(error, "Couldn't load that post.");
  if (!data) throw new AppError('That post was deleted or isn’t visible to you.');
  const [item] = await hydrate([data], uid);
  return item;
}

export async function setLiked(activityId, liked) {
  const uid = await getUid();
  if (liked) {
    const { error } = await supabase.from('activity_likes').insert({ user_id: uid, activity_id: activityId });
    if (error && error.code !== '23505') check(error, "Couldn't like that post.");
  } else {
    const { error } = await supabase.from('activity_likes').delete().eq('user_id', uid).eq('activity_id', activityId);
    check(error, "Couldn't remove your like.");
  }
}

export async function listComments(activityId) {
  const { data, error } = await supabase
    .from('activity_comments')
    .select('id, user_id, content, created_at')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  check(error, "Couldn't load comments.");
  const profiles = await getProfiles((data || []).map((c) => c.user_id));
  return (data || []).map((c) => ({ ...c, profile: profiles[c.user_id] || null }));
}

export async function addComment(activityId, content) {
  const uid = await getUid();
  const text = String(content || '').trim();
  if (!text) throw new AppError('Write something first.');
  if (text.length > 500) throw new AppError('Keep comments under 500 characters.');
  const { data, error } = await supabase
    .from('activity_comments')
    .insert({ user_id: uid, activity_id: activityId, content: text })
    .select('id, user_id, content, created_at')
    .single();
  check(error, "Couldn't post your comment.");
  const profiles = await getProfiles([uid]);
  return { ...data, profile: profiles[uid] || null };
}

/** Delete your own comment, or any comment on your own post. */
export async function deleteComment(comment, { onMyPost = false } = {}) {
  const uid = await getUid();
  let query = supabase.from('activity_comments').delete().eq('id', comment.id);
  if (!onMyPost || comment.user_id === uid) query = query.eq('user_id', uid);
  const { error } = await query;
  check(error, "Couldn't delete that comment.");
}

export async function deleteActivity(activityId) {
  const uid = await getUid();
  await supabase.from('activity_likes').delete().eq('activity_id', activityId);
  await supabase.from('activity_comments').delete().eq('activity_id', activityId);
  const { error } = await supabase.from('activity_feed').delete().eq('id', activityId).eq('user_id', uid);
  check(error, "Couldn't delete that post.");
}
