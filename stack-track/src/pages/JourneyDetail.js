import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ClipboardCopy, Pencil, Trash2, AlertCircle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import ChipEdge from '../components/ui/ChipEdge';
import EventFields from '../components/EventFields';
import { journeyStatus, journeySegments } from '../components/JourneyCard';
import { PageLoader, ErrorState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { getJourney, saveEvent, deleteEvent, deleteJourney, updateJourneyDetails } from '../api/journeys';
import { summarize, enrich } from '../lib/stats';
import { formatDay, formatDayRange, money, ordinal, todayString, parseDay } from '../lib/format';

function scheduleText(j) {
  const lines = [`${j.name} (${formatDayRange(j.start_date, j.end_date)})`, ''];
  j.events.forEach((e) => {
    const sold = Number(e.action_sold) ? ` (${e.action_sold}% sold)` : '';
    lines.push(`${formatDay(e.date, { short: true })}  ${e.tournament_name}  ${money(e.buy_in)}${sold}`);
  });
  const total = j.events.reduce((s, e) => s + (Number(e.buy_in) || 0), 0);
  lines.push('', `Total buy-ins: ${money(total)}`);
  return lines.join('\n');
}

function EventModal({ journey, event, onClose, onSaved, onDeleted }) {
  const { toast, confirm } = useUI();
  const isNew = !event.id;
  const [value, setValue] = useState(() => ({
    ...event,
    place: event.place ?? '',
    winnings: Number(event.winnings) ? event.winnings : '',
    action_sold: Number(event.action_sold) ? event.action_sold : '',
    notes: event.notes || '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await saveEvent(journey, value, isNew ? null : event);
      toast(isNew ? 'Event added.' : 'Event saved.');
      onSaved(res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Delete this event?', body: 'Its result stays in your tournaments if it was already added there.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const j = await deleteEvent(journey, event);
      toast('Event deleted.');
      onDeleted(j);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Add event' : 'Edit event'} onClose={onClose} size="md">
      <form onSubmit={save} className="stack">
        {error && <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
        <EventFields value={value} onChange={setValue} minDate={journey.start_date} maxDate={journey.end_date} idPrefix="ev" withResult={!isNew || value.date <= todayString()} />
        <div className="form-actions">
          {!isNew && <button type="button" className="btn btn-ghost btn-danger-text mr-auto" onClick={remove} disabled={busy}><Trash2 size={16} aria-hidden="true" /> Delete</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add event' : 'Save event'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DetailsModal({ journey, onClose, onSaved }) {
  const { toast } = useUI();
  const [v, setV] = useState({ name: journey.name, start_date: journey.start_date, end_date: journey.end_date });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateJourneyDetails(journey.id, v);
      toast('Journey saved.');
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal title="Edit journey" onClose={onClose} size="sm">
      <form onSubmit={save} className="stack">
        {error && <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
        <div className="field"><label htmlFor="jd-name">Name</label><input id="jd-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="jd-start">Starts</label><input id="jd-start" className="input" type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} required /></div>
          <div className="field"><label htmlFor="jd-end">Ends</label><input id="jd-end" className="input" type="date" value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} required /></div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function JourneyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useUI();
  const { caps } = useAuth();
  const { data: journey, error, loading, reload } = useAsync(() => getJourney(id), [id]);
  const [editing, setEditing] = useState(null);
  const [editDetails, setEditDetails] = useState(false);

  const stats = useMemo(() => {
    if (!journey) return null;
    const done = journey.events.filter((e) => e.is_completed);
    const planned = journey.events.reduce((s, e) => s + (Number(e.buy_in) || 0), 0);
    const yours = journey.events.reduce((s, e) => s + enrich(e).cost, 0);
    return { done, planned, yours, result: summarize(done) };
  }, [journey]);

  if (loading && !journey) return <PageLoader />;
  if (error) return <div className="page page-narrow"><ErrorState error={error} onRetry={reload} /></div>;

  const status = journeyStatus(journey);
  const today = todayString();

  const copySchedule = async () => {
    const text = scheduleText(journey);
    try {
      await navigator.clipboard.writeText(text);
      toast('Schedule copied. Paste it to your backers.');
    } catch (e) {
      toast('Couldn’t copy. Your browser blocked clipboard access.', { type: 'error' });
    }
  };

  const removeJourney = async () => {
    const ok = await confirm({
      title: `Delete ${journey.name}?`,
      body: caps.journeyLinks ? 'Events you’ve already played stay in your tournaments.' : 'This removes the journey and its events. This can’t be undone.',
      confirmLabel: 'Delete journey',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteJourney(journey.id);
      toast('Journey deleted.');
      navigate('/journeys', { replace: true });
    } catch (e) {
      toast(e.message, { type: 'error' });
    }
  };

  const afterSave = () => {
    setEditing(null);
    reload({ quiet: true });
  };

  return (
    <div className="page">
      <PageHeader
        title={journey.name}
        subtitle={formatDayRange(journey.start_date, journey.end_date)}
        back={{ to: '/journeys', label: 'Journeys' }}
        actions={(
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copySchedule}><ClipboardCopy size={16} aria-hidden="true" /> Copy schedule</button>
            <button type="button" className="icon-btn" onClick={() => setEditDetails(true)} aria-label="Edit journey details"><Pencil size={18} /></button>
            <button type="button" className="icon-btn" onClick={removeJourney} aria-label="Delete journey"><Trash2 size={18} /></button>
          </>
        )}
      />

      <section className="panel journey-summary">
        <div className="row-between wrap">
          <span className={`tag ${status.tone}`}>{status.label}</span>
          <span className="muted">{stats.done.length} of {journey.events.length} events played</span>
        </div>
        <ChipEdge segments={journeySegments(journey.events)} label={`${stats.done.length} of ${journey.events.length} events played`} />
        <dl className="journey-figures">
          <div><dt>Planned buy-ins</dt><dd className="num">{money(stats.planned)}</dd></div>
          <div><dt>Your share</dt><dd className="num">{money(stats.yours)}</dd></div>
          <div><dt>Cashed</dt><dd className="num">{money(stats.done.reduce((s, e) => s + (Number(e.winnings) || 0), 0))}</dd></div>
          <div><dt>Net so far</dt><dd>{stats.done.length ? <Money value={stats.result.net} sign /> : <span className="faint">–</span>}</dd></div>
        </dl>
      </section>

      <section className="panel panel-flush section-gap-lg">
        <div className="panel-head">
          <h2>Schedule</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ tournament_name: '', date: journey.end_date < today ? journey.end_date : (journey.start_date > today ? journey.start_date : today), location: journey.events[0]?.location || '', buy_in: '', action_sold: '', notes: '', is_completed: false })}>
            <Plus size={16} aria-hidden="true" /> Add event
          </button>
        </div>
        <ul className="list">
          {journey.events.map((e) => {
            const r = enrich(e);
            const due = !e.is_completed && e.date <= today;
            return (
              <li key={e.id}>
                <button type="button" className={`list-row event-row ${e.is_completed ? 'is-done' : ''}`} onClick={() => setEditing(e)}>
                  <span className="event-date num">
                    <span>{parseDay(e.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <strong>{parseDay(e.date).getDate()}</strong>
                  </span>
                  <span className="list-main">
                    <span className="list-title">{e.tournament_name}</span>
                    <span className="list-meta">
                      <span className="num">{money(e.buy_in)}</span>
                      {r.sold > 0 && <span>{Math.round(r.sold * 100)}% sold</span>}
                      {e.notes && <span className="truncate">{e.notes}</span>}
                    </span>
                  </span>
                  <span className="list-end">
                    {e.is_completed ? (
                      <>
                        <Money value={r.net} sign />
                        <small>{r.cashed ? (e.place ? ordinal(e.place) : 'Cashed') : 'No cash'}</small>
                      </>
                    ) : due ? (
                      <span className="tag tag-orange">Add result</span>
                    ) : (
                      <span className="faint">Upcoming</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="faint fine-print">
        {caps.journeyLinks
          ? 'Each event you mark as played is added to your tournaments and stats right away.'
          : 'When every event is marked as played, the journey is added to your tournaments and stats.'}
      </p>

      {editing && (
        <EventModal
          journey={journey}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
          onDeleted={afterSave}
        />
      )}
      {editDetails && <DetailsModal journey={journey} onClose={() => setEditDetails(false)} onSaved={() => { setEditDetails(false); reload({ quiet: true }); }} />}
    </div>
  );
}
