import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  getFriends, 
  getFriendSuggestions, 
  searchUsers,
  sendFriendRequest,
  removeFriend
} from '../services/friendService';
import FriendRequests from './FriendRequests';

function FriendsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }
      
      setUser(session.user);
      loadData();
    };
    
    checkUser();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsList, suggestionsList] = await Promise.all([
        getFriends(),
        getFriendSuggestions()
      ]);
      
      setFriends(friendsList);
      setSuggestions(suggestionsList);
    } catch (err) {
      console.error('Error loading friends data:', err);
      setError('Failed to load friends data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    setSearchTerm(e.target.value);
    
    if (e.target.value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const results = await searchUsers(e.target.value);
      setSearchResults(results);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  const handleSendRequest = async (userId) => {
    setActionInProgress(true);
    try {
      await sendFriendRequest(userId);
      // Remove this user from search results and suggestions
      setSearchResults(prev => prev.filter(user => user.id !== userId));
      setSuggestions(prev => prev.filter(user => user.id !== userId));
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError(err.message || 'Failed to send friend request');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) {
      return;
    }
    
    setActionInProgress(true);
    try {
      await removeFriend(friendId);
      // Remove from friends list
      setFriends(prev => prev.filter(friend => friend.id !== friendId));
    } catch (err) {
      console.error('Error removing friend:', err);
      setError('Failed to remove friend');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRequestUpdate = () => {
    // Refresh data when a request is handled
    loadData();
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="friends-page">
      <h2>Friends</h2>
      
      {error && <div className="error">{error}</div>}

      <FriendRequests onRequestUpdate={handleRequestUpdate} />

      <div className="friends-search">
        <input 
          type="text" 
          placeholder=" Search for players..." 
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
        
        {searchTerm.trim().length > 0 && (
          <div className="search-results">
            {searchResults.length > 0 ? (
              <div className="suggestion-items search-suggestions">
                {searchResults.map(user => (
                  <div className="suggestion-item" key={user.id}>
                    <div className="friend-avatar">
                      {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                    </div>
                    <div className="friend-info">
                      <p className="friend-name">{user.first_name} {user.last_name}</p>
                    </div>
                    <button 
                      className="add-friend-btn"
                      onClick={() => handleSendRequest(user.id)}
                      disabled={actionInProgress}
                    >
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">
                <p>No users found matching "{searchTerm}"</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="friends-container">
        <div className="friends-list">
          <h3>Your Friends ({friends.length})</h3>
          
          {friends.length > 0 ? (
            <div className="friend-items">
              {friends.map(friend => (
                <div className="friend-item" key={friend.id}>
                  <div className="friend-avatar">
                    {friend.first_name.charAt(0)}{friend.last_name.charAt(0)}
                  </div>
                  <div className="friend-info">
                    <p className="friend-name">{friend.first_name} {friend.last_name}</p>
                  </div>
                  <div className="friend-actions">
                    <button 
                      className="view-stacks-btn"
                      onClick={() => navigate(`/friend-stacks/${friend.id}`)}
                    >
                      View Stacks
                    </button>
                    <button 
                      className="remove-friend-btn"
                      onClick={() => handleRemoveFriend(friend.id)}
                      disabled={actionInProgress}
                    >
                      Remove
                    </button>
                  </div>
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
                  </div>
                  <button 
                    className="add-friend-btn"
                    onClick={() => handleSendRequest(suggestion.id)}
                    disabled={actionInProgress}
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