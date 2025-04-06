import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import TournamentTable from './TournamentTable';

function TournamentsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [filteredTournaments, setFilteredTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [locationFilter, setLocationFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: 'date', direction: 'desc' });

  const [selectedTournaments, setSelectedTournaments] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Available locations for filter dropdown
  const [availableLocations, setAvailableLocations] = useState([]);

  const handleTournamentSelect = (tournamentId) => {
    setSelectedTournaments(prev => {
      if (prev.includes(tournamentId)) {
        return prev.filter(id => id !== tournamentId);
      } else {
        return [...prev, tournamentId];
      }
    });
  };
  
  // Toggle selection mode
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    
    // Clear selections when exiting select mode
    if (isSelectMode) {
      setSelectedTournaments([]);
    }
  };
  
  // Select or deselect all tournaments
  const handleSelectAll = (selectAll) => {
    if (selectAll) {
      const allIds = filteredTournaments.map(tournament => tournament.id);
      setSelectedTournaments(allIds);
    } else {
      setSelectedTournaments([]);
    }
  };
  
  // Delete selected tournaments
  const deleteSelectedTournaments = async () => {
    if (selectedTournaments.length === 0) {
      alert('Please select tournaments to delete.');
      return;
    }
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTournaments.length} tournament${selectedTournaments.length > 1 ? 's' : ''}? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .in('id', selectedTournaments);
      
      if (error) throw error;
      
      // Refresh data after deletion
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fetchError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('user_id', session.user.id);
        
      if (fetchError) throw fetchError;
      
      setTournaments(data || []);
      setFilteredTournaments(data || []);
      setSelectedTournaments([]);
      setIsSelectMode(false);
      
      alert('Selected tournaments have been deleted successfully.');
    } catch (err) {
      console.error('Error deleting tournaments:', err);
      alert(`Error deleting tournaments: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

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
        
        const tournamentData = data || [];
        setTournaments(tournamentData);
        setFilteredTournaments(tournamentData);
        
        // Extract unique locations for the filter dropdown
        const locations = [...new Set(tournamentData.map(t => t.location))].filter(Boolean);
        setAvailableLocations(locations);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [navigate]);

  // Apply filters and search whenever relevant state changes
  useEffect(() => {
    let results = [...tournaments];
    
    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(tournament => 
        tournament.tournament_name.toLowerCase().includes(term) ||
        tournament.location.toLowerCase().includes(term)
      );
    }
    
    // Apply date range filter
    if (dateRange.from) {
      results = results.filter(tournament => new Date(tournament.date) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      results = results.filter(tournament => new Date(tournament.date) <= new Date(dateRange.to));
    }
    
    // Apply location filter
    if (locationFilter) {
      results = results.filter(tournament => tournament.location === locationFilter);
    }
    
    // Apply sorting
    results.sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];
      
      if (sortConfig.field === 'date') {
        return sortConfig.direction === 'asc' 
          ? new Date(aValue) - new Date(bValue)
          : new Date(bValue) - new Date(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // String comparison
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredTournaments(results);
  }, [tournaments, searchTerm, dateRange, locationFilter, sortConfig]);

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleReset = () => {
    setSearchTerm('');
    setDateRange({ from: '', to: '' });
    setLocationFilter('');
    setSortConfig({ field: 'date', direction: 'desc' });
  };

  const exportToCsv = () => {
    // Exit if no tournaments to export
    if (filteredTournaments.length === 0) {
      alert('No tournament data to export.');
      return;
    }
    
    // Define CSV headers
    const headers = [
      'Tournament Name',
      'Date',
      'Location',
      'Buy-in ($)',
      'Action Sold (%)',
      'Place',
      'Winnings ($)',
      'Profit ($)'
    ];
    
    // Format tournaments data for CSV
    const csvData = filteredTournaments.map(tournament => {
      // Calculate profit for tournament
      const profit = (tournament.winnings || 0) - tournament.buy_in;
      
      return [
        // Escape commas in text fields
        `"${tournament.tournament_name.replace(/"/g, '""')}"`,
        tournament.date,
        `"${tournament.location.replace(/"/g, '""')}"`,
        tournament.buy_in,
        tournament.action_sold || 0,
        tournament.place || '',
        tournament.winnings || 0,
        profit
      ].join(',');
    });
    
    // Combine headers and data rows
    const csvContent = [
      headers.join(','),
      ...csvData
    ].join('\n');
    
    // Create a Blob containing the CSV data
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a temporary URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `poker-tournaments-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    // Trigger download and clean up
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tournaments-page">
      <h2>My Tournaments</h2>
      
      {error && <div className="error">{error}</div>}
      
      {/* Search and filters panel */}
      <div className="filters-panel">
        <div className="search-container">
          <input 
            type="text" 
            placeholder="Search tournaments..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filters-container">
          <div className="filter-group">
            <label>Date Range:</label>
            <div className="date-range">
              <input 
                type="date" 
                value={dateRange.from}
                onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                className="date-input"
              />
              <span>to</span>
              <input 
                type="date" 
                value={dateRange.to}
                onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                className="date-input"
              />
            </div>
          </div>
          

          <div className="filter-group">
            <label>Location:</label>
            <select 
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="location-select"
            >
              <option value="">All Locations</option>
              {availableLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
          
          <div className="button-group">
            <button onClick={handleReset} className="reset-btn">
              Reset Filters
            </button>
            
            <button onClick={exportToCsv} className="export-btn">
              Export Results
            </button>
          </div>
        </div>
      </div>
      
      {/* Results summary */}
      <div className="results-summary">
        <p>
          Showing {filteredTournaments.length} of {tournaments.length} tournaments
          {sortConfig.field !== 'date' && ` (sorted by ${sortConfig.field}, ${sortConfig.direction === 'asc' ? 'ascending' : 'descending'})`}
        </p>
      </div>
      
      {loading ? (
        <div className="loading">Loading your tournaments...</div>
      ) : filteredTournaments.length > 0 ? (
        <TournamentTable 
          tournaments={filteredTournaments} 
          onSort={handleSort} 
          sortConfig={sortConfig}
          isSelectMode={isSelectMode}
          selectedTournaments={selectedTournaments}
          onSelectTournament={handleTournamentSelect}
        />
      ) : (
        <div className="no-tournaments">
          <p>No tournaments match your current filters.</p>
          <button onClick={handleReset} className="reset-btn">
            Reset Filters
          </button>
        </div>
      )}
      
      <div className="tournaments-actions">
        <div className='stats-action'>
          <button onClick={() => navigate('/register-tournament')} className="add-btn">
              Add New Tournament
            </button>
          </div>  

        <div className='stats-action'>
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            Back to Dashboard
          </button>
        </div>

        <div className='stats-action'>
          <button 
            onClick={toggleSelectMode} 
            className={`select-mode-btn ${isSelectMode ? 'active' : ''}`}
          >
            {isSelectMode ? 'Cancel Selection' : 'Select Tournaments'}
          </button>
        </div>
        {isSelectMode && (
          <>
            <button 
              onClick={() => handleSelectAll(selectedTournaments.length < filteredTournaments.length)} 
              className="select-all-btn"
            >
              {selectedTournaments.length < filteredTournaments.length ? 'Select All' : 'Deselect All'}
            </button>
            
            <button 
              onClick={deleteSelectedTournaments} 
              className="delete-btn"
              disabled={selectedTournaments.length === 0 || isDeleting}
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${selectedTournaments.length})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default TournamentsPage;
