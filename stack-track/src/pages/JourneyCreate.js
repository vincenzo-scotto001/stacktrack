import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Plus, Copy, Trash2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EventFields from '../components/EventFields';
import { useUI } from '../context/UIContext';
import { createJourney } from '../api/journeys';
import { enrich } from '../lib/stats';
import { money, pluralize } from '../lib/format';

const blank = (date = '', location = '') => ({ key: Math.random().toString(36).slice(2), tournament_name: '', date, location, buy_in: '', action_sold: '', notes: '' });

export default function JourneyCreate() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const [journey, setJourney] = useState({ name: '', start_date: '', end_date: '' });
  const [events, setEvents] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const setJ = (k) => (e) => setJourney((j) => ({ ...j, [k]: e.target.value }));
  const update = (key, next) => setEvents((list) => list.map((ev) => (ev.key === key ? { ...next, key } : ev)));
  const remove = (key) => setEvents((list) => (list.length > 1 ? list.filter((ev) => ev.key !== key) : list));
  const duplicate = (ev) => setEvents((list) => {
    const i = list.findIndex((x) => x.key === ev.key);
    const copy = { ...ev, key: Math.random().toString(36).slice(2) };
    return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
  });
  const add = () => {
    const last = events[events.length - 1];
    setEvents((list) => [...list, blank(last?.date || journey.start_date, last?.location || '')]);
  };

  const total = events.reduce((s, e) => s + (Number(e.buy_in) || 0), 0);
  const yours = events.reduce((s, e) => s + enrich(e).cost, 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const j = await createJourney(journey, events);
      toast('Journey created.');
      navigate(`/journeys/${j.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="New journey" back={{ to: '/journeys', label: 'Journeys' }} subtitle="Plan every event of a series or trip." />
      <form onSubmit={submit} className="stack-lg">
        {error && <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}

        <section className="panel">
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="j-name">Name</label>
              <input id="j-name" className="input" value={journey.name} onChange={setJ('name')} placeholder="e.g. WSOP 2027, Borgata Winter Open" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="j-start">Starts</label>
              <input id="j-start" className="input" type="date" value={journey.start_date} onChange={setJ('start_date')} required />
            </div>
            <div className="field">
              <label htmlFor="j-end">Ends</label>
              <input id="j-end" className="input" type="date" min={journey.start_date} value={journey.end_date} onChange={setJ('end_date')} required />
            </div>
          </div>
        </section>

        <section>
          <h2 className="group-title">Events</h2>
          <div className="stack">
            {events.map((ev, i) => (
              <div className="panel event-editor" key={ev.key}>
                <div className="row-between event-editor-head">
                  <span className="muted">Event {i + 1}</span>
                  <div className="row">
                    <button type="button" className="icon-btn" onClick={() => duplicate(ev)} aria-label={`Duplicate event ${i + 1}`} title="Duplicate"><Copy size={17} /></button>
                    <button type="button" className="icon-btn" onClick={() => remove(ev.key)} disabled={events.length === 1} aria-label={`Remove event ${i + 1}`} title="Remove"><Trash2 size={17} /></button>
                  </div>
                </div>
                <EventFields value={ev} onChange={(next) => update(ev.key, next)} minDate={journey.start_date} maxDate={journey.end_date} idPrefix={ev.key} />
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-block" onClick={add}><Plus size={18} aria-hidden="true" /> Add event</button>
          </div>
        </section>

        <div className="journey-total panel">
          <div><span className="muted">{pluralize(events.length, 'event')}</span><strong className="num">{money(total)}</strong><span className="faint">in buy-ins</span></div>
          {yours !== total && <div><span className="muted">Your share</span><strong className="num">{money(yours)}</strong><span className="faint">after action sold</span></div>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/journeys')} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create journey'}</button>
        </div>
      </form>
    </div>
  );
}
