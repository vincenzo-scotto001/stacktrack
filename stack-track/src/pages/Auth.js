import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, MailCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Logo from '../components/layout/Logo';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { USERNAME_RE } from '../api/profiles';

function friendlyAuthError(err) {
  const msg = err?.message || '';
  if (/invalid login/i.test(msg)) return 'That email and password don’t match. Check both and try again.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link we sent.';
  if (/already registered|already exists/i.test(msg)) return 'An account with that email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  if (/password/i.test(msg) && /characters/i.test(msg)) return msg;
  return msg || 'Something went wrong. Try again.';
}

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <div>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="muted auth-sub">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <p className="auth-footer">{footer}</p>}
    </div>
  );
}

function FormError({ children }) {
  if (!children) return null;
  return (
    <div className="form-error" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('signin'); // signin | reset | sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setMode('sent');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        navigate(location.state?.from || '/dashboard', { replace: true });
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'sent') {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a reset link to ${email}. It expires in an hour.`}>
        <MailCheck size={28} className="auth-icon" aria-hidden="true" />
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode('signin')}>Back to sign in</button>
      </AuthLayout>
    );
  }

  const resetting = mode === 'reset';
  return (
    <AuthLayout
      title={resetting ? 'Reset your password' : 'Welcome back'}
      subtitle={resetting ? 'Enter your email and we’ll send you a link to choose a new password.' : 'Sign in to your StackTrack account.'}
      footer={<>New to StackTrack? <Link to="/signup">Create an account</Link></>}
    >
      <form className="stack" onSubmit={submit} noValidate={false}>
        <FormError>{error}</FormError>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        {!resetting && (
          <div className="field">
            <div className="row-between">
              <label htmlFor="password" className="field-label">Password</label>
              <button type="button" className="btn-text btn-link" onClick={() => { setMode('reset'); setError(null); }}>
                Forgot password?
              </button>
            </div>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'One moment…' : resetting ? 'Send reset link' : 'Sign in'}
        </button>
        {resetting && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const username = form.username.trim().toLowerCase().replace(/^@/, '');
    if (username && !USERNAME_RE.test(username)) {
      setError('Usernames are 3–20 characters: lowercase letters, numbers and underscores.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { first_name: form.first_name.trim(), last_name: form.last_name.trim(), username: username || null },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (err) throw err;
      if (data.session) navigate('/dashboard', { replace: true });
      else setConfirmSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <AuthLayout title="Confirm your email" subtitle={`We sent a link to ${form.email}. Open it on this device to finish setting up your account.`}>
        <MailCheck size={28} className="auth-icon" aria-hidden="true" />
        <Link to="/signin" className="btn btn-ghost btn-block">Go to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, and it takes about a minute."
      footer={<>Already have an account? <Link to="/signin">Sign in</Link></>}
    >
      <form className="stack" onSubmit={submit}>
        <FormError>{error}</FormError>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="first_name">First name</label>
            <input id="first_name" className="input" autoComplete="given-name" value={form.first_name} onChange={set('first_name')} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" className="input" autoComplete="family-name" value={form.last_name} onChange={set('last_name')} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="username">Username <span className="field-optional">(optional)</span></label>
          <div className="input-affix">
            <span className="affix">@</span>
            <input id="username" className="input" autoComplete="username" autoCapitalize="none" spellCheck="false" value={form.username} onChange={set('username')} placeholder="yourname" />
          </div>
          <span className="field-hint">Friends can find you by it.</span>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={set('password')} required />
          <span className="field-hint">At least 6 characters.</span>
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { session, setRecovering } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (session === undefined) return null;
  if (!session) {
    return (
      <AuthLayout title="This link has expired" subtitle="Reset links work once and expire after an hour. Request a new one from the sign-in page.">
        <Link to="/signin" className="btn btn-primary btn-block">Go to sign in</Link>
      </AuthLayout>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('The passwords don’t match.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(friendlyAuthError(err));
      return;
    }
    setRecovering(false);
    toast('Password updated.');
    navigate('/dashboard', { replace: true });
  };

  return (
    <AuthLayout title="Choose a new password">
      <form className="stack" onSubmit={submit}>
        <FormError>{error}</FormError>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" className="input" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" className="input" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
