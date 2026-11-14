import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, Users, Check, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionTabs, { SOCIAL_TABS } from '../components/layout/SectionTabs';
import Avatar from '../components/ui/Avatar';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import {
  getConnections, getSuggestions, sendFriendRequest, acceptFriendRequest, deleteFriendRequest,
} from '../api/friends';
import { searchPlayers } from '../api/profiles';
import { fullName, pluralize, timeAgo } from '../lib/format';

function PlayerLine({ id, profile, sub, children }) {
  return (
    <div className="list-row">
      <Link to={`/players/${id}`} className="player-link">
        <Avatar profile={profile} id={id} size={40} />
        <span className="list-main">
          <span className="list-title">{fullName(profile)}</span>
          <span className="list-meta">{sub || (profile?.username ? `@${profile.username}` : '')}</span>
        </span>
      </Link>
      <div className="row">{children}</div>
    </div>
  );
}

export default function Friends() {
  const { toast } = useUI();
  const { caps } = useAuth();
  const connections = useAsync(() => getConnections(), []);
  const suggestions = useAsync(() => getSuggestions(), []);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [pending, setPending] = useState({});

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(() => {
      searchPlayers(term).then((r) => alive && setResults(r)).catch((e) => toast(e.message, { type: 'error' }));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, toast]);

  const c = connections.data;
  const statusOf = (id) => {
    if (pending[id]) return pending[id];
    if (!c) return 'none';
    if (c.friends.some((f) => f.id === id)) return 'friends';
    if (c.outgoing.some((f) => f.id === id)) return 'sent';
    if (c.incoming.some((f) => f.id === id)) return 'incoming';
    return 'none';
  };

  const add = async (id) => {
    setPending((p) => ({ ...p, [id]: 'sending' }));
    try {
      const r = await sendFriendRequest(id);
      setPending((p) => ({ ...p, [id]: r === 'accepted' ? 'friends' : 'sent' }));
      toast(r === 'accepted' ? 'You’re now friends.' : 'Friend request sent.');
      connections.reload({ quiet: true });
    } catch (e) {
      setPending((p) => ({ ...p, [id]: undefined }));
      toast(e.message, { type: 'error' });
    }
  };

  const respond = async (req, accept) => {
    try {
      if (accept) await acceptFriendRequest(req.requestId);
      else await deleteFriendRequest(req.requestId);
      toast(accept ? `You and ${req.profile?.first_name || 'they'} are now friends.` : 'Request declined.');
      connections.reload({ quiet: true });
      suggestions.reload({ quiet: true });
    } catch (e) {
      toast(e.message, { type: 'error' });
    }
  };

  const cancel = async (req) => {
    try {
      await deleteFriendRequest(req.requestId);
      setPending((p) => ({ ...p, [req.id]: undefined }));
      toast('Request cancelled.');
      connections.reload({ quiet: true });
    } catch (e) {
      toast(e.message, { type: 'error' });
    }
  };

  const addButton = (id) => {
    const s = statusOf(id);
    if (s === 'friends') return <span className="tag">Friends</span>;
    if (s === 'sent') return <span className="tag">Requested</span>;
    if (s === 'incoming') return <span className="tag tag-orange">Wants to be friends</span>;
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => add(id)} disabled={s === 'sending'}>
        <UserPlus size={16} aria-hidden="true" /> Add
      </button>
    );
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Social" />
      <SectionTabs tabs={SOCIAL_TABS.map((t) => (t.to === '/friends' && c?.incoming.length ? { ...t, badge: c.incoming.length } : t))} label="Social" />

      <div className="search friend-search">
        <Search size={18} aria-hidden="true" />
        <input
          className="input"
          type="search"
          placeholder={caps.profiles ? 'Find players by name or @username' : 'Find players by name'}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Find players"
        />
      </div>

      {results && (
        <section className="panel panel-flush section-gap">
          <div className="panel-head"><h2>Results</h2></div>
          {results.length === 0 ? (
            <p className="muted panel-pad">No players match “{term.trim()}”. Check the spelling or try their last name.</p>
          ) : (
            <div className="list">
              {results.map((p) => <PlayerLine key={p.id} id={p.id} profile={p}>{addButton(p.id)}</PlayerLine>)}
            </div>
          )}
        </section>
      )}

      {connections.error && <ErrorState error={connections.error} onRetry={connections.reload} />}
      {connections.loading && !c && <Skeleton rows={4} />}

      {c && c.incoming.length > 0 && (
        <section className="panel panel-flush section-gap requests">
          <div className="panel-head"><h2>Friend requests</h2></div>
          <div className="list">
            {c.incoming.map((r) => (
              <PlayerLine key={r.requestId} id={r.id} profile={r.profile} sub={`Sent ${timeAgo(r.since)}`}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => respond(r, true)}><Check size={16} aria-hidden="true" /> Accept</button>
                <button type="button" className="icon-btn" onClick={() => respond(r, false)} aria-label={`Decline ${fullName(r.profile)}`}><X size={18} /></button>
              </PlayerLine>
            ))}
          </div>
        </section>
      )}

      {c && (
        <section className="panel panel-flush section-gap">
          <div className="panel-head"><h2>{c.friends.length ? pluralize(c.friends.length, 'friend') : 'Friends'}</h2></div>
          {c.friends.length === 0 ? (
            <EmptyState icon={Users} title="No friends yet">Search for players above or add someone from the suggestions below.</EmptyState>
          ) : (
            <div className="list">
              {c.friends.map((f) => (
                <Link key={f.id} to={`/players/${f.id}`} className="list-row">
                  <Avatar profile={f.profile} id={f.id} size={40} />
                  <span className="list-main">
                    <span className="list-title">{fullName(f.profile)}</span>
                    <span className="list-meta">{f.profile?.username ? `@${f.profile.username}` : ''}{f.profile?.home_venue ? <span>{f.profile.home_venue}</span> : null}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {c && c.outgoing.length > 0 && (
        <section className="panel panel-flush section-gap">
          <div className="panel-head"><h2>Sent requests</h2></div>
          <div className="list">
            {c.outgoing.map((r) => (
              <PlayerLine key={r.requestId} id={r.id} profile={r.profile} sub={`Sent ${timeAgo(r.since)}`}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(r)}>Cancel</button>
              </PlayerLine>
            ))}
          </div>
        </section>
      )}

      {suggestions.data && suggestions.data.length > 0 && (
        <section className="panel panel-flush section-gap">
          <div className="panel-head"><h2>People you may know</h2></div>
          <div className="list">
            {suggestions.data.map((s) => (
              <PlayerLine key={s.id} id={s.id} profile={s.profile} sub={s.mutual ? pluralize(s.mutual, 'mutual friend') : (s.profile?.home_venue || 'New on StackTrack')}>
                {addButton(s.id)}
              </PlayerLine>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
