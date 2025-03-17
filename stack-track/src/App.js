import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import SignUp from './components/signup';
import SignIn from './components/signin';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>StackTrack</h1>
          <nav>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/signup">Sign Up</Link></li>
              <li><Link to="/signin">Sign In</Link></li>
            </ul>
          </nav>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        
        <footer>
          <p>&copy; 2025 StackTrack</p>
        </footer>
      </div>
    </Router>
  );
}

// Simple Home component
function Home() {
  return (
    <div className="home">
      <h2>Welcome to StackTrack!</h2>
      <p>Track your poker tournaments, statistics, and connect with other players.</p>
    </div>
  );
}

export default App;