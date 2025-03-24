import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Stats() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalTournaments: 0,
    totalBuyIns: 0,
    totalWinnings: 0,
    profit: 0,
    roi: 0,
    inTheMoney: 0,
    itmPercentage: 0,
    biggestWin: 0,
    averageCash: 0
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
      
      // Fetch user's tournaments
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('user_id', session.user.id);
          
        if (error) throw error;
        
        setTournaments(data || []);
        calculateStats(data || []);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate]);

  const calculateStats = (tournaments) => {
    if (!tournaments.length) {
      return;
    }

    // Calculate total buy-ins (adjusted for action sold)
    const totalBuyIns = tournaments.reduce((sum, tournament) => {
      const effectiveBuyIn = tournament.buy_in * (1 - (tournament.action_sold || 0) / 100);
      return sum + effectiveBuyIn;
    }, 0);

    // Calculate total winnings (adjusted for action sold)
    const totalWinnings = tournaments.reduce((sum, tournament) => {
      const effectiveWinnings = (tournament.winnings || 0) * (1 - (tournament.action_sold || 0) / 100);
      return sum + effectiveWinnings;
    }, 0);

    // Count tournaments that placed in the money (e.g., place is recorded and winnings > 0)
    const inTheMoney = tournaments.filter(t => t.place && t.winnings > 0).length;

    // Find biggest win
    const biggestWin = Math.max(0, ...tournaments.map(t => (t.winnings || 0) - t.buy_in));

    // Calculate average cash for tournaments that cashed
    const cashedTournaments = tournaments.filter(t => (t.winnings || 0) > 0);
    const averageCash = cashedTournaments.length 
      ? cashedTournaments.reduce((sum, t) => sum + (t.winnings || 0), 0) / cashedTournaments.length 
      : 0;

    setStats({
      totalTournaments: tournaments.length,
      totalBuyIns: parseFloat(totalBuyIns.toFixed(2)),
      totalWinnings: parseFloat(totalWinnings.toFixed(2)),
      profit: parseFloat((totalWinnings - totalBuyIns).toFixed(2)),
      roi: totalBuyIns > 0 ? parseFloat((((totalWinnings - totalBuyIns) / totalBuyIns) * 100).toFixed(2)) : 0,
      inTheMoney,
      itmPercentage: parseFloat(((inTheMoney / tournaments.length) * 100).toFixed(2)),
      biggestWin: parseFloat(biggestWin.toFixed(2)),
      averageCash: parseFloat(averageCash.toFixed(2))
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

  if (loading) {
    return <div className="loading">Loading your stats...</div>;
  }

  return (
    <div className="stats-page">
      <h2>My Tournament Statistics</h2>
      
      {error && <div className="error">{error}</div>}
      
      {tournaments.length === 0 ? (
        <div className="no-stats">
          <p>You haven't played in any tournaments yet.</p>
          <p>Your statistics will appear here once you've added some tournaments.</p>
          <button onClick={() => navigate('/register-tournament')} className="register-btn">
            Add a Tournament
          </button>
        </div>
      ) : (
        <div className="stats-container">
          <div className="stats-summary">
            <div className="stat-card">
              <h3>Overall Results</h3>
              <div className="stat-row">
                <div className="stat-label">Total Tournaments</div>
                <div className="stat-value">{stats.totalTournaments}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Total Buy-ins</div>
                <div className="stat-value">{formatMoney(stats.totalBuyIns)}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Total Winnings</div>
                <div className="stat-value">{formatMoney(stats.totalWinnings)}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Profit/Loss</div>
                <div className={`stat-value ${stats.profit >= 0 ? 'positive' : 'negative'}`}>
                  {formatMoney(stats.profit)}
                </div>
              </div>
              <div className="stat-row">
                <div className="stat-label">ROI</div>
                <div className={`stat-value ${stats.roi >= 0 ? 'positive' : 'negative'}`}>
                  {stats.roi}%
                </div>
              </div>
            </div>

            <div className="stat-card">
              <h3>Performance Metrics</h3>
              <div className="stat-row">
                <div className="stat-label">In The Money</div>
                <div className="stat-value">{stats.inTheMoney} / {stats.totalTournaments}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">ITM Percentage</div>
                <div className="stat-value">{stats.itmPercentage}%</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Biggest Win</div>
                <div className="stat-value">{formatMoney(stats.biggestWin)}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Average Cash</div>
                <div className="stat-value">{formatMoney(stats.averageCash)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="stats-actions">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default Stats;