import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="StackTrack home">
      <span className="logo-chip" aria-hidden="true" />
      StackTrack
    </Link>
  );
}
