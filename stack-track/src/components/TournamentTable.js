import React, { useState } from 'react';

function TournamentTable({ tournaments }) {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field clicked
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new field
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Sort tournaments based on current sort settings
  const sortedTournaments = [...tournaments].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    // Handle date fields
    if (sortField === 'date' || sortField === 'start_time') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    // Handle numeric fields
    if (sortField === 'buy_in' || sortField === 'place' || sortField === 'winnings') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Helper function to format money
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Helper function to format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <div className="tournament-table-container">
      <table className="tournament-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('tournament_name')}>
              Tournament Name
              {sortField === 'tournament_name' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => handleSort('date')}>
              Date
              {sortField === 'date' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => handleSort('location')}>
              Location
              {sortField === 'location' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => handleSort('buy_in')}>
              Buy-in
              {sortField === 'buy_in' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => handleSort('action_sold')}>
              Action Sold
              {sortField === 'action_sold' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => handleSort('place')}>
              Place
              {sortField === 'place' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => handleSort('winnings')}>
              Winnings
              {sortField === 'winnings' && (
                <span className="sort-icon">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTournaments.map((tournament) => (
            <tr key={tournament.id}>
              <td>{tournament.tournament_name}</td>
              <td>{formatDate(tournament.date)}</td>
              <td>{tournament.location}</td>
              <td>{formatMoney(tournament.buy_in)}</td>
              <td>{tournament.action_sold > 0 ? `${tournament.action_sold}%` : 'None'}</td>
              <td>{tournament.place || 'N/A'}</td>
              <td>{formatMoney(tournament.winnings || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TournamentTable;