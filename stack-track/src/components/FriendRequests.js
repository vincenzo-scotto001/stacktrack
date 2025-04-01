import React, { useState, useEffect } from 'react';
import { getPendingRequests, acceptFriendRequest, rejectFriendRequest } from '../services/friendService';

function FriendRequests({ onRequestUpdate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const pendingRequests = await getPendingRequests();
      setRequests(pendingRequests);
    } catch (err) {
      console.error('Error loading friend requests:', err);
      setError('Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      await loadRequests();
      if (onRequestUpdate) onRequestUpdate();
    } catch (err) {
      console.error('Error accepting friend request:', err);
      setError('Failed to accept friend request');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectFriendRequest(requestId);
      await loadRequests();
      if (onRequestUpdate) onRequestUpdate();
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      setError('Failed to reject friend request');
    }
  };

  if (loading) {
    return <div className="friend-requests-loading">Loading requests...</div>;
  }

  if (error) {
    return <div className="friend-requests-error">{error}</div>;
  }

  if (requests.length === 0) {
    return null; // Don't show anything if there are no requests
  }

  return (
    <div className="friend-requests">
      <h4>Friend Requests</h4>
      <div className="requests-list">
        {requests.map(request => (
          <div key={request.requestId} className="request-item">
            <div className="request-avatar">
              {request.first_name.charAt(0)}{request.last_name.charAt(0)}
            </div>
            <div className="request-info">
              <p className="request-name">{request.first_name} {request.last_name}</p>
              <p className="request-time">
                {new Date(request.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="request-actions">
              <button 
                className="accept-btn"
                onClick={() => handleAccept(request.requestId)}
              >
                Accept
              </button>
              <button 
                className="reject-btn"
                onClick={() => handleReject(request.requestId)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FriendRequests;