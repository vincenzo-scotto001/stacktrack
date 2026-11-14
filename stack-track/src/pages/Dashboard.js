import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, UserPlus, Trophy, Newspaper } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Segmented from '../components/ui/Segmented';
import ChipEdge from '../components/ui/ChipEdge';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import { BankrollChart } from '../components/charts/Charts';
import ActivityCard from '../components/feed/ActivityCard';
import TournamentRow from '../components/TournamentRow';
import JourneyCard from '../components/JourneyCard';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { listTournaments } from '../api/tournaments';
import { listJourneys } from '../api/journeys';
import { listFeed } from '../api/feed';
import { summarize, cumulativeSeries, filterByRange, prepare, hasResult } from '../lib/stats';
import { money, percent, formatDay, todayString, parseDay } from '../lib/format';

const RANGES = [
  { id: '30d', label: '30 days' },
  { id: 'ytd', label: 'This year' },
  { id: 'all', label: 'All time' },
];
const RANGE_LABEL = { '30d': 'Net, last 30 days', ytd: 'Net this year', all: 'Net, all time' };

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function lastResults(tournaments, n = 20) {
  return prepare(tournaments).slice(-n).map((t) => (t.cashed ? 'cash' : 'played'));
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [range, setRange] = useState('ytd');
  const tournaments = useAsync(() => listTournaments(), []);
  const journeys = useAsync(() => listJourneys(), []);
  const feed = useAsync(() => listFeed({ limit: 4 }).then((r) => r.items.filter((i) => !i.isMine).slice(0, 3)), []);

  const all = useMemo(() => tournaments.data || [], [tournaments.data]);
  const inRange = useMemo(() => filterByRange(all, range), [all, range]);
  const summary = useMemo(() => summarize(inRange), [inRange]);
  const points = useMemo(() => cumulativeSeries(inRange), [inRange]);
  const edge = useMemo(() => lastResults(all), [all]);

  const pending = useMemo(() => {
    const cutoff = parseDay(todayString());
    cutoff.setDate(cutoff.getDate() - 2);
    return all.filter((t) => !hasResult(t) && parseDay(t.date) >= cutoff).slice(0, 2);
  }, [all]);

  const activeJourney = (journeys.data || []).find((j) => !j.is_completed);
  const recent = all.slice(0, 5);
  const isNew = tournaments.data && all.length === 0;

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, ${profile?.first_name || 'there'}`}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      />

      {tournaments.error && <ErrorState error={tournaments.error} onRetry={tournaments.reload} />}
      {tournaments.loading && !tournaments.data && <Skeleton rows={1} height={320} />}

      {isNew && (
        <section className="panel welcome">
          <h2>Log your first tournament</h2>
          <p className="muted">Every result you add builds your running total, ROI and bankroll graph. Already tracking somewhere else? Bring it over.</p>
          <div className="row wrap">
            <Link to="/tournaments/new" className="btn btn-primary"><Plus size={18} aria-hidden="true" /> Add a tournament</Link>
            <Link to="/tournaments/import" className="btn btn-ghost"><Upload size={18} aria-hidden="true" /> Import a spreadsheet</Link>
            <Link to="/friends" className="btn btn-ghost"><UserPlus size={18} aria-hidden="true" /> Find friends</Link>
          </div>
        </section>
      )}

      {tournaments.data && all.length > 0 && (
        <section className="panel result-panel" aria-labelledby="net-label">
          <div className="result-top">
            <div>
              <span id="net-label" className="muted">{RANGE_LABEL[range]}</span>
              <div className={`result-total num ${summary.net > 0.5 ? 'gain' : summary.net < -0.5 ? 'loss' : ''}`}>
                {money(summary.net, { sign: true })}
              </div>
            </div>
            <Segmented options={RANGES} value={range} onChange={setRange} label="Time range" size="sm" />
          </div>

          <dl className="result-figures">
            <div><dt>ROI</dt><dd className="num">{summary.count ? percent(summary.roi, { sign: true }) : '–'}</dd></div>
            <div><dt>In the money</dt><dd className="num">{summary.count ? percent(summary.itm) : '–'}</dd></div>
            <div><dt>Tournaments</dt><dd className="num">{summary.count}</dd></div>
            <div><dt>Biggest cash</dt><dd className="num">{summary.biggestCash ? money(summary.biggestCash.cash) : '–'}</dd></div>
          </dl>

          {points.length > 2 ? (
            <BankrollChart points={points} height={200} />
          ) : (
            <p className="muted result-empty">Not enough tournaments in this range for a graph yet.</p>
          )}

          <div className="result-edge">
            <ChipEdge segments={edge} label={`Last ${edge.length} tournaments: ${edge.filter((e) => e === 'cash').length} cashes`} />
            <div className="hero-edge-legend">
              <span>Last {edge.length} tournaments</span>
              <span><i className="lg-cash" /> Cash <i className="lg-played" /> No cash</span>
            </div>
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="pending" aria-label="Waiting for a result">
          {pending.map((t) => (
            <div className="pending-item" key={t.id}>
              <Trophy size={18} aria-hidden="true" />
              <div className="grow">
                <strong className="truncate">{t.tournament_name}</strong>
                <span className="muted">{formatDay(t.date, { short: true })}. Cashed or finished deep? Add your result.</span>
              </div>
              <Link to={`/tournaments/${t.id}/edit`} className="btn btn-secondary btn-sm">Add result</Link>
            </div>
          ))}
        </section>
      )}

      {all.length > 0 && (
        <div className="grid-2 dash-grid">
          <section className="panel panel-flush">
            <div className="panel-head">
              <h2>Recent results</h2>
              <Link to="/tournaments">All results</Link>
            </div>
            <ul className="list">
              {recent.map((t) => (
                <li key={t.id}><TournamentRow t={t} /></li>
              ))}
            </ul>
          </section>

          <div className="stack">
            {activeJourney && <JourneyCard journey={activeJourney} />}
            <section className="panel">
              <div className="panel-head">
                <h2>Friends</h2>
                <Link to="/feed">Open feed</Link>
              </div>
              {feed.loading && <Skeleton rows={3} height={52} />}
              {feed.data && feed.data.length === 0 && (
                <EmptyState
                  icon={Newspaper}
                  title="Nothing from friends yet"
                  action={<Link to="/friends" className="btn btn-ghost btn-sm">Find friends</Link>}
                >
                  Add friends to see their results here.
                </EmptyState>
              )}
              {feed.data && feed.data.length > 0 && (
                <div className="feed-compact">
                  {feed.data.map((item) => <ActivityCard key={item.id} item={item} compact />)}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
