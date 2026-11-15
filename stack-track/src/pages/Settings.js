import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Download, Upload, LogOut, Smartphone, Share } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { supabase, isDemo } from '../supabaseClient';
import { updateProfile } from '../api/profiles';
import { listTournaments } from '../api/tournaments';
import { tournamentsToCsv, downloadText } from '../lib/csv';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { pluralize, todayString } from '../lib/format';

function ProfileForm() {
  const { profile, setProfile, caps } = useAuth();
  const { toast } = useUI();
  const [form, setForm] = useState(() => ({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    username: profile?.username || '',
    home_venue: profile?.home_venue || '',
    bio: profile?.bio || '',
    share_results: profile?.share_results !== false,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await updateProfile(form);
      setProfile(p);
      toast('Profile saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head"><h2>Profile</h2></div>
      {error && <div className="form-error section-gap" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="s-first">First name</label>
          <input id="s-first" className="input" value={form.first_name} onChange={set('first_name')} required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="s-last">Last name</label>
          <input id="s-last" className="input" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
        </div>
        {caps.profiles && (
          <>
            <div className="field">
              <label htmlFor="s-user">Username</label>
              <div className="input-affix">
                <span className="affix">@</span>
                <input id="s-user" className="input" value={form.username} onChange={set('username')} autoCapitalize="none" spellCheck="false" placeholder="yourname" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="s-venue">Home casino</label>
              <input id="s-venue" className="input" value={form.home_venue} onChange={set('home_venue')} placeholder="Where you play most" />
            </div>
            <div className="field span-2">
              <label htmlFor="s-bio">Bio <span className="field-optional">(optional)</span></label>
              <textarea id="s-bio" className="textarea" value={form.bio} onChange={set('bio')} maxLength={160} placeholder="Games, stakes, goals" />
              <span className="field-hint">{160 - form.bio.length} characters left</span>
            </div>
            <label className="switch span-2">
              <span>
                <strong>Share results with friends</strong>
                <span className="field-hint block">When off, friends see your profile but not your tournaments, results, graph or leaderboard rank.</span>
              </span>
              <input type="checkbox" checked={form.share_results} onChange={set('share_results')} />
            </label>
          </>
        )}
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { toast } = useUI();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setPw('');
      toast('Password updated.');
    }
  };
  return (
    <form onSubmit={save} className="stack">
      {error && <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
      <div className="field">
        <label htmlFor="s-pw">New password</label>
        <div className="row">
          <input id="s-pw" className="input grow" type="password" minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <button type="submit" className="btn btn-secondary" disabled={busy || pw.length < 6}>{busy ? 'Saving…' : 'Update'}</button>
        </div>
      </div>
    </form>
  );
}

export default function Settings() {
  const { user, signOut, caps } = useAuth();
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [installable, setInstallable] = useState(canPromptInstall());
  useEffect(() => onInstallChange(() => setInstallable(canPromptInstall())), []);

  const exportAll = async () => {
    try {
      const all = await listTournaments();
      downloadText(`stacktrack-all-${todayString()}.csv`, tournamentsToCsv(all));
      toast(`Exported ${pluralize(all.length, 'tournament')}.`);
    } catch (e) {
      toast(e.message, { type: 'error' });
    }
  };

  const doSignOut = async () => {
    const ok = await confirm({ title: 'Sign out?', confirmLabel: 'Sign out' });
    if (!ok) return;
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Settings"
        actions={<Link to={`/players/${user.id}`} className="btn btn-ghost btn-sm">View your profile</Link>}
      />
      <div className="stack-lg">
        <ProfileForm />

        <section className="panel">
          <div className="panel-head"><h2>Account</h2></div>
          <div className="stack">
            <div className="field">
              <span className="field-label">Email</span>
              <span className="muted">{user.email}</span>
            </div>
            {!isDemo && <PasswordForm />}
          </div>
        </section>

        {caps.admin && (
          <section className="panel">
            <div className="panel-head"><h2>Admin</h2></div>
            <p className="muted section-gap">Load official series schedules so players can pick events instead of typing them.</p>
            <Link to="/admin/schedules" className="btn btn-ghost">Manage schedules</Link>
          </section>
        )}

        <section className="panel">
          <div className="panel-head"><h2>Your data</h2></div>
          <p className="muted section-gap">Download every tournament as a CSV file, or bring in history from a spreadsheet.</p>
          <div className="row wrap">
            <button type="button" className="btn btn-ghost" onClick={exportAll}><Download size={16} aria-hidden="true" /> Export all tournaments</button>
            <Link to="/tournaments/import" className="btn btn-ghost"><Upload size={16} aria-hidden="true" /> Import from CSV</Link>
          </div>
        </section>

        {!isStandalone() && (installable || isIOS()) && (
          <section className="panel">
            <div className="panel-head"><h2>Install the app</h2></div>
            {installable ? (
              <button type="button" className="btn btn-secondary" onClick={promptInstall}><Smartphone size={16} aria-hidden="true" /> Install StackTrack</button>
            ) : (
              <p className="muted">In Safari, tap <Share size={15} className="inline-icon" aria-label="Share" /> then “Add to Home Screen”.</p>
            )}
          </section>
        )}

        <button type="button" className="btn btn-ghost btn-block" onClick={doSignOut}>
          <LogOut size={16} aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );
}
