import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

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
          console.log("Query result:", data, error);
          
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
      <h2>Welcome to Your Dashboard, {profile.first_name}.</h2>
      
      {error && <div className="error">{error}</div>}
      
      {profile && (
        <div className="profile-info">
          <h3>Your Profile</h3>
          <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Phone:</strong> {profile.phone}</p>
        </div>
      )}
      
      <div className="dashboard-actions">
        <h3>Quick Actions</h3>
        <button onClick={() => navigate('/register-tournament')}>Add a Tournament</button>
        <button onClick={() => navigate('/tournaments')}>View My Tournaments</button>
        <button onClick={() => navigate('/stats')}>View Stats</button>
      </div>
      
      <button onClick={handleSignOut} className="sign-out">
        Sign Out
      </button>
    </div>
  );
}

export default Dashboard;