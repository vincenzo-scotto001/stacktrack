import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFriendActivity } from '../services/activityService';
import ActivityItem from './ActivityItem';

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
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
      
      <a href="/friends" className="view-all-activity">View All Friends</a>
    </div>
  );
}

export default FriendActivity;