import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

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
const [timeSeriesData, setTimeSeriesData] = useState({
  weekly: [],
  monthly: [],
  yearly: [],
  custom: []
});

// Active chart tab and time period
const [activeTab, setActiveTab] = useState('profit');
const [selectedTimePeriod, setSelectedTimePeriod] = useState('monthly');

// Custom date range states
const [showDatePopup, setShowDatePopup] = useState(false);
const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
const [isCustomPeriod, setIsCustomPeriod] = useState(false);
const [dateFilterSummary, setDateFilterSummary] = useState('');

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
          
          // Initialize custom date range with earliest and latest dates
          if (tournamentsData.length > 0) {
            const dates = tournamentsData.map(t => new Date(t.date));
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            
            setCustomDateRange({
              from: minDate.toISOString().split('T')[0],
              to: maxDate.toISOString().split('T')[0]
            });
          }
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

  // Functions for custom date range
  const handleCustomDateClick = () => {
    // Initialize date range if empty
    if (!customDateRange.from || !customDateRange.to) {
      // Set default to last 3 months if we have tournaments
      if (tournaments.length > 0) {
        const dates = tournaments.map(t => new Date(t.date));
        const maxDate = new Date(Math.max(...dates));
        
        const minDate = new Date(maxDate);
        minDate.setMonth(minDate.getMonth() - 3); // Default to 3 months back
        
        setCustomDateRange({
          from: minDate.toISOString().split('T')[0],
          to: maxDate.toISOString().split('T')[0]
        });
      }
    }
    
    setShowDatePopup(true);
  };

  // Handle date range changes
  const handleDateChange = (field, value) => {
    setCustomDateRange({
      ...customDateRange,
      [field]: value
    });
  };
  // Apply the custom date filter
  const applyCustomDateFilter = () => {
    if (!customDateRange.from || !customDateRange.to) {
      alert('Please select both start and end dates');
      return;
    }
    
    const startDate = new Date(customDateRange.from);
    const endDate = new Date(customDateRange.to);
    
    if (startDate > endDate) {
      alert('Start date cannot be after end date');
      return;
    }
    
    // Filter tournaments based on date range
    const filteredTournaments = tournaments.filter(tournament => {
      const tournamentDate = new Date(tournament.date);
      return tournamentDate >= startDate && tournamentDate <= endDate;
    });
    
    if (filteredTournaments.length === 0) {
      alert('No tournaments found in the selected date range');
      return;
    }
    
    // Format dates for display
    const startFormatted = startDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    
    const endFormatted = endDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    
    // Create summary text
    const summaryText = `Showing ${filteredTournaments.length} tournaments between ${startFormatted} and ${endFormatted}`;
    
    // Close popup first
    setShowDatePopup(false);
    
    // Use a single batched state update with callback to ensure things happen in sequence
    setIsCustomPeriod(true);
    setDateFilterSummary(summaryText);
    setSelectedTimePeriod('monthly');
    
    // Important: Use setTimeout to ensure all state updates have been processed
    // before calculating stats and updating the chart data
    setTimeout(() => {
      calculateStats(filteredTournaments);
    }, 0);
  };

  // Cancel the date popup
  const cancelDatePopup = () => {
    setShowDatePopup(false);
  };

  // Reset the date filter
  const resetDateFilter = () => {
    setIsCustomPeriod(false);
    setDateFilterSummary('');
    calculateStats(tournaments);
    setSelectedTimePeriod('monthly');
  };

  // Handle time period selection
  const handleTimePeriodChange = (period) => {
    if (period === 'custom') {
      handleCustomDateClick();
      return;
    }
    
    // Reset custom period flag if selecting a standard period
    if (isCustomPeriod) {
      resetDateFilter();
    }
    
    setSelectedTimePeriod(period);
  };

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
    const biggestLoss = Math.min(...tournamentsWithProfit.map(t => t.profit));
    
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
      biggestLoss: parseFloat(biggestLoss.toFixed(2)),
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
    
    // 1. Weekly Profit Chart
    const tournamentsByWeek = {};
    tournamentsWithProfit.forEach(tournament => {
      const date = new Date(tournament.date);
      
      // Get the week number and year
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil(days / 7);
      
      const weekKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      const weekStartDate = new Date(date);
      weekStartDate.setDate(date.getDate() - date.getDay());
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      
      const weekName = `Week ${weekNumber}, ${date.getFullYear()}`;
      
      if (!tournamentsByWeek[weekKey]) {
        tournamentsByWeek[weekKey] = {
          key: weekKey,
          period: weekName,
          profit: 0,
          tournaments: [],
          date: new Date(weekStartDate) // Store the date for sorting
        };
      }
      
      tournamentsByWeek[weekKey].profit += tournament.profit;
      tournamentsByWeek[weekKey].tournaments.push(tournament);
    });
    
    // 2. Monthly Profit Chart
    const tournamentsByMonth = {};
    tournamentsWithProfit.forEach(tournament => {
      const date = new Date(tournament.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!tournamentsByMonth[monthKey]) {
        tournamentsByMonth[monthKey] = {
          key: monthKey,
          period: monthName,
          profit: 0,
          tournaments: [],
          date: new Date(date.getFullYear(), date.getMonth(), 1) // Store the date for sorting
        };
      }
      
      tournamentsByMonth[monthKey].profit += tournament.profit;
      tournamentsByMonth[monthKey].tournaments.push(tournament);
    });
    
    // 3. Yearly Profit Chart
    const tournamentsByYear = {};
    tournamentsWithProfit.forEach(tournament => {
      const date = new Date(tournament.date);
      const yearKey = `${date.getFullYear()}`;
      const yearName = `${date.getFullYear()}`;
      
      if (!tournamentsByYear[yearKey]) {
        tournamentsByYear[yearKey] = {
          key: yearKey,
          period: yearName,
          profit: 0,
          tournaments: [],
          date: new Date(date.getFullYear(), 0, 1) // Store the date for sorting
        };
      }
      
      tournamentsByYear[yearKey].profit += tournament.profit;
      tournamentsByYear[yearKey].tournaments.push(tournament);
    });
    
    // Format and sort the data for each time period
    const formatTimeSeriesData = (data) => {
      return Object.values(data)
        .map(item => ({
          period: item.period,
          profit: parseFloat(item.profit.toFixed(2)),
          tournamentCount: item.tournaments.length,
          isFiltered: isCustomPeriod
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    };
    
    const weeklyData = formatTimeSeriesData(tournamentsByWeek);
    const monthlyData = formatTimeSeriesData(tournamentsByMonth);
    const yearlyData = formatTimeSeriesData(tournamentsByYear);
    
    setMonthlyProfitData(monthlyData);
    
    // Store all time period data
    setTimeSeriesData({
      weekly: weeklyData,
      monthly: monthlyData, 
      yearly: yearlyData,
      custom: isCustomPeriod ? monthlyData : [] // Use monthly format for custom view
    });
    
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
        tournaments: tournamentsToDate.length,
        isFiltered: isCustomPeriod
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
          tournaments: 1,
          isFiltered: isCustomPeriod
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
        tournaments: tournamentsToDate.length,
        isFiltered: isCustomPeriod
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
              <div className={`stat-card ${isCustomPeriod ? 'filtered' : ''}`}>
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

              <div className={`stat-card ${isCustomPeriod ? 'filtered' : ''}`}>
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
                  <div className="stat-label">Biggest Loss</div>
                  <div className="stat-value">{formatMoney(basicStats.biggestLoss)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-label">Average Cash</div>
                  <div className="stat-value">{formatMoney(basicStats.averageCash)}</div>
                </div>
              </div>
              
              {/* Advanced Stats Card */}
              <div className={`stat-card ${isCustomPeriod ? 'filtered' : ''}`}>
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
                  Profit/Loss Graph
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
                    <div className={`chart-time-period-selector ${isCustomPeriod ? 'filtered' : ''}`}>
                      <h4>
                        Profit Over Time
                      </h4>
                      <div className="time-period-tabs">
                        <button 
                          className={`time-period-btn ${isCustomPeriod || selectedTimePeriod === 'custom' ? 'active' : ''}`}
                          onClick={() => handleTimePeriodChange('custom')}
                        >
                          Custom
                        </button>
                        <button 
                          className={`time-period-btn ${selectedTimePeriod === 'weekly' && !isCustomPeriod ? 'active' : ''}`}
                          onClick={() => handleTimePeriodChange('weekly')}
                        >
                          Weekly
                        </button>
                        <button 
                          className={`time-period-btn ${selectedTimePeriod === 'monthly' && !isCustomPeriod ? 'active' : ''}`}
                          onClick={() => handleTimePeriodChange('monthly')}
                        >
                          Monthly
                        </button>
                        <button 
                          className={`time-period-btn ${selectedTimePeriod === 'yearly' && !isCustomPeriod ? 'active' : ''}`}
                          onClick={() => handleTimePeriodChange('yearly')}
                        >
                          Yearly
                        </button>
                      </div>
                    </div>
                    
                    {isCustomPeriod && (
                      <div className="filtered-data-banner">
                        <div className="filter-badge">Filtered Data</div>
                        <p>{dateFilterSummary}</p>
                        <button 
                          onClick={resetDateFilter}
                          className="small-btn reset-btn"
                        >
                          Clear Filter
                        </button>
                      </div>
                    )}
                    
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={timeSeriesData[selectedTimePeriod]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name === 'profit') {
                              return [formatMoney(value), 'Profit/Loss'];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              let labelText = `${label} (${payload[0]?.payload.tournamentCount || 0} tournaments)`;
                              if (payload[0]?.payload.isFiltered) {
                                labelText += ' [Filtered]';
                              }
                              return labelText;
                            }
                            return label;
                          }}
                        />
                        <Legend />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        <Line 
                          type="monotone"
                          dataKey="profit" 
                          name="Profit/Loss" 
                          stroke={basicStats.profit >= 0 ? "#27ae60" : "#e74c3c"}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    
                    <p className="chart-info">
                      {selectedTimePeriod === 'weekly' && 'Weekly profit/loss over time.'}
                      {selectedTimePeriod === 'monthly' && 'Monthly profit/loss over time.'}
                      {selectedTimePeriod === 'yearly' && 'Yearly profit/loss over time.'}
                      {selectedTimePeriod === 'custom' && 'Filtered profit/loss over selected date range.'}
                      {' '}{basicStats.profit >= 0 ? 
                        "You're currently showing an overall profit." : 
                        "You're currently showing an overall loss."}
                    </p>
                  </>
                )}                
                {activeTab === 'roi' && (
                  <>
                    <h4>
                      Running ROI Over Time
                      {isCustomPeriod && (
                        <span className="custom-range-indicator">
                          {dateFilterSummary}
                        </span>
                      )}
                    </h4>
                    
                    {isCustomPeriod && (
                      <div className="filtered-data-banner">
                        <div className="filter-badge">Filtered Data</div>
                        <p>{dateFilterSummary}</p>
                        <button 
                          onClick={resetDateFilter}
                          className="small-btn reset-btn"
                        >
                          Clear Filter
                        </button>
                      </div>
                    )}
                    
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
                          stroke={basicStats.roi >= 0 ? "#27ae60" : "#e74c3c"}
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
                    <h4>
                      Variance (Standard Deviation) Over Time
                      {isCustomPeriod && (
                        <span className="custom-range-indicator">
                          {dateFilterSummary}
                        </span>
                      )}
                    </h4>
                    
                    {isCustomPeriod && (
                      <div className="filtered-data-banner">
                        <div className="filter-badge">Filtered Data</div>
                        <p>{dateFilterSummary}</p>
                        <button 
                          onClick={resetDateFilter}
                          className="small-btn reset-btn"
                        >
                          Clear Filter
                        </button>
                      </div>
                    )}
                    
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
                          stroke="#3498db" 
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
      
      {/* Date Range Popup */}
      {showDatePopup && (
        <div className="date-popup-overlay">
          <div className="date-popup">
            <div className="date-popup-header">
              <h3>Select Custom Date Range</h3>
              <button className="close-btn" onClick={cancelDatePopup}>×</button>
            </div>
            <div className="date-popup-content">
              <div className="date-field">
                <label htmlFor="date-from">From:</label>
                <input 
                  type="date" 
                  id="date-from"
                  value={customDateRange.from}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                />
              </div>
              <div className="date-field">
                <label htmlFor="date-to">To:</label>
                <input 
                  type="date" 
                  id="date-to"
                  value={customDateRange.to}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                />
              </div>
            </div>
            <div className="date-popup-actions">
              <button className="cancel-btn" onClick={cancelDatePopup}>Cancel</button>
              <button className="apply-btn" onClick={applyCustomDateFilter}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stats;