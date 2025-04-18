import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import FriendActivity from './FriendActivity';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }
      
      setUser(session.user);
      
      // Fetch user profile from stacktrackmaster table
      try {
        const { data, error } = await supabase
          .from('stacktrackmaster')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (error) throw error;
        
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard">
      <h2>Hi {profile.first_name}, welcome to your dashboard.</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="dashboard-actions">
        <h3>Quick Actions</h3>
        <div className="dashboard-actions-buttons">
          <button onClick={() => navigate('/register-tournament')}>Add a Tournament</button>
          <button onClick={() => navigate('/tournaments')}>View My Tournaments</button>
          <button onClick={() => navigate('/stats')}>View Stats</button>
          <button onClick={() => navigate('/journeys')}>Tourney Journeys</button>
        </div>
      </div>

      {profile && <FriendActivity />}
      
      <button onClick={handleSignOut} className="sign-out">
        Sign Out
      </button>
    </div>
  );
}

export default Dashboard;