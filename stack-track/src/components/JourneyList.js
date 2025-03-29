import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import JourneyDetail from './JourneyDetail';

function JourneyList({ journeys, onJourneyUpdated }) {
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleJourneyClick = async (journeyId) => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch journey details with its tournaments
      const { data, error } = await supabase
        .from('journey_tournaments')
        .select('*')
        .eq('journey_id', journeyId)
        .order('date', { ascending: true });
        
      if (error) throw error;
      
      const selectedJourneyData = journeys.find(j => j.id === journeyId);
      
      if (!selectedJourneyData) {
        throw new Error('Journey not found');
      }
      
      setSelectedJourney({
        ...selectedJourneyData,
        tournaments: data || []
      });
      
    } catch (err) {
      console.error('Error fetching journey details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedJourney(null);
    onJourneyUpdated(); // Refresh the list
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // If a journey is selected, show its detailed view
  if (selectedJourney) {
    return (
      <JourneyDetail 
        journey={selectedJourney} 
        onBack={handleBackToList} 
      />
    );
  }

  return (
    <div className="journey-list">
      {error && <div className="error">{error}</div>}
      
      {loading ? (
        <div className="loading">Loading journey details...</div>
      ) : (
        <>
          <div className="journey-grid">
            {journeys.map(journey => (
              <div className="journey-card" key={journey.id} onClick={() => handleJourneyClick(journey.id)}>
                <div className="journey-card-header">
                  <h3>{journey.name}</h3>
                  <span className={`journey-status ${journey.is_completed ? 'completed' : 'active'}`}>
                    {journey.is_completed ? 'Completed' : 'Active'}
                  </span>
                </div>
                
                <div className="journey-card-body">
                  <div className="journey-info">
                    <div className="journey-dates">
                      <p><strong>Dates:</strong> {formatDate(journey.start_date)} - {formatDate(journey.end_date)}</p>
                    </div>
                    <div className="journey-stats">
                      <p><strong>Total Buy-ins:</strong> ${journey.total_buy_ins.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="journey-card-footer">
                  <button className="view-journey-btn">View Details</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default JourneyList;