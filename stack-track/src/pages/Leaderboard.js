import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Medal, Lock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionTabs, { SOCIAL_TABS } from '../components/layout/SectionTabs';
import Segmented from '../components/ui/Segmented';
import Avatar from '../components/ui/Avatar';
import Money from '../components/ui/Money';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { getLeaderboard } from '../api/social';
import { fullName, percent, pluralize } from '../lib/format';

const RANGES = [
  { id: 'month', label: 'This month' },
  { id: 'ytd', label: 'This year' },
  { id: 'all', label: 'All time' },
];

const MIN_FOR_ROI = 5;

const METRICS = [
  { id: 'net', label: 'Net', value: (s) => s.net, render: (s) => <Money value={s.net} sign /> },
  { id: 'roi', label: 'ROI', value: (s) => (s.count >= MIN_FOR_ROI ? s.roi : -Infinity), render: (s) => <span className={`num ${s.roi >= 0 ? 'gain' : 'loss'}`}>{percent(s.roi, { sign: true, digits: 0 })}</span> },
  { id: 'cashes', label: 'Cashes', value: (s) => s.cashes, render: (s) => <span className="num">{s.cashes}</span> },
  { id: 'count', label: 'Volume', value: (s) => s.count, render: (s) => <span className="num">{s.count}</span> },
];

export default function Leaderboard() {
  const [range, setRange] = useState('month');
  const [metricId, setMetricId] = useState('net');
  const { data, error, loading, reload } = useAsync(() => getLeaderboard(range), [range]);
  const metric = METRICS.find((m) => m.id === metricId);

  const { ranked, idle, hidden } = useMemo(() => {
    const rows = data || [];
    const visible = rows.filter((r) => !r.hidden);
    const active = visible.filter((r) => r.stats.count > 0 && (metricId !== 'roi' || r.stats.count >= MIN_FOR_ROI));
    return {
      ranked: [...active].sort((a, b) => metric.value(b.stats) - metric.value(a.stats)),
      idle: visible.filter((r) => !active.includes(r)),
      hidden: rows.filter((r) => r.hidden),
    };
  }, [data, metric, metricId]);

  return (
    <div className="page page-narrow">
      <PageHeader title="Social" />
      <SectionTabs tabs={SOCIAL_TABS} label="Social" />

      <div className="leader-controls">
        <Segmented options={RANGES} value={range} onChange={setRange} label="Period" size="sm" />
        <Segmented options={METRICS} value={metricId} onChange={setMetricId} label="Rank by" size="sm" />
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={5} />}

      {data && data.length <= 1 && (
        <EmptyState icon={Medal} title="A leaderboard needs friends" action={<Link to="/friends" className="btn btn-primary">Find friends</Link>}>
          Add friends and see how your results stack up each month.
        </EmptyState>
      )}

      {data && data.length > 1 && (
        <section className="panel panel-flush">
          {ranked.length === 0 && (
            <p className="muted panel-pad">
              {metricId === 'roi' ? `ROI ranks players with at least ${MIN_FOR_ROI} tournaments in the period.` : 'Nobody has played in this period yet.'}
            </p>
          )}
          <ol className="list leaderboard">
            {ranked.map((r, i) => (
              <li key={r.id}>
                <Link to={`/players/${r.id}`} className={`list-row leader-row ${r.isMe ? 'is-me' : ''}`}>
                  <span className={`leader-rank num ${i === 0 ? 'is-first' : ''}`}>{i + 1}</span>
                  <Avatar profile={r.profile} id={r.id} size={40} />
                  <span className="list-main">
                    <span className="list-title">{r.isMe ? 'You' : fullName(r.profile)}</span>
                    <span className="list-meta">
                      <span>{pluralize(r.stats.count, 'tournament')}</span>
                      <span>{percent(r.stats.itm, { digits: 0 })} ITM</span>
                    </span>
                  </span>
                  <span className="list-end leader-value">{metric.render(r.stats)}</span>
                </Link>
              </li>
            ))}
          </ol>
          {(idle.length > 0 || hidden.length > 0) && (
            <div className="leader-foot">
              {idle.length > 0 && (
                <p className="faint">
                  {metricId === 'roi' ? `Fewer than ${MIN_FOR_ROI} tournaments` : 'No tournaments'} this period: {idle.map((r) => (r.isMe ? 'you' : r.profile?.first_name)).join(', ')}
                </p>
              )}
              {hidden.length > 0 && (
                <p className="faint"><Lock size={13} className="inline-icon" aria-hidden="true" /> Results private: {hidden.map((r) => r.profile?.first_name).join(', ')}</p>
              )}
            </div>
          )}
        </section>
      )}
      {data && data.length > 1 && <p className="faint fine-print">Net and ROI count each player’s share after action sold.</p>}
    </div>
  );
}
