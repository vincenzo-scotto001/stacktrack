import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, Upload, AlertCircle, CalendarRange, ExternalLink, Lock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import {
  searchSeries, getSeries, createSeries, deleteSeries, deleteCatalogEvent, addSeriesEvents, eventKey,
} from '../api/catalog';
import { importScheduleFromCsv } from '../lib/csv';
import { scheduleLabel } from '../lib/catalog';
import { formatDayRange, money, pluralize } from '../lib/format';

const EXAMPLE = [
  'Date\tTime\t#\tEvent\tBuy-in\tGTD',
  'Jan 8, 2027\t11:00 AM\t1\t$400 NLH Kickoff\t$400\t$100K',
  'Jan 12, 2027\t11:00 AM\t5\t$600 NLH Deepstack\t$600\t$250K',
].join('\n');

function NewSeriesModal({ onClose, onCreated }) {
  const [v, setV] = useState({ name: '', venue: '', city: '', start_date: '', end_date: '', source_url: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await createSeries(v));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal title="New series" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {error && <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="ns-name">Name</label>
            <input id="ns-name" className="input" value={v.name} onChange={set('name')} placeholder="e.g. Borgata Winter Poker Open 2027, or Borgata dailies" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="ns-venue">Venue</label>
            <input id="ns-venue" className="input" value={v.venue} onChange={set('venue')} placeholder="Borgata" />
            <span className="field-hint">Used for every event unless a row says otherwise.</span>
          </div>
          <div className="field">
            <label htmlFor="ns-city">City <span className="field-optional">(optional)</span></label>
            <input id="ns-city" className="input" value={v.city} onChange={set('city')} placeholder="Atlantic City" />
          </div>
          <div className="field">
            <label htmlFor="ns-start">Starts <span className="field-optional">(optional)</span></label>
            <input id="ns-start" className="input" type="date" value={v.start_date} onChange={set('start_date')} />
          </div>
          <div className="field">
            <label htmlFor="ns-end">Ends <span className="field-optional">(optional)</span></label>
            <input id="ns-end" className="input" type="date" min={v.start_date} value={v.end_date} onChange={set('end_date')} />
          </div>
          <div className="field span-2">
            <label htmlFor="ns-url">Where the schedule came from <span className="field-optional">(optional)</span></label>
            <input id="ns-url" className="input" type="url" value={v.source_url} onChange={set('source_url')} placeholder="https://…" />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create series'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SeriesDetail({ id, onDeleted }) {
  const { toast, confirm } = useUI();
  const { data: series, error, loading, reload } = useAsync(() => getSeries(id), [id]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const parsed = useMemo(() => (text.trim() ? importScheduleFromCsv(text) : null), [text]);
  const existing = useMemo(() => new Set((series?.events || []).map(eventKey)), [series]);
  const fresh = parsed ? parsed.rows.filter((r) => !existing.has(eventKey(r))) : [];

  if (loading && !series) return <Skeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  };

  const run = async () => {
    setBusy(true);
    try {
      const { added, skipped } = await addSeriesEvents(series, parsed.rows);
      toast(`Added ${pluralize(added, 'event')}${skipped ? `, skipped ${skipped} already listed` : ''}.`);
      setText('');
      await reload({ quiet: true });
    } catch (e) {
      toast(e.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removeEvent = async (ev) => {
    const ok = await confirm({ title: `Delete ${ev.name}?`, body: 'Players who already logged it keep their results.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteCatalogEvent(ev.id);
      await reload({ quiet: true });
    } catch (e) {
      toast(e.message, { type: 'error' });
    }
  };

  const removeSeries = async () => {
    const ok = await confirm({
      title: `Delete ${series.name}?`,
      body: `Removes the series and its ${pluralize(series.events.length, 'event')} from suggestions. Players who already logged them keep their results.`,
      confirmLabel: 'Delete series',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSeries(series.id);
      toast('Series deleted.');
      onDeleted();
    } catch (e) {
      toast(e.message, { type: 'error' });
    }
  };

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="row-between wrap">
          <div>
            <h2>{series.name}</h2>
            <p className="muted">{[series.venue, series.city, (series.start_date || series.end_date) && formatDayRange(series.start_date, series.end_date)].filter(Boolean).join(', ')}</p>
            {series.source_url && (
              <a href={series.source_url} target="_blank" rel="noreferrer" className="import-hint">
                Source <ExternalLink size={13} className="inline-icon" aria-hidden="true" />
              </a>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={removeSeries}><Trash2 size={16} aria-hidden="true" /> Delete series</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Import events</h2></div>
        <div className="stack">
          <p className="import-hint">
            Copy the rows from a spreadsheet and paste them here, header row included, or upload a CSV.
            Columns: <code>Date</code> (or <code>Day</code> for weekly events: Monday, Daily), <code>Event</code>, <code>Buy-in</code>,
            and optionally <code>Time</code>, <code>#</code>, <code>Game</code>, <code>GTD</code>, <code>Venue</code>.
          </p>
          <textarea
            className="textarea paste-box"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            aria-label="Paste schedule rows"
            spellCheck="false"
          />
          <div className="row wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}><Upload size={16} aria-hidden="true" /> Upload CSV</button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden onChange={(e) => readFile(e.target.files[0])} />
            {text && <button type="button" className="btn btn-text btn-sm" onClick={() => setText('')}>Clear</button>}
          </div>

          {parsed && parsed.errors.length > 0 && (
            <div className="form-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <div>
                <strong>{parsed.rows.length ? `${pluralize(parsed.errors.length, 'row')} can’t be imported` : 'Can’t read this schedule'}</strong>
                <ul className="error-list">
                  {parsed.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
                  {parsed.errors.length > 6 && <li>…and {parsed.errors.length - 6} more</li>}
                </ul>
              </div>
            </div>
          )}

          {parsed && parsed.rows.length > 0 && (
            <>
              <div className="row-between wrap">
                <p>
                  <strong>{pluralize(fresh.length, 'event')}</strong> ready to add
                  {parsed.rows.length > fresh.length && <span className="muted">. {parsed.rows.length - fresh.length} already in this series will be skipped.</span>}
                </p>
                <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !fresh.length}>
                  {busy ? 'Adding…' : `Add ${pluralize(fresh.length, 'event')}`}
                </button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>When</th><th>Event</th><th className="r">Buy-in</th><th className="r">GTD</th></tr></thead>
                  <tbody>
                    {fresh.slice(0, 10).map((r) => (
                      <tr key={eventKey(r)}>
                        <td className="num">{scheduleLabel({ ...r, source: 'official' })}</td>
                        <td>{r.name}</td>
                        <td className="r num">{money(r.buy_in)}</td>
                        <td className="r num">{r.guarantee ? money(r.guarantee) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fresh.length > 10 && <p className="muted">Showing the first 10.</p>}
            </>
          )}
        </div>
      </section>

      <section className="panel panel-flush">
        <div className="panel-head"><h2>{series.events.length ? pluralize(series.events.length, 'event') : 'Events'}</h2></div>
        {series.events.length === 0 ? (
          <p className="muted panel-pad">No events yet. Paste the schedule above.</p>
        ) : (
          <div className="table-wrap">
            <table className="table events-table">
              <thead><tr><th>When</th><th>Event</th><th className="r">Buy-in</th><th className="r">GTD</th><th className="r"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {series.events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="num">{scheduleLabel(ev)}</td>
                    <td>{ev.name}{ev.player_count > 0 && <div className="faint">{pluralize(ev.player_count, 'player')} logged it</div>}</td>
                    <td className="r num">{money(ev.buy_in)}</td>
                    <td className="r num">{ev.guarantee ? money(ev.guarantee) : '–'}</td>
                    <td className="r"><button type="button" className="icon-btn" onClick={() => removeEvent(ev)} aria-label={`Delete ${ev.name}`}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminSchedules() {
  const { caps } = useAuth();
  const [params, setParams] = useSearchParams();
  const current = params.get('series');
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useAsync(() => (caps.admin ? searchSeries(term) : Promise.resolve([])), [term, caps.admin]);

  if (!caps.admin) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Schedules" />
        <EmptyState icon={Lock} title="Admins only">
          Official schedules are managed by StackTrack admins. If you run a poker room or series and want your schedule listed, contact us.
        </EmptyState>
      </div>
    );
  }

  const select = (id) => setParams(id ? { series: id } : {});

  return (
    <div className="page">
      <PageHeader
        title="Schedules"
        subtitle="Official schedules players can pick from instead of typing. Load a series once and everyone gets it."
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> New series</button>}
      />
      <div className="admin-grid">
        <section className="panel panel-flush series-list">
          <div className="panel-pad">
            <div className="search">
              <Search size={18} aria-hidden="true" />
              <input className="input" type="search" placeholder="Find a series" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Find a series" />
            </div>
          </div>
          {list.error && <div className="panel-pad"><ErrorState error={list.error} onRetry={list.reload} /></div>}
          {list.loading && !list.data && <div className="panel-pad"><Skeleton rows={3} height={48} /></div>}
          {list.data && list.data.length === 0 && <p className="muted panel-pad">No series yet. Create one to start.</p>}
          {list.data && list.data.length > 0 && (
            <ul className="list">
              {list.data.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`list-row ${current === s.id ? 'is-current' : ''}`} onClick={() => select(s.id)}>
                    <span className="list-main">
                      <span className="list-title">{s.name}</span>
                      <span className="list-meta">
                        {s.venue && <span>{s.venue}</span>}
                        <span>{pluralize(Number(s.event_count) || 0, 'event')}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div>
          {current ? (
            <SeriesDetail key={current} id={current} onDeleted={() => { select(null); list.reload({ quiet: true }); }} />
          ) : (
            <EmptyState icon={CalendarRange} title="Pick a series or create one">
              Each series holds a schedule: a festival with dated events, or a room’s weekly dailies.
            </EmptyState>
          )}
        </div>
      </div>
      {creating && (
        <NewSeriesModal
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setCreating(false);
            list.reload({ quiet: true });
            select(s.id);
          }}
        />
      )}
    </div>
  );
}
