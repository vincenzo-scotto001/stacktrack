import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

function CreateJourney({ user, onCancel, onSuccess }) {
  const [journeyName, setJourneyName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tournaments, setTournaments] = useState([
    { tournament_name: '', date: '', location: '', buy_in: '', action_sold: '', notes: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addTournamentRow = () => {
    setTournaments([
      ...tournaments, 
      { tournament_name: '', date: '', location: '', buy_in: '', action_sold: '', notes: '' }
    ]);
  };

  const handleTournamentChange = (index, field, value) => {
    const updatedTournaments = [...tournaments];
    updatedTournaments[index][field] = value;
    setTournaments(updatedTournaments);
  };

  const removeTournamentRow = (index) => {
    if (tournaments.length === 1) {
      return; // Keep at least one row
    }
    const updatedTournaments = [...tournaments];
    updatedTournaments.splice(index, 1);
    setTournaments(updatedTournaments);
  };

  const validateForm = () => {
    if (!journeyName.trim()) {
      setError('Please provide a name for your journey');
      return false;
    }

    if (!startDate) {
      setError('Please set a start date for your journey');
      return false;
    }

    if (!endDate) {
      setError('Please set an end date for your journey');
      return false;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date');
      return false;
    }

    // Check if any tournament is missing required fields
    const isValid = tournaments.every(tournament => 
      tournament.tournament_name.trim() && 
      tournament.date && 
      tournament.location.trim() && 
      tournament.buy_in
    );

    if (!isValid) {
      setError('All tournaments require a name, date, location, and buy-in amount');
      return false;
    }

    // Check if all tournament dates are within journey dates
    const allDatesValid = tournaments.every(tournament => {
      const tournamentDate = new Date(tournament.date);
      return tournamentDate >= new Date(startDate) && 
             tournamentDate <= new Date(endDate);
    });

    if (!allDatesValid) {
      setError('All tournament dates must be within the journey date range');
      return false;
    }

    return true;
  };

  const calculateTotalBuyIn = () => {
    return tournaments.reduce((total, tournament) => {
      const buyIn = parseFloat(tournament.buy_in) || 0;
      return total + buyIn;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Calculate total buy-in
      const totalBuyIns = calculateTotalBuyIn();
      
      // 1. Create the journey
      const { data: journeyData, error: journeyError } = await supabase
        .from('journeys')
        .insert([
          {
            user_id: user.id,
            name: journeyName,
            start_date: startDate,
            end_date: endDate,
            is_completed: false,
            total_buy_ins: totalBuyIns,
            created_at: new Date().toISOString()
          }
        ])
        .select();
        
      if (journeyError) throw journeyError;
      
      const journeyId = journeyData[0].id;
      
      // 2. Create the tournaments for this journey
      const journeyTournaments = tournaments.map(tournament => ({
        journey_id: journeyId,
        tournament_name: tournament.tournament_name,
        date: tournament.date,
        location: tournament.location,
        buy_in: parseFloat(tournament.buy_in) || 0,
        action_sold: parseFloat(tournament.action_sold) || 0,
        notes: tournament.notes || '',
        is_completed: false
      }));
      
      const { error: tournamentsError } = await supabase
        .from('journey_tournaments')
        .insert(journeyTournaments);
        
      if (tournamentsError) throw tournamentsError;
      
      // Success - notify parent component
      onSuccess();
      
    } catch (err) {
      console.error('Error creating journey:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-journey">
      <h3>Create New Tourney Journey</h3>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="journey-details">
          <div className="form-group">
            <label htmlFor="journeyName">Journey Name</label>
            <input
              type="text"
              id="journeyName"
              value={journeyName}
              onChange={(e) => setJourneyName(e.target.value)}
              placeholder="e.g., WSOP 2025, European Tour, etc."
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
        
        <div className="tournaments-section">
          <h4>Tournaments in this Journey</h4>
          <div className="tournaments-table">
            <div className="tournaments-header">
              <div className="tournament-cell">Tournament Name</div>
              <div className="tournament-cell">Date</div>
              <div className="tournament-cell">Location</div>
              <div className="tournament-cell">Buy-in ($)</div>
              <div className="tournament-cell">Action Sold (%)</div>
              <div className="tournament-cell">Notes</div>
              <div className="tournament-cell action-cell">Actions</div>
            </div>
            
            {tournaments.map((tournament, index) => (
              <div className="tournament-row" key={index}>
                <div className="tournament-cell" data-label="Tournament Name">
                  <input
                    type="text"
                    value={tournament.tournament_name}
                    onChange={(e) => handleTournamentChange(index, 'tournament_name', e.target.value)}
                    placeholder="Tournament Name"
                    required
                  />
                </div>
                <div className="tournament-cell" data-label="Date">
                  <input
                    type="date"
                    value={tournament.date}
                    onChange={(e) => handleTournamentChange(index, 'date', e.target.value)}
                    min={startDate}
                    max={endDate}
                    required
                  />
                </div>
                <div className="tournament-cell" data-label="Location">
                  <input
                    type="text"
                    value={tournament.location}
                    onChange={(e) => handleTournamentChange(index, 'location', e.target.value)}
                    placeholder="Location"
                    required
                  />
                </div>
                <div className="tournament-cell" data-label="Buy-in ($)">
                  <input
                    type="number"
                    value={tournament.buy_in}
                    onChange={(e) => handleTournamentChange(index, 'buy_in', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="any"
                    required
                  />
                </div>
                <div className="tournament-cell" data-label="Action Sold (%)">
                  <input
                    type="number"
                    value={tournament.action_sold}
                    onChange={(e) => handleTournamentChange(index, 'action_sold', e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                    step="any"
                  />
                </div>
                <div className="tournament-cell" data-label="Notes">
                  <input
                    type="text"
                    value={tournament.notes}
                    onChange={(e) => handleTournamentChange(index, 'notes', e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="tournament-cell action-cell">
                  <button 
                    type="button" 
                    onClick={() => removeTournamentRow(index)}
                    className="remove-btn"
                    title="Remove tournament"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            
            <div className="add-tournament-row">
              <button 
                type="button" 
                onClick={addTournamentRow}
                className="add-tournament-btn"
              >
                + Add Tournament
              </button>
            </div>
          </div>
        </div>
        
        <div className="journey-summary">
          <p><strong>Total Buy-ins:</strong> ${calculateTotalBuyIn().toLocaleString()}</p>
          <p><strong>Number of Tournaments:</strong> {tournaments.length}</p>
        </div>
        
        <div className="form-actions">
          <button 
            type="submit"
            className="create-btn"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Journey'}
          </button>
          <button 
            type="button" 
            onClick={onCancel}
            className="cancel-btn"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateJourney;