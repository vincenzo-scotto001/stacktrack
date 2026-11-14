import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/layout/Logo';

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1 className="auth-title">This page folded.</h1>
        <p className="muted">The link may be old or mistyped.</p>
        <Link to="/" className="btn btn-primary">Go to StackTrack</Link>
      </div>
    </div>
  );
}
