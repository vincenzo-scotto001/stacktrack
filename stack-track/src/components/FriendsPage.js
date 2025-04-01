import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function FriendsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }
      
      setUser(session.user);
      
      // Fetch user's friends (to be implemented)
      setLoading(false);
    };
    
    checkUser();
  }, [navigate]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleAddFriend = (userId) => {
    // To be implemented
    console.log("Add friend", userId);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="friends-page">
      <h2>Friends</h2>
      
      {error && <div className="error">{error}</div>}

      <div className="friends-search">
        <input 
          type="text" 
          placeholder="Search for players..." 
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
      </div>
      
      <div className="friends-container">
        <div className="friends-list">
          <h3>Your Friends</h3>
          
          {friends.length > 0 ? (
            <div className="friend-items">
              {friends.map(friend => (
                <div className="friend-item" key={friend.id}>
                  <div className="friend-avatar">
                    {friend.first_name.charAt(0)}{friend.last_name.charAt(0)}
                  </div>
                  <div className="friend-info">
                    <p className="friend-name">{friend.first_name} {friend.last_name}</p>
                    <p className="friend-stats">
                      <span>{friend.tournament_count || 0} tournaments</span>
                      <span>{friend.roi || 0}% ROI</span>
                    </p>
                  </div>
                  <button className="view-profile-btn">View Profile</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-friends">
              <p>You haven't added any friends yet.</p>
              <p>Search for players or check the suggestions below.</p>
            </div>
          )}
        </div>
        
        <div className="friend-suggestions">
          <h3>Suggested Players</h3>
          
          {suggestions.length > 0 ? (
            <div className="suggestion-items">
              {suggestions.map(suggestion => (
                <div className="suggestion-item" key={suggestion.id}>
                  <div className="friend-avatar">
                    {suggestion.first_name.charAt(0)}{suggestion.last_name.charAt(0)}
                  </div>
                  <div className="friend-info">
                    <p className="friend-name">{suggestion.first_name} {suggestion.last_name}</p>
                    <p className="friend-stats">
                      <span>{suggestion.tournament_count || 0} tournaments</span>
                    </p>
                  </div>
                  <button 
                    className="add-friend-btn"
                    onClick={() => handleAddFriend(suggestion.id)}
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-suggestions">
              <p>No suggestions available at the moment.</p>
              <p>Check back later for recommendations.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="friends-actions">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default FriendsPage;