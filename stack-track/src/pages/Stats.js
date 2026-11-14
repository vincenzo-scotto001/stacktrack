import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartNoAxesCombined } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Segmented from '../components/ui/Segmented';
import Money from '../components/ui/Money';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import { BankrollChart, PeriodBars } from '../components/charts/Charts';
import useAsync from '../hooks/useAsync';
import { listTournaments } from '../api/tournaments';
import {
  summarize, cumulativeSeries, periodSeries, breakdown, buyInBucket, filterByRange, RANGE_PRESETS,
} from '../lib/stats';
import { money, percent, formatDay, ordinal, pluralize } from '../lib/format';

const PERIODS = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
];

function BreakdownTable({ title, rows, note }) {
  if (!rows.length) return null;
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.net)), 1);
  return (
    <section className="panel panel-flush">
      <div className="panel-head">
        <h2>{title}</h2>
        {note && <span className="faint">{note}</span>}
      </div>
      <div className="table-wrap">
        <table className="table breakdown">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Group</span></th>
              <th scope="col" className="r">Played</th>
              <th scope="col" className="r">ITM</th>
              <th scope="col" className="r">ROI</th>
              <th scope="col" className="r">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">
                  <span className="truncate breakdown-label">{r.label}</span>
                  <span className="meter" aria-hidden="true">
                    <span className={r.net >= 0 ? 'gain' : 'loss'} style={{ width: `${(Math.abs(r.net) / maxAbs) * 100}%` }} />
                  </span>
                </th>
                <td className="r num">{r.count}</td>
                <td className="r num">{percent(r.itm, { digits: 0 })}</td>
                <td className={`r num ${r.roi >= 0 ? 'gain' : 'loss'}`}>{percent(r.roi, { sign: true, digits: 0 })}</td>
                <td className="r"><Money value={r.net} sign /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Fact({ label, children, sub }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {sub && <dd className="fact-sub">{sub}</dd>}
    </div>
  );
}

export default function Stats() {
  const { data, error, loading, reload } = useAsync(() => listTournaments(), []);
  const [range, setRange] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [period, setPeriod] = useState('month');

  const presets = [...RANGE_PRESETS, { id: 'custom', label: 'Custom' }];
  const list = useMemo(() => {
    if (!data) return [];
    if (range === 'custom') return filterByRange(data, custom);
    return filterByRange(data, range);
  }, [data, range, custom]);

  const s = useMemo(() => summarize(list), [list]);
  const points = useMemo(() => cumulativeSeries(list), [list]);
  const periods = useMemo(() => periodSeries(list, period), [list, period]);
  const byBuyIn = useMemo(() => breakdown(list, buyInBucket, { sortBy: 'order' }), [list]);
  const byVenue = useMemo(() => breakdown(list, (t) => t.location || null).slice(0, 8), [list]);
  const byGame = useMemo(() => breakdown(list, (t) => t.game_type || null), [list]);

  return (
    <div className="page">
      <PageHeader title="Stats" subtitle="Every figure counts only your share after action sold." />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={3} height={180} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={ChartNoAxesCombined}
          title="Stats start with your first tournament"
          action={<Link to="/tournaments/new" className="btn btn-primary">Add a tournament</Link>}
        >
          Add results and this page fills in with your bankroll graph, ROI, streaks and breakdowns.
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <div className="stack-lg">
          <div className="range-bar">
            <Segmented options={presets} value={range} onChange={setRange} label="Date range" />
            {range === 'custom' && (
              <div className="row wrap custom-range">
                <input type="date" className="input select-sm" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="From" />
                <span className="muted">to</span>
                <input type="date" className="input select-sm" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="To" />
              </div>
            )}
          </div>

          {list.length === 0 ? (
            <EmptyState icon={ChartNoAxesCombined} title="No tournaments in this range">Pick a wider range to see your stats.</EmptyState>
          ) : (
            <>
              <section className="stats-hero">
                <div>
                  <span className="muted">Net result</span>
                  <div className={`stats-total num ${s.net > 0.5 ? 'gain' : s.net < -0.5 ? 'loss' : ''}`}>{money(s.net, { sign: true })}</div>
                  <span className="muted">across {pluralize(s.count, 'tournament')}</span>
                </div>
              </section>

              <div className="metrics">
                <div className="metric"><span className="metric-label">ROI</span><span className={`metric-value ${s.roi >= 0 ? 'gain' : 'loss'}`}>{percent(s.roi, { sign: true })}</span></div>
                <div className="metric"><span className="metric-label">In the money</span><span className="metric-value">{percent(s.itm)}</span><span className="metric-sub">{s.cashes} cashes</span></div>
                <div className="metric"><span className="metric-label">Your buy-ins</span><span className="metric-value">{money(s.cost)}</span>{s.soldValue > 0 && <span className="metric-sub">{money(s.soldValue)} sold to backers</span>}</div>
                <div className="metric"><span className="metric-label">Average buy-in</span><span className="metric-value">{money(s.avgBuyIn)}</span></div>
              </div>

              <section className="panel">
                <div className="panel-head">
                  <h2>Bankroll</h2>
                  <span className="faint">Running net, one point per tournament</span>
                </div>
                <BankrollChart points={points} height={300} />
              </section>

              <section className="panel">
                <div className="panel-head wrap">
                  <h2>Net by period</h2>
                  <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Period" size="sm" />
                </div>
                <PeriodBars data={periods} />
              </section>

              <section className="panel">
                <div className="panel-head"><h2>Highs and lows</h2></div>
                <dl className="facts">
                  <Fact label="Biggest cash" sub={s.biggestCash && `${s.biggestCash.tournament_name}, ${formatDay(s.biggestCash.date)}`}>
                    {s.biggestCash ? <Money value={s.biggestCash.cash} /> : '–'}
                  </Fact>
                  <Fact label="Best result" sub={s.bestResult && s.bestResult.net > 0 && (s.bestResult.place ? `${ordinal(s.bestResult.place)} in ${s.bestResult.tournament_name}` : s.bestResult.tournament_name)}>
                    {s.bestResult && s.bestResult.net > 0 ? <Money value={s.bestResult.net} sign /> : '–'}
                  </Fact>
                  <Fact label="Biggest downswing" sub="Largest drop from a high point">
                    {s.maxDrawdown > 0 ? <Money value={-s.maxDrawdown} sign /> : '–'}
                  </Fact>
                  <Fact label="Longest cash streak">{`${pluralize(s.longestCashStreak, 'cash', 'cashes')} in a row`}</Fact>
                  <Fact label="Longest run without a cash">{pluralize(s.longestDryStreak, 'tournament')}</Fact>
                  <Fact label="Wins and final tables" sub="Final table counts finishes 9th or better">
                    <span className="num">{s.wins} {s.wins === 1 ? 'win' : 'wins'}, {s.topNine} FT</span>
                  </Fact>
                  <Fact label="Average cash"><Money value={s.avgCash} /></Fact>
                  <Fact label="Swing per tournament" sub="Standard deviation of your net result">
                    <Money value={s.stdDev} />
                  </Fact>
                </dl>
              </section>

              <div className="grid-2 even">
                <BreakdownTable title="By buy-in" rows={byBuyIn} />
                <BreakdownTable title="By venue" rows={byVenue} note={byVenue.length === 8 ? 'Top 8 by volume' : null} />
              </div>
              {byGame.length > 1 && <BreakdownTable title="By game" rows={byGame} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
