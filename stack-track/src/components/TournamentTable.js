import React from 'react';

function TournamentTable({ tournaments, onSort, sortConfig }) {
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
            <th onClick={() => onSort('tournament_name')}>
              Tournament Name
              {sortConfig.field === 'tournament_name' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('date')}>
              Date
              {sortConfig.field === 'date' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('location')}>
              Location
              {sortConfig.field === 'location' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('buy_in')}>
              Buy-in
              {sortConfig.field === 'buy_in' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('action_sold')}>
              Action Sold
              {sortConfig.field === 'action_sold' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('place')}>
              Place
              {sortConfig.field === 'place' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('winnings')}>
              Winnings
              {sortConfig.field === 'winnings' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
            <th onClick={() => onSort('profit')}>
              Profit
              {sortConfig.field === 'profit' && (
                <span className="sort-icon">{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {tournaments.map((tournament) => {
            // Calculate profit for each tournament
            const profit = (tournament.winnings || 0) - tournament.buy_in;
            
            return (
              <tr key={tournament.id}>
                <td>{tournament.tournament_name}</td>
                <td>{formatDate(tournament.date)}</td>
                <td>{tournament.location}</td>
                <td>{formatMoney(tournament.buy_in)}</td>
                <td>{tournament.action_sold > 0 ? `${tournament.action_sold}%` : 'None'}</td>
                <td>{tournament.place || 'N/A'}</td>
                <td>{formatMoney(tournament.winnings || 0)}</td>
                <td className={profit >= 0 ? 'positive' : 'negative'}>
                  {formatMoney(profit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TournamentTable;