import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Trash2, Send } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { fullName, money, ordinal, timeAgo, pluralize } from '../../lib/format';
import { setLiked, listComments, addComment, deleteComment } from '../../api/feed';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';

function describe(item) {
  const t = item.tournament;
  const name = t?.tournament_name || 'a tournament';
  const m = item.metadata || {};
  switch (item.type) {
    case 'tournament_added':
      return { verb: 'Registered for', object: name };
    case 'tournament_finished': {
      if (!t) return { verb: 'Finished', object: name };
      if (!item.showResults) return { verb: 'Played', object: name };
      if (Number(t.winnings) > 0) return { verb: Number(t.place) === 1 ? 'Won' : 'Cashed in', object: name };
      if (t.place) return { verb: `Finished ${ordinal(t.place)} in`, object: name };
      return { verb: 'Busted', object: name };
    }
    case 'journey_created':
      return { verb: 'Is planning', object: m.journey_name || 'a series' };
    case 'journey_completed':
      return { verb: 'Wrapped up', object: m.journey_name || 'a series' };
    case 'friend_joined':
      return { verb: 'Became friends with', object: m.friend_name || 'a new player' };
    case 'level_up':
      return { verb: 'Reached', object: `${m.level || 'a new'} level` };
    default:
      return { verb: 'Posted', object: 'an update' };
  }
}

function ResultLine({ item }) {
  const t = item.tournament;
  const m = item.metadata || {};
  if (item.type === 'journey_created') {
    return m.events ? <div className="feed-tags"><span className="tag">{pluralize(m.events, 'event')}</span></div> : null;
  }
  if (item.type === 'journey_completed') {
    return (
      <div className="feed-tags">
        {m.events ? <span className="tag">{pluralize(m.events, 'event')}</span> : null}
        {item.showResults && m.net != null ? (
          <span className={`tag ${m.net >= 0 ? 'tag-gain' : 'tag-loss'}`}>{money(m.net, { sign: true })} net</span>
        ) : null}
      </div>
    );
  }
  if (!t) return null;
  if (item.type === 'tournament_added') {
    return (
      <div className="feed-tags">
        <span className="tag num">{money(t.buy_in)} buy-in</span>
        {t.location && <span className="tag">{t.location}</span>}
      </div>
    );
  }
  if (!item.showResults) return t.location ? <div className="feed-tags"><span className="tag">{t.location}</span></div> : null;
  const cashed = Number(t.winnings) > 0;
  const place = Number(t.place) || null;
  const entries = Number(t.entries) || null;
  return (
    <div className="feed-result">
      {cashed && <span className="feed-cash num">{money(t.winnings)}</span>}
      <div className="feed-tags">
        {place && <span className="tag num">{ordinal(place)}{entries ? ` of ${entries.toLocaleString('en-US')}` : ''}</span>}
        {place === 1 && <span className="tag tag-orange">Champion</span>}
        {place > 1 && place <= 9 && cashed && <span className="tag tag-orange">Final table</span>}
        {!cashed && <span className="tag num">{money(t.buy_in)} buy-in</span>}
        {t.location && <span className="tag">{t.location}</span>}
      </div>
    </div>
  );
}

function Comments({ item, onCountChange }) {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    let alive = true;
    listComments(item.id).then((c) => alive && setComments(c)).catch((e) => toast(e.message, { type: 'error' }));
    return () => { alive = false; };
  }, [item.id, toast]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await addComment(item.id, text);
      setComments((list) => [...(list || []), c]);
      onCountChange(1);
      setText('');
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    const ok = await confirm({ title: 'Delete comment?', body: 'This can’t be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteComment(c, { onMyPost: item.isMine });
      setComments((list) => list.filter((x) => x.id !== c.id));
      onCountChange(-1);
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  };

  return (
    <div className="comments">
      {comments === null ? (
        <p className="faint comments-loading">Loading comments…</p>
      ) : (
        <ul className="list comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <Link to={`/players/${c.user_id}`} aria-label={fullName(c.profile)}>
                <Avatar profile={c.profile} id={c.user_id} size={28} />
              </Link>
              <div className="grow comment-bubble">
                <div className="comment-head">
                  <Link to={`/players/${c.user_id}`} className="comment-author">{fullName(c.profile)}</Link>
                  <span className="faint">{timeAgo(c.created_at)}</span>
                </div>
                <p>{c.content}</p>
              </div>
              {(c.user_id === user.id || item.isMine) && (
                <button type="button" className="icon-btn comment-delete" onClick={() => remove(c)} aria-label="Delete comment">
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="comment-form" onSubmit={submit}>
        <input
          className="input"
          placeholder="Add a comment"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          aria-label="Add a comment"
          disabled={busy}
        />
        <button type="submit" className="icon-btn comment-send" disabled={busy || !text.trim()} aria-label="Post comment">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

export default function ActivityCard({ item, compact = false, defaultOpen = false }) {
  const { toast } = useUI();
  const [liked, setLikedState] = useState(item.likedByMe);
  const [likes, setLikes] = useState(item.likeCount);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const [open, setOpen] = useState(defaultOpen);
  const { verb, object } = describe(item);
  const name = item.isMine ? 'You' : fullName(item.profile);

  const toggleLike = async () => {
    const next = !liked;
    setLikedState(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await setLiked(item.id, next);
    } catch (e) {
      setLikedState(!next);
      setLikes((n) => n + (next ? -1 : 1));
      toast(e.message, { type: 'error' });
    }
  };

  return (
    <article className={`feed-card ${compact ? 'is-compact' : ''}`}>
      <Link to={`/players/${item.userId}`} className="feed-avatar" aria-label={fullName(item.profile)}>
        <Avatar profile={item.profile} id={item.userId} size={compact ? 36 : 42} />
      </Link>
      <div className="feed-body">
        <div className="feed-head">
          <Link to={`/players/${item.userId}`} className="feed-name">{name}</Link>
          <time className="faint" dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
        </div>
        <p className="feed-text">
          {verb} <strong>{object}</strong>
        </p>
        <ResultLine item={item} />
        {!compact && (
          <>
            <div className="feed-actions">
              <button type="button" className={`feed-action ${liked ? 'is-liked' : ''}`} onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'}>
                <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                {likes > 0 && <span className="num">{likes}</span>}
              </button>
              <button type="button" className={`feed-action ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Comments">
                <MessageCircle size={18} />
                {commentCount > 0 && <span className="num">{commentCount}</span>}
              </button>
            </div>
            {open && <Comments item={item} onCountChange={(d) => setCommentCount((n) => n + d)} />}
          </>
        )}
      </div>
    </article>
  );
}
