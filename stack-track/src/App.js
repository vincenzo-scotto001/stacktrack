import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import SignUp from './components/signup';
import SignIn from './components/signin';
import Dashboard from './components/Dashboard';
import TournamentsPage from './components/TournamentsPage';
import AddTournament from './components/AddTournament';
import Stats from './components/Stats';
import Home from './components/Home';
import JourneyPage from './components/JourneyPage';
import FriendsPage from './components/FriendsPage';
import FriendStacks from './components/FriendStacks';
import PWAInstallPrompt from './components/PWAInstallPrompt';

function App() {
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    // Check for an active session when the component mounts
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Set up a listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setSession(session);
      }
    );

    // Clean up the subscription when the component unmounts
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          {/* Conditional link: dashboard if logged in, home if not */}
          <Link to={session ? "/dashboard" : "/"} className="logo-link">
            <h1>
              <span className="logo-stack">Stack</span>
              <span className="logo-track">Track</span>
            </h1>
          </Link>
          <nav>
            {/* <ul>
              {!session ? (
                // Show these links when user is not logged in
                <>
                  <li><Link to="/signup">Sign Up</Link></li>
                  <li><Link to="/signin">Sign In</Link></li>
                </>
              ) : (
                // Show these links when user is logged in
                <>
                </>
              )}
            </ul> */}
          </nav>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/register-tournament" element={<AddTournament />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/journeys" element={<JourneyPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/friend-stacks/:friendId" element={<FriendStacks />} />
          </Routes>
        </main>
        
        <footer>
          <p>&copy; 2025 StackTrack</p>
        </footer>
        <PWAInstallPrompt />
      </div>
    </Router>
  );
}

export default App;