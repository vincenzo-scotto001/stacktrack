import React from 'react';
import { NavLink } from 'react-router-dom';

/** Tabs that switch between sibling pages (e.g. Feed / Friends / Leaderboard). */
export default function SectionTabs({ tabs, label }) {
  return (
    <nav className="segmented section-tabs" aria-label={label}>
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
          {t.label}
          {t.badge ? <span className="seg-badge">{t.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}

export const TRACK_TABS = [
  { to: '/tournaments', label: 'Played', end: true },
  { to: '/journeys', label: 'Journeys' },
];

export const SOCIAL_TABS = [
  { to: '/feed', label: 'Feed' },
  { to: '/friends', label: 'Friends' },
  { to: '/leaderboard', label: 'Leaderboard' },
];
