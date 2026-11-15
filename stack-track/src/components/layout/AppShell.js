import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  House, Trophy, Route as RouteIcon, ChartNoAxesCombined, Newspaper, Users, Medal, Bell, Plus, Settings, CalendarRange,
} from 'lucide-react';
import Logo from './Logo';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { unreadNotificationCount } from '../../api/social';
import { fullName } from '../../lib/format';

function useUnreadCount(enabled) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => unreadNotificationCount().then((n) => alive && setCount(n)).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    const onRead = () => setCount(0);
    const onFocus = () => load();
    window.addEventListener('stacktrack:notifications-read', onRead);
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('stacktrack:notifications-read', onRead);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, location.pathname]);
  return count;
}

const SIDEBAR = [
  [
    { to: '/dashboard', label: 'Home', icon: House },
    { to: '/tournaments', label: 'Tournaments', icon: Trophy },
    { to: '/journeys', label: 'Journeys', icon: RouteIcon },
    { to: '/stats', label: 'Stats', icon: ChartNoAxesCombined },
  ],
  [
    { to: '/feed', label: 'Feed', icon: Newspaper },
    { to: '/friends', label: 'Friends', icon: Users },
    { to: '/leaderboard', label: 'Leaderboard', icon: Medal },
  ],
];

export default function AppShell() {
  const { profile, user, caps } = useAuth();
  const unread = useUnreadCount(caps.notifications);
  const { pathname } = useLocation();
  const inTrack = /^\/(tournaments|journeys)/.test(pathname) && pathname !== '/tournaments/new';
  const inSocial = /^\/(feed|friends|leaderboard|players|posts)/.test(pathname);

  return (
    <div className="shell">
      <a href="#main" className="sr-only">Skip to content</a>

      <aside className="sidebar">
        <Logo to="/dashboard" />
        <Link to="/tournaments/new" className="btn btn-primary btn-block">
          <Plus size={18} aria-hidden="true" /> Add tournament
        </Link>
        <nav aria-label="Main">
          {SIDEBAR.map((group, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="nav-group" key={i}>
              {group.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="nav-link" end={to === '/tournaments'}>
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-group">
            {caps.notifications && (
              <NavLink to="/notifications" className="nav-link">
                <Bell size={19} aria-hidden="true" />
                Notifications
                {unread > 0 && <span className="nav-count">{unread}</span>}
              </NavLink>
            )}
            {caps.admin && (
              <NavLink to="/admin/schedules" className="nav-link">
                <CalendarRange size={19} aria-hidden="true" />
                Schedules
              </NavLink>
            )}
            <NavLink to="/settings" className="nav-link">
              <Settings size={19} aria-hidden="true" />
              Settings
            </NavLink>
          </div>
        </nav>
        <Link to={`/players/${user.id}`} className="sidebar-me">
          <Avatar profile={profile} size={36} />
          <span className="grow truncate">
            <strong className="truncate">{fullName(profile)}</strong>
            <small>{profile?.username ? `@${profile.username}` : 'View your profile'}</small>
          </span>
        </Link>
      </aside>

      <header className="topbar">
        <Logo to="/dashboard" />
        <div className="topbar-actions">
          {caps.notifications && (
            <Link to="/notifications" className="icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
              <Bell size={21} />
              {unread > 0 && <span className="badge-dot">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          <Link to="/settings" className="topbar-me" aria-label="Profile and settings">
            <Avatar profile={profile} size={32} />
          </Link>
        </div>
      </header>

      <main id="main" className="content">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        <NavLink to="/dashboard" className="tab">
          <House size={22} aria-hidden="true" />
          Home
        </NavLink>
        <NavLink to="/tournaments" className={() => `tab ${inTrack ? 'active' : ''}`}>
          <Trophy size={22} aria-hidden="true" />
          Results
        </NavLink>
        <Link to="/tournaments/new" className="tab-add" aria-label="Add tournament">
          <span><Plus size={26} strokeWidth={2.5} /></span>
        </Link>
        <NavLink to="/stats" className="tab">
          <ChartNoAxesCombined size={22} aria-hidden="true" />
          Stats
        </NavLink>
        <NavLink to="/feed" className={() => `tab ${inSocial ? 'active' : ''}`}>
          <Users size={22} aria-hidden="true" />
          Social
        </NavLink>
      </nav>
    </div>
  );
}
