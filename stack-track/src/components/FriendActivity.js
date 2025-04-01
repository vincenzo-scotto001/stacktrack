import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFriendActivity } from '../services/activityService';
import { formatDistanceToNow } from 'date-fns';

function FriendActivity() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const activityData = await getFriendActivity(5); // Get 5 most recent activities
      setActivities(activityData);
    } catch (err) {
      console.error('Error loading friend activity:', err);
      setError('Failed to load friend activity');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      signDisplay: 'always'
    }).format(amount);
  };

  // Empty state when user has no friends
  if (activities.length === 0 && !loading && !error) {
    return (
      <div className="friend-activity">
        <h3>Friend Activity</h3>
        <div className="activity-placeholder">
          <div className="activity-empty-state">
            <p><strong>No recent activity</strong></p>
            <p>When your friends play tournaments, their activity will appear here.</p>
            <button className="primary-btn" onClick={() => navigate('/friends')}>Find Friends</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="friend-activity">
        <h3>Friend Activity</h3>
        <div className="activity-loading">Loading friend activity...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friend-activity">
        <h3>Friend Activity</h3>
        <div className="activity-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="friend-activity">
      <h3>Friend Activity</h3>
      
      <div className="activity-list">
        {activities.map(activity => (
          <div className="activity-item" key={activity.id}>
            <div className="activity-avatar">
              {activity.userName.split(' ').map(name => name.charAt(0)).join('')}
            </div>
            <div className="activity-content">
              <p>
                <span className="activity-name">{activity.userName}</span> {activity.description}
              </p>
              <p className="activity-time">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </p>
            </div>
            {activity.result && (
              <div className={`activity-result ${activity.result.isPositive ? 'positive' : 'negative'}`}>
                {formatMoney(activity.result.value)}
                {activity.result.place && <span className="place">{activity.result.place}{getOrdinalSuffix(activity.result.place)}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <a href="/friends" className="view-all-activity">View All Friends</a>
    </div>
  );
}

// Helper function to get ordinal suffix for numbers
function getOrdinalSuffix(i) {
  const j = i % 10;
  const k = i % 100;
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
}

export default FriendActivity;