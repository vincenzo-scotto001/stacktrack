import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Search, ChevronLeft } from 'lucide-react';
import { searchSeries, getSeries } from '../api/catalog';
import { scheduleLabel, formatTime } from '../lib/catalog';
import { formatDayRange, money, pluralize } from '../lib/format';
import { Skeleton, ErrorState } from './ui/States';

/**
 * "Start from a published schedule": find a series, tick the events you plan
 * to play, and hand them to the journey form.
 */
export default function SchedulePicker({ onUse, onClose }) {
  const [term, setTerm] = useState('');
  const [list, setList] = useState(null);
  const [series, setSeries] = useState(null);
  const [chosen, setChosen] = useState(() => new Set());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      searchSeries(term).then((r) => alive && setList(r)).catch((e) => alive && setError(e));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);

  const open = async (s) => {
    setLoading(true);
    setError(null);
    try {
      const full = await getSeries(s.id);
      setSeries(full);
      setChosen(new Set());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  // Journeys need dates, so weekly events stay out of this list.
  const dated = useMemo(() => (series ? series.events.filter((e) => e.event_date) : []), [series]);
  const total = dated.filter((e) => chosen.has(e.id)).reduce((s, e) => s + (Number(e.buy_in) || 0), 0);

  const toggle = (id) => setChosen((c) => {
    const next = new Set(c);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (series) {
    const allOn = dated.length > 0 && dated.every((e) => chosen.has(e.id));
    return (
      <section className="panel schedule-picker" aria-label={`Events in ${series.name}`}>
        <button type="button" className="back-link btn-reset" onClick={() => setSeries(null)}>
          <ChevronLeft size={18} aria-hidden="true" /> All schedules
        </button>
        <div className="row-between wrap">
          <div>
            <h2>{series.name}</h2>
            <p className="muted">{[series.venue, formatDayRange(series.start_date, series.end_date)].filter(Boolean).join(', ')}</p>
          </div>
          {dated.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChosen(allOn ? new Set() : new Set(dated.map((e) => e.id)))}>
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
        {dated.length === 0 ? (
          <p className="muted">This schedule has no dated events yet.</p>
        ) : (
          <ul className="list schedule-events">
            {dated.map((e) => (
              <li key={e.id}>
                <label className={`list-row is-selectable ${chosen.has(e.id) ? 'is-selected' : ''}`}>
                  <input type="checkbox" className="row-check" checked={chosen.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="list-main">
                    <span className="list-title">{e.name}</span>
                    <span className="list-meta">
                      <span>{scheduleLabel(e)}</span>
                      {e.guarantee ? <span className="num">{money(e.guarantee)} GTD</span> : null}
                    </span>
                  </span>
                  <span className="list-end"><span className="num">{money(e.buy_in)}</span></span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="schedule-picker-foot">
          <span className="muted">{chosen.size ? `${pluralize(chosen.size, 'event')}, ${money(total)} in buy-ins` : 'Tick the events you plan to play.'}</span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!chosen.size}
              onClick={() => onUse({ series, events: dated.filter((e) => chosen.has(e.id)) })}
            >
              Add {chosen.size ? pluralize(chosen.size, 'event') : 'events'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel schedule-picker" aria-label="Published schedules">
      <div className="row-between">
        <h2><CalendarRange size={18} aria-hidden="true" className="inline-icon" /> Start from a schedule</h2>
        <button type="button" className="btn btn-text btn-sm" onClick={onClose}>Close</button>
      </div>
      <div className="search">
        <Search size={18} aria-hidden="true" />
        <input className="input" type="search" placeholder="Search series, venue or city" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search schedules" autoFocus />
      </div>
      {error && <ErrorState error={error} />}
      {(loading || list === null) && <Skeleton rows={3} height={52} />}
      {list && !loading && list.length === 0 && (
        <p className="muted">No schedules match. You can still add events one by one below.</p>
      )}
      {list && !loading && list.length > 0 && (
        <ul className="list">
          {list.map((s) => (
            <li key={s.id}>
              <button type="button" className="list-row" onClick={() => open(s)}>
                <span className="list-main">
                  <span className="list-title">{s.name}</span>
                  <span className="list-meta">
                    {s.venue && <span>{s.venue}</span>}
                    {(s.start_date || s.end_date) && <span>{formatDayRange(s.start_date, s.end_date)}</span>}
                  </span>
                </span>
                <span className="list-end"><span className="faint">{pluralize(Number(s.event_count) || 0, 'event')}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Journey event rows for picked schedule events, with start time and guarantee in the notes. */
export function scheduleToEvents(series, events) {
  return events.map((e) => ({
    key: `s-${e.id}`,
    tournament_name: e.name,
    date: e.event_date,
    location: e.venue || series.venue || '',
    buy_in: e.buy_in != null ? String(e.buy_in) : '',
    action_sold: '',
    notes: [e.start_time ? `${formatTime(e.start_time)} start` : '', e.guarantee ? `${money(e.guarantee)} GTD` : ''].filter(Boolean).join(', '),
  }));
}
