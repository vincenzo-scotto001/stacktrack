import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, MapPin, UserPlus, Check, UserMinus, Pencil } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Money from '../components/ui/Money';
import ChipEdge from '../components/ui/ChipEdge';
import TournamentRow from '../components/TournamentRow';
import { BankrollChart } from '../components/charts/Charts';
import { PageLoader, ErrorState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { getProfile, sharesResults } from '../api/profiles';
import { getRelationship, sendFriendRequest, acceptFriendRequest, deleteFriendRequest, removeFriend } from '../api/friends';
import { listTournaments } from '../api/tournaments';
import { summarize, cumulativeSeries, prepare } from '../lib/stats';
import { fullName, money, percent, pluralize } from '../lib/format';

async function loadPlayer(id) {
  const [profile, rel] = await Promise.all([getProfile(id), getRelationship(id)]);
  if (!profile) throw new Error('This player doesn’t exist.');
  const canSee = rel.status === 'self' || (rel.status === 'friends' && sharesResults(profile));
  const tournaments = canSee ? await listTournaments(id) : [];
  return { profile, rel, canSee, tournaments };
}

export default function PlayerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const { data, error, loading, reload } = useAsync(() => loadPlayer(id), [id]);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const tournaments = useMemo(() => data?.tournaments || [], [data]);
  const s = useMemo(() => summarize(tournaments), [tournaments]);
  const points = useMemo(() => cumulativeSeries(tournaments), [tournaments]);
  const edge = useMemo(() => prepare(tournaments).slice(-20).map((t) => (t.cashed ? 'cash' : 'played')), [tournaments]);

  if (loading && !data) return <PageLoader />;
  if (error) return <div className="page page-narrow"><ErrorState error={error} onRetry={reload} /></div>;

  const { profile, rel, canSee } = data;
  const isMe = id === user.id;
  const first = profile.first_name || 'This player';

  const act = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast(success);
      await reload({ quiet: true });
    } catch (e) {
      toast(e.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const unfriend = async () => {
    const ok = await confirm({
      title: `Remove ${first} as a friend?`,
      body: 'You’ll stop seeing each other’s results. You can add them again later.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) act(() => removeFriend(id), `Removed ${first}.`);
  };

  let action = null;
  if (isMe) action = <Link to="/settings" className="btn btn-ghost btn-sm"><Pencil size={16} aria-hidden="true" /> Edit profile</Link>;
  else if (rel.status === 'none') action = <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => sendFriendRequest(id), 'Friend request sent.')}><UserPlus size={16} aria-hidden="true" /> Add friend</button>;
  else if (rel.status === 'outgoing') action = <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => deleteFriendRequest(rel.requestId), 'Request cancelled.')}>Cancel request</button>;
  else if (rel.status === 'incoming') action = <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => acceptFriendRequest(rel.requestId), `You and ${first} are now friends.`)}><Check size={16} aria-hidden="true" /> Accept request</button>;
  else if (rel.status === 'friends') action = <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={unfriend}><UserMinus size={16} aria-hidden="true" /> Friends</button>;

  const visible = showAll ? tournaments : tournaments.slice(0, 8);

  return (
    <div className="page">
      <header className="profile-head">
        <Avatar profile={profile} id={id} size={84} />
        <div className="profile-id">
          <h1>{fullName(profile)}</h1>
          <p className="muted profile-meta">
            {profile.username && <span>@{profile.username}</span>}
            {profile.home_venue && <span><MapPin size={14} className="inline-icon" aria-hidden="true" /> {profile.home_venue}</span>}
          </p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        </div>
        <div className="profile-action">{action}</div>
      </header>

      {!canSee && (
        <div className="panel profile-locked">
          <Lock size={20} aria-hidden="true" />
          <div>
            {rel.status === 'friends' ? (
              <><h2>{first} keeps results private</h2><p className="muted">Their tournaments, results and graph are hidden. You can still like and comment on their other posts.</p></>
            ) : (
              <><h2>Results are for friends</h2><p className="muted">Add {first} as a friend to see their results, graph and recent tournaments.</p></>
            )}
          </div>
        </div>
      )}

      {canSee && tournaments.length === 0 && (
        <div className="panel"><p className="muted">{isMe ? 'You haven’t' : `${first} hasn’t`} logged any tournaments yet.</p></div>
      )}

      {canSee && tournaments.length > 0 && (
        <div className="stack-lg">
          <div className="metrics">
            <div className="metric"><span className="metric-label">Net, all time</span><span className={`metric-value ${s.net >= 0 ? 'gain' : 'loss'}`}>{money(s.net, { sign: true })}</span></div>
            <div className="metric"><span className="metric-label">ROI</span><span className="metric-value">{percent(s.roi, { sign: true })}</span></div>
            <div className="metric"><span className="metric-label">In the money</span><span className="metric-value">{percent(s.itm)}</span></div>
            <div className="metric"><span className="metric-label">Biggest cash</span><span className="metric-value">{s.biggestCash ? money(s.biggestCash.cash) : '–'}</span>{s.biggestCash && <span className="metric-sub truncate">{s.biggestCash.tournament_name}</span>}</div>
          </div>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head"><h2>Bankroll</h2><span className="faint">{pluralize(s.count, 'tournament')}</span></div>
              <BankrollChart points={points} height={240} />
              <div className="result-edge">
                <ChipEdge segments={edge} label={`Last ${edge.length} tournaments`} />
                <div className="hero-edge-legend">
                  <span>Last {edge.length} tournaments</span>
                  <span><i className="lg-cash" /> Cash <i className="lg-played" /> No cash</span>
                </div>
              </div>
            </section>
            <section className="panel panel-flush">
              <div className="panel-head"><h2>Recent tournaments</h2></div>
              <ul className="list">
                {visible.map((t) => <li key={t.id}><TournamentRow t={t} editable={isMe} /></li>)}
              </ul>
              {tournaments.length > 8 && (
                <div className="panel-pad">
                  <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show fewer' : `Show all ${tournaments.length}`}
                  </button>
                </div>
              )}
            </section>
          </div>
          <p className="faint fine-print">Results count {isMe ? 'your' : `${first}’s`} share after action sold. <Money value={s.cost} /> in buy-ins.</p>
        </div>
      )}
    </div>
  );
}
