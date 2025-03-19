import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import TournamentTable from './TournamentTable';

function TournamentsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
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
      
      // Fetch user's tournaments
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('user_id', session.user.id);
          
        if (error) throw error;
        
        setTournaments(data || []);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate]);

  return (
    <div className="tournaments-page">
      <h2>My Tournaments</h2>
      
      {error && <div className="error">{error}</div>}
      
      {loading ? (
        <div className="loading">Loading your tournaments...</div>
      ) : tournaments.length > 0 ? (
        <TournamentTable tournaments={tournaments} />
      ) : (
        <div className="no-tournaments">
          <p>You haven't played in any tournaments yet.</p>
          <button onClick={() => navigate('/register-tournament')} className="register-btn">
            Add a Tournament
          </button>
        </div>
      )}
      
      <button onClick={() => navigate('/dashboard')} className="back-btn">
        Back to Dashboard
      </button>
    </div>
  );
}

export default TournamentsPage;