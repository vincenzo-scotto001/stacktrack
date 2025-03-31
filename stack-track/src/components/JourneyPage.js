import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import JourneyList from './JourneyList';
import CreateJourney from './CreateJourney';

function JourneyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }
      
      setUser(session.user);
      
      // Fetch user's journeys
      try {
        const { data, error } = await supabase
          .from('journeys')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setJourneys(data || []);
      } catch (err) {
        console.error('Error fetching journeys:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate]);

  const refreshJourneys = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setJourneys(data || []);
    } catch (err) {
      console.error('Error refreshing journeys:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJourneyCreated = () => {
    setIsCreating(false);
    refreshJourneys();
  };

  return (
    <div className="journey-page">
      <h2>Tourney Journey</h2>
      
      {error && <div className="error">{error}</div>}
      
      {!isCreating && journeys.length > 0 && (
        <div className="journey-actions">
          <button onClick={() => setIsCreating(true)} className="create-btn">
            Add New Journey
          </button>
        </div>
      )}
      
      
      {isCreating ? (
        <CreateJourney 
          user={user} 
          onCancel={() => setIsCreating(false)}
          onSuccess={handleJourneyCreated}
        />
      ) : loading ? (
        <div className="loading">Loading your journeys...</div>
      ) : journeys.length > 0 ? (
        <JourneyList 
          journeys={journeys} 
          onJourneyUpdated={refreshJourneys}
        />
      ) : (
        <div className="no-journeys">
          <p>You haven't created any tournament journeys yet.</p>
          <p>Create a journey to plan and track a series of tournaments!</p>
          <button onClick={() => setIsCreating(true)} className="create-btn">
            Create Your First Journey
          </button>
        </div>
      )}
    </div>
  );
}

export default JourneyPage;