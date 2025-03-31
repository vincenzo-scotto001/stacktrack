import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

function JourneyDetail({ journey, onBack }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editedTournaments, setEditedTournaments] = useState(journey.tournaments);
  const [updatingTournament, setUpdatingTournament] = useState(null);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleTournamentChange = (index, field, value) => {
    const updated = [...editedTournaments];
    updated[index][field] = value;
    setEditedTournaments(updated);
  };

  const handleUpdateTournament = async (tournamentId) => {
    setUpdatingTournament(tournamentId);
    setError(null);
    
    try {
      const tournament = editedTournaments.find(t => t.id === tournamentId);
      
      if (!tournament) {
        throw new Error('Tournament not found');
      }
      
      const { error } = await supabase
        .from('journey_tournaments')
        .update({
          tournament_name: tournament.tournament_name,
          date: tournament.date,
          location: tournament.location,
          buy_in: tournament.buy_in,
          action_sold: tournament.action_sold,
          notes: tournament.notes,
          is_completed: tournament.is_completed,
          place: tournament.place,
          winnings: tournament.winnings
        })
        .eq('id', tournamentId);
        
      if (error) throw error;
      
    } catch (err) {
      console.error('Error updating tournament:', err);
      setError(`Failed to update tournament: ${err.message}`);
    } finally {
      setUpdatingTournament(null);
    }
  };

  const handleSaveAllChanges = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Update journey tournaments
      const updates = editedTournaments.map(tournament => 
        supabase
          .from('journey_tournaments')
          .update({
            tournament_name: tournament.tournament_name,
            date: tournament.date,
            location: tournament.location,
            buy_in: tournament.buy_in,
            action_sold: tournament.action_sold,
            notes: tournament.notes,
            is_completed: tournament.is_completed,
            place: tournament.is_completed ? tournament.place : null,
            winnings: tournament.is_completed ? tournament.winnings : null
          })
          .eq('id', tournament.id)
      );
      
      await Promise.all(updates);
      
      // Recalculate total buy-ins
      const totalBuyIns = editedTournaments.reduce((sum, t) => sum + (parseFloat(t.buy_in) || 0), 0);
      
      // Check if all tournaments are completed
      const allCompleted = editedTournaments.every(t => t.is_completed);
      
      // Update journey
      const { error: journeyError } = await supabase
        .from('journeys')
        .update({
          total_buy_ins: totalBuyIns,
          is_completed: allCompleted
        })
        .eq('id', journey.id);
        
      if (journeyError) throw journeyError;
      
      setIsEditing(false);
      
      // If all tournaments are completed, move them to the main tournaments table
      if (allCompleted && !journey.is_completed) {
        await moveTournamentsToMainTracker();
      }
      
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(`Failed to save changes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const moveTournamentsToMainTracker = async () => {
    try {
      // Get user ID from the API (since it's not in the journey object)
      const { data: journeyData, error: journeyError } = await supabase
        .from('journeys')
        .select('user_id')
        .eq('id', journey.id)
        .single();
        
      if (journeyError) throw journeyError;
      
      const userId = journeyData.user_id;
      
      // Format tournaments for the main tracker
      const mainTrackerTournaments = editedTournaments.map(tournament => ({
        user_id: userId,
        tournament_name: tournament.tournament_name,
        date: tournament.date,
        location: tournament.location,
        buy_in: tournament.buy_in,
        action_sold: tournament.action_sold,
        place: tournament.place, // Now we include the place from journey
        winnings: tournament.winnings, // Now we include the winnings from journey
      }));
      
      // Insert into the main tournaments table
      const { error: insertError } = await supabase
        .from('tournaments')
        .insert(mainTrackerTournaments);
        
      if (insertError) throw insertError;
      
    } catch (err) {
      console.error('Error moving tournaments to main tracker:', err);
      // Don't show this error to user, as the primary operation succeeded
    }
  };

  const handleDeleteJourney = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the journey "${journey.name}" and all its tournaments? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Delete all tournaments in this journey
      const { error: tournamentsError } = await supabase
        .from('journey_tournaments')
        .delete()
        .eq('journey_id', journey.id);
        
      if (tournamentsError) throw tournamentsError;
      
      // Delete the journey
      const { error: journeyError } = await supabase
        .from('journeys')
        .delete()
        .eq('id', journey.id);
        
      if (journeyError) throw journeyError;
      
      // Return to journey list
      onBack();
      
    } catch (err) {
      console.error('Error deleting journey:', err);
      setError(`Failed to delete journey: ${err.message}`);
      setLoading(false);
    }
  };

  // Calculate total winnings (for completed tournaments)
  const calculateTotalWinnings = () => {
    return editedTournaments
      .filter(t => t.is_completed && t.winnings)
      .reduce((sum, t) => sum + (parseFloat(t.winnings) || 0), 0);
  };

  // Calculate profit/loss
  const calculateProfitLoss = () => {
    const totalBuyIns = editedTournaments.reduce((sum, t) => sum + (parseFloat(t.buy_in) || 0), 0);
    const totalWinnings = calculateTotalWinnings();
    return totalWinnings - totalBuyIns;
  };

  return (
    <div className="journey-detail">
      <div className="journey-detail-header">
        <button onClick={onBack} className="back-btn">← Back to Journeys</button>
        
        <h3>{journey.name}</h3>
        
        <div className="journey-status-badge">
          <span className={`status-indicator ${journey.is_completed ? 'completed' : 'active'}`}></span>
          {journey.is_completed ? 'Completed' : 'Active'}
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      <div className="journey-overview">
        <div className="journey-info-box">
          <div className="journey-info-item">
            <label>Date Range:</label>
            <span>{formatDate(journey.start_date)} - {formatDate(journey.end_date)}</span>
          </div>
          <div className="journey-info-item">
            <label>Total Buy-ins:</label>
            <span>{formatMoney(journey.total_buy_ins)}</span>
          </div>
          <div className="journey-info-item">
            <label>Number of Tournaments:</label>
            <span>{journey.tournaments.length}</span>
          </div>
          
          {/* Show profit/loss for completed tournaments */}
          {editedTournaments.some(t => t.is_completed) && (
            <>
              <div className="journey-info-item">
                <label>Total Winnings:</label>
                <span>{formatMoney(calculateTotalWinnings())}</span>
              </div>
              <div className="journey-info-item">
                <label>Profit/Loss:</label>
                <span className={calculateProfitLoss() >= 0 ? 'positive' : 'negative'}>
                  {formatMoney(calculateProfitLoss())}
                </span>
              </div>
            </>
          )}
        </div>
        
        <div className="journey-actions">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="edit-btn">
                Edit Journey
              </button>
              <button onClick={handleDeleteJourney} className="delete-btn" disabled={loading}>
                Delete Journey
              </button>
            </>
          ) : (
            <button onClick={handleSaveAllChanges} className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save All Changes'}
            </button>
          )}
        </div>
      </div>
      
      <div className="journey-tournaments">
        <h4>Tournaments in this Journey</h4>
        
        <div className="tournaments-table">
          <div className="tournaments-header">
            <div className="tournament-cell">Tournament Name</div>
            <div className="tournament-cell">Date</div>
            <div className="tournament-cell">Location</div>
            <div className="tournament-cell">Buy-in</div>
            <div className="tournament-cell">Action Sold</div>
            <div className="tournament-cell">Notes</div>
            <div className="tournament-cell">Status</div>
            {/* Show Place and Winnings columns for completed tournaments */}
            {editedTournaments.some(t => t.is_completed) && (
              <>
                <div className="tournament-cell">Place</div>
                <div className="tournament-cell">Winnings</div>
              </>
            )}
            {isEditing && <div className="tournament-cell">Actions</div>}
          </div>
          
          <div className="tournaments-body">
            {(isEditing ? editedTournaments : journey.tournaments).map((tournament, index) => (
              <div className="tournament-row" key={tournament.id}>
                <div className="tournament-cell" data-label="Tournament Name">
                  {isEditing ? (
                    <input
                      type="text"
                      value={tournament.tournament_name}
                      onChange={(e) => handleTournamentChange(index, 'tournament_name', e.target.value)}
                      required
                    />
                  ) : (
                    tournament.tournament_name
                  )}
                </div>
                <div className="tournament-cell" data-label="Date">
                  {isEditing ? (
                    <input
                      type="date"
                      value={tournament.date}
                      onChange={(e) => handleTournamentChange(index, 'date', e.target.value)}
                      min={journey.start_date}
                      max={journey.end_date}
                      required
                    />
                  ) : (
                    formatDate(tournament.date)
                  )}
                </div>
                <div className="tournament-cell" data-label="Location">
                  {isEditing ? (
                    <input
                      type="text"
                      value={tournament.location}
                      onChange={(e) => handleTournamentChange(index, 'location', e.target.value)}
                      required
                    />
                  ) : (
                    tournament.location
                  )}
                </div>
                <div className="tournament-cell" data-label="Buy_in">
                  {isEditing ? (
                    <input
                      type="number"
                      value={tournament.buy_in}
                      onChange={(e) => handleTournamentChange(index, 'buy_in', e.target.value)}
                      min="0"
                      step="any"
                      required
                    />
                  ) : (
                    formatMoney(tournament.buy_in)
                  )}
                </div>
                <div className="tournament-cell" data-label="Action_sold">
                  {isEditing ? (
                    <input
                      type="number"
                      value={tournament.action_sold}
                      onChange={(e) => handleTournamentChange(index, 'action_sold', e.target.value)}
                      min="0"
                      max="100"
                      step="any"
                    />
                  ) : (
                    tournament.action_sold > 0 ? `${tournament.action_sold}%` : 'None'
                  )}
                </div>
                <div className="tournament-cell" data-label="Notes">
                  {isEditing ? (
                    <input
                      type="text"
                      value={tournament.notes || ''}
                      onChange={(e) => handleTournamentChange(index, 'notes', e.target.value)}
                    />
                  ) : (
                    tournament.notes || '-'
                  )}
                </div>
                <div className="tournament-cell" data-label="Is_completed">
                  {isEditing ? (
                    <select
                      value={tournament.is_completed ? 'true' : 'false'}
                      onChange={(e) => handleTournamentChange(index, 'is_completed', e.target.value === 'true')}
                    >
                      <option value="false">Active</option>
                      <option value="true">Completed</option>
                    </select>
                  ) : (
                    <span className={`tournament-status ${tournament.is_completed ? 'completed' : 'active'}`}>
                      {tournament.is_completed ? 'Completed' : 'Active'}
                    </span>
                  )}
                </div>
                
                {/* Place and Winnings fields appear for completed tournaments */}
                {(tournament.is_completed || editedTournaments.some(t => t.is_completed)) && (
                  <>
                    <div className="tournament-cell" data-label="Place">
                      {isEditing && tournament.is_completed ? (
                        <input
                          type="number"
                          value={tournament.place || ''}
                          onChange={(e) => handleTournamentChange(index, 'place', e.target.value)}
                          step="1"
                          placeholder="Place"
                        />
                      ) : (
                        tournament.is_completed ? (tournament.place || 'N/A') : '-'
                      )}
                    </div>
                    <div className="tournament-cell" data-label="Winnings">
                      {isEditing && tournament.is_completed ? (
                        <input
                          type="number"
                          value={tournament.winnings || ''}
                          onChange={(e) => handleTournamentChange(index, 'winnings', e.target.value)}
                          min="0"
                          step="any"
                          placeholder="$0"
                        />
                      ) : (
                        tournament.is_completed ? formatMoney(tournament.winnings || 0) : '-'
                      )}
                    </div>
                  </>
                )}
                
                {isEditing && (
                  <div className="tournament-cell" data-label="Saving">
                    <button
                      onClick={() => handleUpdateTournament(tournament.id)}
                      disabled={updatingTournament === tournament.id}
                      className="update-btn"
                    >
                      {updatingTournament === tournament.id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JourneyDetail;