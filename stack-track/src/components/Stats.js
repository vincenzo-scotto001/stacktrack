import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Stats() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Basic stats
  const [basicStats, setBasicStats] = useState({
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
  
  // Advanced stats
  const [advancedStats, setAdvancedStats] = useState({
    variance: 0,
    stdDev: 0,
    medianProfit: 0,
    profitability: 0
  });
  
  // Chart data
  const [monthlyProfitData, setMonthlyProfitData] = useState([]);
  const [runningROIData, setRunningROIData] = useState([]);
  const [varianceData, setVarianceData] = useState([]);
  
  // Active chart tab
  const [activeTab, setActiveTab] = useState('profit');

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
          .eq('user_id', session.user.id)
          .order('date', { ascending: true });
          
        if (error) throw error;
        
        const tournamentsData = data || [];
        setTournaments(tournamentsData);
        
        if (tournamentsData.length > 0) {
          // Calculate all stats
          calculateStats(tournamentsData);
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate]);

  const calculateStats = (tournamentsData) => {
    // Calculate profit for each tournament
    const tournamentsWithProfit = tournamentsData.map(tournament => {
      const adjustedBuyIn = tournament.buy_in * (1 - (tournament.action_sold || 0) / 100);
      const adjustedWinnings = (tournament.winnings || 0) * (1 - (tournament.action_sold || 0) / 100);
      const profit = adjustedWinnings - adjustedBuyIn;
      
      return {
        ...tournament,
        adjustedBuyIn,
        adjustedWinnings,
        profit
      };
    });

    // Basic Stats
    const totalBuyIns = tournamentsWithProfit.reduce((sum, t) => sum + t.adjustedBuyIn, 0);
    const totalWinnings = tournamentsWithProfit.reduce((sum, t) => sum + t.adjustedWinnings, 0);
    const profit = totalWinnings - totalBuyIns;
    const roi = totalBuyIns > 0 ? (profit / totalBuyIns) * 100 : 0;
    const inTheMoney = tournamentsWithProfit.filter(t => t.place && t.winnings > 0).length;
    const itmPercentage = (inTheMoney / tournamentsWithProfit.length) * 100;
    const biggestWin = Math.max(...tournamentsWithProfit.map(t => t.profit));
    
    const cashedTournaments = tournamentsWithProfit.filter(t => t.winnings > 0);
    const averageCash = cashedTournaments.length 
      ? cashedTournaments.reduce((sum, t) => sum + t.winnings, 0) / cashedTournaments.length 
      : 0;

    setBasicStats({
      totalTournaments: tournamentsWithProfit.length,
      totalBuyIns: parseFloat(totalBuyIns.toFixed(2)),
      totalWinnings: parseFloat(totalWinnings.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      inTheMoney,
      itmPercentage: parseFloat(itmPercentage.toFixed(2)),
      biggestWin: parseFloat(biggestWin.toFixed(2)),
      averageCash: parseFloat(averageCash.toFixed(2))
    });

    // Advanced Statistics
    const profits = tournamentsWithProfit.map(t => t.profit);
    const mean = profits.reduce((sum, p) => sum + p, 0) / profits.length;
    
    // Variance and Standard Deviation
    const variance = profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / profits.length;
    const stdDev = Math.sqrt(variance);
    
    // Median profit
    const sortedProfits = [...profits].sort((a, b) => a - b);
    const middle = Math.floor(sortedProfits.length / 2);
    const medianProfit = sortedProfits.length % 2 === 0
      ? (sortedProfits[middle - 1] + sortedProfits[middle]) / 2
      : sortedProfits[middle];
    
    // Profitability (% of tournaments with profit)
    const profitableTournaments = tournamentsWithProfit.filter(t => t.profit > 0).length;
    const profitability = (profitableTournaments / tournamentsWithProfit.length) * 100;
    
    setAdvancedStats({
      variance: parseFloat(variance.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      medianProfit: parseFloat(medianProfit.toFixed(2)),
      profitability: parseFloat(profitability.toFixed(2))
    });

    // Chart Data Preparation
    
    // 1. Monthly Profit Chart
    const tournamentsByMonth = {};
    tournamentsWithProfit.forEach(tournament => {
      const date = new Date(tournament.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!tournamentsByMonth[monthKey]) {
        tournamentsByMonth[monthKey] = {
          key: monthKey,
          month: monthName,
          profit: 0,
          tournaments: []
        };
      }
      
      tournamentsByMonth[monthKey].profit += tournament.profit;
      tournamentsByMonth[monthKey].tournaments.push(tournament);
    });
    
    const monthlyData = Object.values(tournamentsByMonth).map(month => ({
      month: month.month,
      profit: parseFloat(month.profit.toFixed(2))
    }));
    
    setMonthlyProfitData(monthlyData);
    
    // 2. Running ROI Chart
    const runningStats = tournamentsWithProfit.map((tournament, index) => {
      // Get all tournaments up to this one
      const tournamentsToDate = tournamentsWithProfit.slice(0, index + 1);
      
      // Calculate running stats
      const runningBuyIns = tournamentsToDate.reduce((sum, t) => sum + t.adjustedBuyIn, 0);
      const runningWinnings = tournamentsToDate.reduce((sum, t) => sum + t.adjustedWinnings, 0);
      const runningProfit = runningWinnings - runningBuyIns;
      const runningROI = runningBuyIns > 0 ? (runningProfit / runningBuyIns) * 100 : 0;
      
      return {
        date: new Date(tournament.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        roi: parseFloat(runningROI.toFixed(2)),
        tournaments: tournamentsToDate.length
      };
    });
    
    setRunningROIData(runningStats);
    
    // 3. Variance Chart (Standard Deviation Over Time)
    const varianceOverTime = tournamentsWithProfit.map((tournament, index) => {
      // Skip first tournament as it won't have variance
      if (index === 0) {
        return {
          date: new Date(tournament.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          stdDev: 0,
          tournaments: 1
        };
      }
      
      // Get all tournaments up to this one
      const tournamentsToDate = tournamentsWithProfit.slice(0, index + 1);
      const profits = tournamentsToDate.map(t => t.profit);
      const mean = profits.reduce((sum, p) => sum + p, 0) / profits.length;
      const variance = profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / profits.length;
      const stdDev = Math.sqrt(variance);
      
      return {
        date: new Date(tournament.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        stdDev: parseFloat(stdDev.toFixed(2)),
        tournaments: tournamentsToDate.length
      };
    });
    
    setVarianceData(varianceOverTime);
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
      <h2>Tournament Statistics</h2>
      
      {error && <div className="error">{error}</div>}
      
      {tournaments.length === 0 ? (
        <div className="no-stats">
          <p>You haven't played in any tournaments yet.</p>
          <p>Your statistics will appear here once you've added some tournaments.</p>
          <button onClick={() => navigate('/register-tournament')} className="register-btn">
            Register for a Tournament
          </button>
        </div>
      ) : (
        <>
          <div className="stats-container">
            {/* Basic Stats Cards */}
            <div className="stats-summary">
              <div className="stat-card">
                <h3>Overall Results</h3>
                <div className="stat-row">
                  <div className="stat-label">Total Tournaments</div>
                  <div className="stat-value">{basicStats.totalTournaments}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Total Buy-ins</div>
                  <div className="stat-value">{formatMoney(basicStats.totalBuyIns)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Total Winnings</div>
                  <div className="stat-value">{formatMoney(basicStats.totalWinnings)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Profit/Loss</div>
                  <div className={`stat-value ${basicStats.profit >= 0 ? 'positive' : 'negative'}`}>
                    {formatMoney(basicStats.profit)}
                  </div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">ROI</div>
                  <div className={`stat-value ${basicStats.roi >= 0 ? 'positive' : 'negative'}`}>
                    {basicStats.roi}%
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Performance Metrics</h3>
                <div className="stat-row">
                  <div className="stat-label">In The Money</div>
                  <div className="stat-value">{basicStats.inTheMoney} / {basicStats.totalTournaments}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">ITM Percentage</div>
                  <div className="stat-value">{basicStats.itmPercentage}%</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Biggest Win</div>
                  <div className="stat-value">{formatMoney(basicStats.biggestWin)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Average Cash</div>
                  <div className="stat-value">{formatMoney(basicStats.averageCash)}</div>
                </div>
              </div>
              
              {/* Advanced Stats Card */}
              <div className="stat-card">
                <h3>Advanced Analytics</h3>
                <div className="stat-row">
                  <div className="stat-label">Standard Deviation</div>
                  <div className="stat-value">{formatMoney(advancedStats.stdDev)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Median Profit</div>
                  <div className={`stat-value ${advancedStats.medianProfit >= 0 ? 'positive' : 'negative'}`}>
                    {formatMoney(advancedStats.medianProfit)}
                  </div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Profitability</div>
                  <div className="stat-value">{advancedStats.profitability}%</div>
                </div>
                <div className="info-tooltip">
                  <p className="stat-info">
                    <strong>Standard Deviation:</strong> Measures the volatility of your results. 
                    Higher numbers indicate more variance in your profits/losses.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Chart Tabs */}
            <div className="chart-section">
              <div className="chart-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'profit' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profit')}
                >
                  Monthly Profit
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'roi' ? 'active' : ''}`}
                  onClick={() => setActiveTab('roi')}
                >
                  Running ROI
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'variance' ? 'active' : ''}`}
                  onClick={() => setActiveTab('variance')}
                >
                  Variance Over Time
                </button>
              </div>
              
              <div className="chart-container">
                {activeTab === 'profit' && (
                  <>
                    <h4>Monthly Profit</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyProfitData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${formatMoney(value)}`, 'Profit/Loss']} />
                        <Legend />
                        <Bar 
                          dataKey="profit" 
                          name="Profit/Loss" 
                          fill="#3498db" 
                          stroke="#2980b9"
                          fillOpacity={0.8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
                
                {activeTab === 'roi' && (
                  <>
                    <h4>Running ROI Over Time</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={runningROIData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis unit="%" />
                        <Tooltip formatter={(value) => [`${value}%`, 'ROI']} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="roi" 
                          name="Running ROI" 
                          stroke="#27ae60" 
                          activeDot={{ r: 8 }}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="chart-info">
                      This chart shows how your Return on Investment (ROI) has evolved over time.
                    </p>
                  </>
                )}
                
                {activeTab === 'variance' && (
                  <>
                    <h4>Variance (Standard Deviation) Over Time</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={varianceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => [formatMoney(value), 'Std Dev']} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="stdDev" 
                          name="Standard Deviation" 
                          stroke="#e74c3c" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="chart-info">
                      Standard deviation measures the volatility in your results. 
                      A decreasing trend may indicate more consistent play.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="interpretation">
            <h3>What Do These Stats Mean?</h3>
            <p>
              <strong>Standard Deviation:</strong> {formatMoney(advancedStats.stdDev)} represents the typical amount your individual tournament results 
              vary from your average result. Higher standard deviation means more volatile results, which is normal in poker.
            </p>
            <p>
              <strong>ROI (Return on Investment):</strong> {basicStats.roi}% means that for every $100 you invest in tournaments, 
              you're making ${basicStats.roi.toFixed(2)} in profit on average.
            </p>
            {varianceData.length > 5 && (
              <p>
                <strong>Trend Analysis:</strong> Your variance {
                  varianceData[varianceData.length - 1].stdDev > varianceData[Math.floor(varianceData.length / 2)].stdDev 
                  ? 'has increased over time, which could indicate taking more risks or playing in higher volatility tournaments.' 
                  : 'has decreased over time, which could indicate more consistent play or better bankroll management.'
                }
              </p>
            )}
          </div>
        </>
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