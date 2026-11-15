import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { RequireAuth, PublicOnly } from './components/layout/Guards';
import AppShell from './components/layout/AppShell';
import { PageLoader } from './components/ui/States';
import Landing from './pages/Landing';
import { SignIn, SignUp, ResetPassword } from './pages/Auth';
import NotFound from './pages/NotFound';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import ScrollToTop from './components/layout/ScrollToTop';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const TournamentForm = lazy(() => import('./pages/TournamentForm'));
const ImportTournaments = lazy(() => import('./pages/ImportTournaments'));
const Stats = lazy(() => import('./pages/Stats'));
const Journeys = lazy(() => import('./pages/Journeys'));
const JourneyCreate = lazy(() => import('./pages/JourneyCreate'));
const JourneyDetail = lazy(() => import('./pages/JourneyDetail'));
const Feed = lazy(() => import('./pages/Feed'));
const Friends = lazy(() => import('./pages/Friends'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const Post = lazy(() => import('./pages/Post'));
const AdminSchedules = lazy(() => import('./pages/AdminSchedules'));

function LegacyFriendRedirect() {
  const { friendId } = useParams();
  return <Navigate to={`/players/${friendId}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicOnly />}>
                <Route path="/" element={<Landing />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
              </Route>
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/tournaments" element={<Tournaments />} />
                  <Route path="/tournaments/new" element={<TournamentForm />} />
                  <Route path="/tournaments/import" element={<ImportTournaments />} />
                  <Route path="/tournaments/:id/edit" element={<TournamentForm />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/journeys" element={<Journeys />} />
                  <Route path="/journeys/new" element={<JourneyCreate />} />
                  <Route path="/journeys/:id" element={<JourneyDetail />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/players/:id" element={<PlayerProfile />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/posts/:id" element={<Post />} />
                  <Route path="/admin/schedules" element={<AdminSchedules />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>

              {/* Old URLs keep working */}
              <Route path="/register-tournament" element={<Navigate to="/tournaments/new" replace />} />
              <Route path="/friend-stacks/:friendId" element={<LegacyFriendRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <PWAInstallPrompt />
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
