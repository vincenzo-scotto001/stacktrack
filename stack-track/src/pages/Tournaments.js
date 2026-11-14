import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, Download, Search, Trophy, CheckSquare, Trash2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionTabs, { TRACK_TABS } from '../components/layout/SectionTabs';
import Segmented from '../components/ui/Segmented';
import Money from '../components/ui/Money';
import TournamentRow from '../components/TournamentRow';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { useUI } from '../context/UIContext';
import { listTournaments, deleteTournaments } from '../api/tournaments';
import { enrich, summarize } from '../lib/stats';
import { tournamentsToCsv, downloadText } from '../lib/csv';
import { formatMonth, pluralize, todayString } from '../lib/format';

const RESULT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'cash', label: 'Cashes' },
  { id: 'nocash', label: 'No cash' },
];

const SORTS = {
  newest: { label: 'Newest first', fn: (a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) },
  oldest: { label: 'Oldest first', fn: (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0) },
  best: { label: 'Best result', fn: (a, b) => b.net - a.net },
  worst: { label: 'Worst result', fn: (a, b) => a.net - b.net },
  buyin: { label: 'Highest buy-in', fn: (a, b) => b.buyIn - a.buyIn },
};

const PAGE = 60;

export default function Tournaments() {
  const { toast, confirm } = useUI();
  const { data, error, loading, reload, setData } = useAsync(() => listTournaments(), []);
  const [q, setQ] = useState('');
  const [result, setResult] = useState('all');
  const [venue, setVenue] = useState('');
  const [year, setYear] = useState('');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const all = useMemo(() => (data || []).map(enrich), [data]);
  const venues = useMemo(() => [...new Set(all.map((t) => t.location).filter(Boolean))].sort(), [all]);
  const years = useMemo(() => [...new Set(all.map((t) => String(t.date).slice(0, 4)))].sort().reverse(), [all]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const today = todayString();
    return all
      .filter((t) => !term || `${t.tournament_name} ${t.location} ${t.notes || ''}`.toLowerCase().includes(term))
      .filter((t) => (result === 'cash' ? t.cashed : result === 'nocash' ? !t.cashed && t.date <= today : true))
      .filter((t) => !venue || t.location === venue)
      .filter((t) => !year || String(t.date).startsWith(year))
      .sort(SORTS[sort].fn);
  }, [all, q, result, venue, year, sort]);

  const summary = useMemo(() => summarize(filtered), [filtered]);
  const isFiltered = q || result !== 'all' || venue || year;
  const groupByMonth = sort === 'newest' || sort === 'oldest';

  const groups = useMemo(() => {
    const shown = filtered.slice(0, limit);
    if (!groupByMonth) return [{ key: 'all', label: null, items: shown }];
    const out = [];
    shown.forEach((t) => {
      const key = String(t.date).slice(0, 7);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: formatMonth(t.date), items: [] };
        out.push(g);
      }
      g.items.push(t);
    });
    return out;
  }, [filtered, limit, groupByMonth]);

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const removeSelected = async () => {
    const ids = [...selected];
    const ok = await confirm({
      title: `Delete ${pluralize(ids.length, 'tournament')}?`,
      body: 'They’ll be removed from your stats and friends’ feeds. This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteTournaments(ids);
      setData((list) => list.filter((t) => !selected.has(t.id)));
      toast(`Deleted ${pluralize(ids.length, 'tournament')}.`);
      exitSelect();
    } catch (e) {
      toast(e.message, { type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    downloadText(`stacktrack-tournaments-${todayString()}.csv`, tournamentsToCsv(filtered));
    toast(`Exported ${pluralize(filtered.length, 'tournament')}.`);
  };

  const reset = () => {
    setQ('');
    setResult('all');
    setVenue('');
    setYear('');
  };

  return (
    <div className="page">
      <PageHeader
        title="Tournaments"
        actions={(
          <>
            <Link to="/tournaments/import" className="btn btn-ghost btn-sm"><Upload size={16} aria-hidden="true" /> Import</Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={16} aria-hidden="true" /> Export
            </button>
            <Link to="/tournaments/new" className="btn btn-primary btn-sm hide-mobile"><Plus size={16} aria-hidden="true" /> Add</Link>
          </>
        )}
      />
      <SectionTabs tabs={TRACK_TABS} label="Tournaments" />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={6} />}

      {data && all.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          action={(
            <div className="row wrap">
              <Link to="/tournaments/new" className="btn btn-primary">Add a tournament</Link>
              <Link to="/tournaments/import" className="btn btn-ghost">Import a spreadsheet</Link>
            </div>
          )}
        >
          Add the last tournament you played, or import your history from a CSV file.
        </EmptyState>
      )}

      {data && all.length > 0 && (
        <>
          <div className="filters">
            <div className="search grow">
              <Search size={18} aria-hidden="true" />
              <input className="input" type="search" placeholder="Search name, venue or notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tournaments" />
            </div>
            <div className="filters-row">
              <Segmented options={RESULT_FILTERS} value={result} onChange={setResult} label="Result" size="sm" />
              <select className="select select-sm" value={venue} onChange={(e) => setVenue(e.target.value)} aria-label="Venue">
                <option value="">All venues</option>
                {venues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select className="select select-sm" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="select select-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="list-summary">
            <span>
              {pluralize(filtered.length, 'tournament')}
              {isFiltered ? ` of ${all.length}` : ''}
              {filtered.length > 0 && <>, <Money value={summary.net} sign /> net</>}
            </span>
            <span className="row">
              {isFiltered && <button type="button" className="btn-text btn-link" onClick={reset}>Clear filters</button>}
              {!selecting ? (
                <button type="button" className="btn-text btn-link" onClick={() => setSelecting(true)}>
                  <CheckSquare size={15} aria-hidden="true" className="inline-icon" /> Select
                </button>
              ) : (
                <button type="button" className="btn-text btn-link" onClick={() => setSelected(new Set(filtered.map((t) => t.id)))}>Select all</button>
              )}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="No matches" action={<button type="button" className="btn btn-ghost" onClick={reset}>Clear filters</button>}>
              Nothing matches those filters.
            </EmptyState>
          ) : (
            <div className="month-list">
              {groups.map((g) => {
                const s = g.label ? summarize(g.items) : null;
                return (
                  <section key={g.key} className="month-group">
                    {g.label && (
                      <header className="month-head">
                        <h2>{g.label}</h2>
                        <span className="muted"><Money value={s.net} sign /></span>
                      </header>
                    )}
                    <ul className="list">
                      {g.items.map((t) => (
                        <li key={t.id}>
                          <TournamentRow t={t} selectable={selecting} selected={selected.has(t.id)} onToggle={toggle} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {filtered.length > limit && (
            <div className="load-more">
              <button type="button" className="btn btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({filtered.length - limit} left)
              </button>
            </div>
          )}
        </>
      )}

      {selecting && (
        <div className="select-bar" role="region" aria-label="Selection">
          <span><strong>{selected.size}</strong> selected</span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={exitSelect}>Cancel</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={removeSelected} disabled={!selected.size || deleting}>
              <Trash2 size={16} aria-hidden="true" /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
