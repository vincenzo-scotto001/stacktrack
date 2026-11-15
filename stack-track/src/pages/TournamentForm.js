import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Trash2, BadgeCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { PageLoader, ErrorState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import useAsync from '../hooks/useAsync';
import { listTournaments, createTournament, updateTournament, deleteTournaments } from '../api/tournaments';
import { enrich } from '../lib/stats';
import TournamentPicker from '../components/TournamentPicker';
import { fillFromSuggestion, scheduleLabel } from '../lib/catalog';
import { money, todayString } from '../lib/format';

const EMPTY = {
  tournament_name: '',
  date: todayString(),
  location: '',
  game_type: 'NLH',
  buy_in: '',
  action_sold: '',
  entries: '',
  place: '',
  winnings: '',
  notes: '',
  catalog_event_id: null,
};

const GAMES = ['NLH', 'PLO', 'PLO8', 'Mixed', 'Stud', 'Other'];

function fromRow(t) {
  const v = (x) => (x == null ? '' : String(x));
  return {
    tournament_name: t.tournament_name || '',
    date: t.date || todayString(),
    location: t.location || '',
    game_type: t.game_type || 'NLH',
    buy_in: v(t.buy_in),
    action_sold: t.action_sold ? v(t.action_sold) : '',
    entries: v(t.entries),
    place: v(t.place),
    winnings: Number(t.winnings) ? v(t.winnings) : '',
    notes: t.notes || '',
    catalog_event_id: t.catalog_event_id || null,
  };
}

export default function TournamentForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const { caps } = useAuth();
  const { toast, confirm } = useUI();
  const history = useAsync(() => listTournaments(), []);
  const [values, setValues] = useState(EMPTY);
  const [picked, setPicked] = useState(null);
  const [original, setOriginal] = useState(null);
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = useMemo(() => history.data || [], [history.data]);

  useEffect(() => {
    if (!editing || !history.data) return;
    const row = history.data.find((t) => String(t.id) === String(id));
    if (row) {
      setOriginal(row);
      setValues(fromRow(row));
    }
  }, [editing, id, history.data]);

  const venues = useMemo(() => [...new Set(list.map((t) => t.location).filter(Boolean))], [list]);
  const preview = enrich(values);
  const hasResultInput = values.place !== '' || values.winnings !== '';

  // Editing what identifies the tournament drops the catalog link; the
  // database then matches or creates the right entry on save.
  const LINK_FIELDS = ['tournament_name', 'location', 'buy_in'];
  const update = (k, val) => {
    setValues((v) => ({ ...v, [k]: val, ...(LINK_FIELDS.includes(k) ? { catalog_event_id: null } : {}) }));
    if (LINK_FIELDS.includes(k)) setPicked(null);
  };
  const set = (k) => (e) => update(k, e.target.value);

  const placeRef = useRef(null);
  const pickSuggestion = (sugg) => {
    setValues((v) => ({ ...v, ...fillFromSuggestion(sugg, v) }));
    setPicked(sugg.source === 'history' ? null : sugg);
    // Everything about the tournament is filled; the result is what's left.
    setTimeout(() => placeRef.current && placeRef.current.focus(), 0);
  };


  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateTournament(id, values, original);
        toast('Changes saved.');
        navigate('/tournaments');
      } else {
        await createTournament(values, { postToFeed: share });
        toast('Tournament saved.', { action: { label: 'Add another', onClick: () => navigate('/tournaments/new') } });
        navigate('/tournaments');
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this tournament?',
      body: 'It will be removed from your stats and friends’ feeds. This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteTournaments([id]);
      toast('Tournament deleted.');
      navigate('/tournaments');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (history.loading && !history.data) return <PageLoader />;
  if (editing && history.data && !original) {
    return (
      <div className="page page-narrow">
        <ErrorState error="That tournament doesn’t exist or isn’t yours." />
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title={editing ? 'Edit tournament' : 'Add tournament'}
        back={{ to: '/tournaments', label: 'Tournaments' }}
      />


      <form onSubmit={submit} className="panel form-panel">
        {error && (
          <div className="form-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <section className="form-section">
          <h2 className="form-section-title">The tournament</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="tournament_name">Name</label>
              <TournamentPicker
                id="tournament_name"
                value={values.tournament_name}
                onChange={(name) => update('tournament_name', name)}
                onPick={pickSuggestion}
                date={values.date}
                placeholder="Start typing: venue, series or event"
                required
                autoFocus={!editing}
                describedBy={picked ? 'picked-note' : undefined}
              />
              {picked && (
                <p className="picked-note" id="picked-note">
                  <BadgeCheck size={15} aria-hidden="true" />
                  <span className="picked-text">
                    <span>
                      {picked.source === 'official' ? 'From the official schedule' : 'From the StackTrack catalog'}
                      {picked.series_name ? `: ${picked.series_name}` : ''}
                    </span>
                    {scheduleLabel(picked) && <span className="faint">{scheduleLabel(picked)}</span>}
                    {picked.guarantee ? <span className="faint num">{money(picked.guarantee)} guaranteed</span> : null}
                  </span>
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="date">Date</label>
              <input id="date" className="input" type="date" value={values.date} onChange={set('date')} required />
            </div>
            <div className="field">
              <label htmlFor="location">Venue</label>
              <input id="location" className="input" list="venues" value={values.location} onChange={set('location')} placeholder="Casino or site" />
              <datalist id="venues">{venues.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="buy_in">Total buy-in</label>
              <div className="input-affix">
                <span className="affix">$</span>
                <input id="buy_in" className="input" type="number" inputMode="decimal" min="0" step="any" value={values.buy_in} onChange={set('buy_in')} required />
              </div>
              <span className="field-hint">Include re-entries and add-ons.</span>
            </div>
            <div className="field">
              <label htmlFor="action_sold">Action sold <span className="field-optional">(optional)</span></label>
              <div className="input-affix has-right">
                <input id="action_sold" className="input" type="number" inputMode="decimal" min="0" max="100" step="any" value={values.action_sold} onChange={set('action_sold')} placeholder="0" />
                <span className="affix affix-right">%</span>
              </div>
              <span className="field-hint">Your stats count only the share you kept.</span>
            </div>
            {caps.tournamentExtras && (
              <div className="field">
                <label htmlFor="game_type">Game</label>
                <select id="game_type" className="select" value={values.game_type} onChange={set('game_type')}>
                  {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
          </div>
        </section>

        <section className="form-section">
          <h2 className="form-section-title">Result</h2>
          <p className="form-section-note">Still playing or just registered? Leave this empty and add it later.</p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="place">Finish</label>
              <input id="place" ref={placeRef} className="input" type="number" inputMode="numeric" min="1" step="1" value={values.place} onChange={set('place')} placeholder="e.g. 14" />
            </div>
            {caps.tournamentExtras && (
              <div className="field">
                <label htmlFor="entries">Entries</label>
                <input id="entries" className="input" type="number" inputMode="numeric" min="1" step="1" value={values.entries} onChange={set('entries')} placeholder="Field size" />
              </div>
            )}
            <div className={`field ${caps.tournamentExtras ? 'span-2' : ''}`}>
              <label htmlFor="winnings">Cashed for</label>
              <div className="input-affix">
                <span className="affix">$</span>
                <input id="winnings" className="input" type="number" inputMode="decimal" min="0" step="any" value={values.winnings} onChange={set('winnings')} placeholder="0" />
              </div>
            </div>
          </div>
          {(hasResultInput || values.buy_in) && (
            <div className="net-preview" aria-live="polite">
              <span className="muted">Your net result</span>
              <span className={`num net-preview-value ${preview.net > 0 ? 'gain' : preview.net < 0 ? 'loss' : ''}`}>
                {money(preview.net, { sign: true })}
              </span>
              {preview.sold > 0 && <span className="faint">after {Math.round(preview.sold * 100)}% sold</span>}
            </div>
          )}
        </section>

        {caps.tournamentExtras && (
          <section className="form-section">
            <div className="field">
              <label htmlFor="notes">Notes <span className="field-optional">(optional)</span></label>
              <textarea id="notes" className="textarea" value={values.notes} onChange={set('notes')} placeholder="Key hands, how you felt, who you sold to…" maxLength={2000} />
            </div>
          </section>
        )}

        {!editing && (
          <section className="form-section">
            <label className="switch">
              <span>
                <strong>Share with friends</strong>
                <span className="field-hint block">Posts this to your friends’ feeds.</span>
              </span>
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            </label>
          </section>
        )}

        <div className="form-actions">
          {editing && (
            <button type="button" className="btn btn-ghost btn-danger-text mr-auto" onClick={remove} disabled={busy}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save tournament'}
          </button>
        </div>
      </form>
    </div>
  );
}
