import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AddTournament() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    tournament_name: '',
    date: '',
    location: '',
    buy_in: '',
    action_sold: '',
    place: '',
    winnings: ''
  });

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }
      
      setUser(session.user);
    };
    
    checkUser();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Format data for insertion
      const tournamentData = {
        tournament_name: formData.tournament_name,
        date: formData.date,
        location: formData.location,
        buy_in: parseFloat(formData.buy_in) || 0,
        action_sold: parseFloat(formData.action_sold) || 0,
        place: formData.place ? parseInt(formData.place) : null,
        winnings: parseFloat(formData.winnings) || 0
      };
      
      // Insert tournament data
      const { error: insertError } = await supabase
        .from('tournaments')
        .insert([tournamentData]);
        
      if (insertError) throw insertError;
      
      // Show success message
      setSuccess(true);
      setFormData({
        tournament_name: '',
        date: '',
        location: '',
        buy_in: '',
        action_sold: '',
        place: '',
        winnings: ''
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setFormData({
      tournament_name: '',
      date: '',
      location: '',
      buy_in: '',
      action_sold: '',
      place: '',
      winnings: ''
    });
  };

  if (success) {
    return (
      <div className="add-tournament-success">
        <div className="success-content">
          <h2>Tournament Added Successfully!</h2>
          <p>Your tournament has been added to your records.</p>
          
          <div className="success-buttons">
            <button onClick={resetForm} className="add-another-btn">
              Add Another Tournament
            </button>
            <button onClick={() => navigate('/dashboard')} className="return-dashboard-btn">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-tournament">
      <h2>Register a Tournament</h2>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="tournament_name">Tournament Name</label>
          <input
            type="text"
            id="tournament_name"
            name="tournament_name"
            value={formData.tournament_name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="buy_in">Buy-in Amount ($)</label>
          <input
            type="number"
            id="buy_in"
            name="buy_in"
            value={formData.buy_in}
            onChange={handleChange}
            min="0"
            step="any"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="action_sold">Action Sold (%)</label>
          <input
            type="number"
            id="action_sold"
            name="action_sold"
            value={formData.action_sold}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.1"
            placeholder="0"
          />
          <small className="input-help">Percentage of your action sold to other players</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="place">Place (leave blank if tournament not completed)</label>
          <input
            type="number"
            id="place"
            name="place"
            value={formData.place}
            onChange={handleChange}
            min="1"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="winnings">Winnings ($)</label>
          <input
            type="number"
            id="winnings"
            name="winnings"
            value={formData.winnings}
            onChange={handleChange}
            min="0"
            step="any"
          />
        </div>
        
        <div className="form-buttons">
          <button type="submit" disabled={loading}>
            {loading ? 'Adding Tournament...' : 'Add Tournament'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} className="cancel-btn">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddTournament;