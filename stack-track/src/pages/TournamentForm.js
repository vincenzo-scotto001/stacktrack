import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Trash2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { PageLoader, ErrorState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import useAsync from '../hooks/useAsync';
import { listTournaments, createTournament, updateTournament, deleteTournaments } from '../api/tournaments';
import { enrich } from '../lib/stats';
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
  };
}

/** Most-played tournaments, for one-tap prefill. */
function regulars(list) {
  const counts = new Map();
  list.forEach((t) => {
    const key = `${t.tournament_name}|${t.location}|${t.buy_in}`;
    const c = counts.get(key) || { t, n: 0 };
    c.n += 1;
    counts.set(key, c);
  });
  return [...counts.values()].filter((c) => c.n > 1).sort((a, b) => b.n - a.n).slice(0, 4).map((c) => c.t);
}

export default function TournamentForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const { caps } = useAuth();
  const { toast, confirm } = useUI();
  const history = useAsync(() => listTournaments(), []);
  const [values, setValues] = useState(EMPTY);
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

  const names = useMemo(() => [...new Set(list.map((t) => t.tournament_name))].slice(0, 50), [list]);
  const venues = useMemo(() => [...new Set(list.map((t) => t.location).filter(Boolean))], [list]);
  const quick = useMemo(() => (editing ? [] : regulars(list)), [list, editing]);
  const preview = enrich(values);
  const hasResultInput = values.place !== '' || values.winnings !== '';

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const prefill = (t) => setValues((v) => ({
    ...v,
    tournament_name: t.tournament_name,
    location: t.location || '',
    buy_in: String(t.buy_in ?? ''),
    game_type: t.game_type || v.game_type,
  }));

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

      {quick.length > 0 && (
        <div className="quick-fill">
          <span className="muted">Your regulars</span>
          <div className="row wrap">
            {quick.map((t) => (
              <button key={t.id} type="button" className="chip-btn" onClick={() => prefill(t)}>
                {t.tournament_name}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <input id="tournament_name" className="input" list="names" value={values.tournament_name} onChange={set('tournament_name')} placeholder="e.g. Borgata Fall Open $600 NLH" required autoFocus={!editing} />
              <datalist id="names">{names.map((n) => <option key={n} value={n} />)}</datalist>
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
              <input id="place" className="input" type="number" inputMode="numeric" min="1" step="1" value={values.place} onChange={set('place')} placeholder="e.g. 14" />
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
