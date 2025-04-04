import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { format } from 'date-fns';

function FriendStacks() {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const [friendInfo, setFriendInfo] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (friendId) {
      loadFriendData();
      loadFriendTournaments();
    }
  }, [friendId]);

  const loadFriendData = async () => {
    try {
      // First verify this is actually a friend
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data: friendship, error: friendshipError } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .eq('status', 'accepted')
        .maybeSingle();
        
      if (friendshipError) throw friendshipError;
      
      // If not a friend, don't allow access
      if (!friendship) {
        setError('You can only view tournament data of your friends');
        setLoading(false);
        return;
      }
      
      // Only proceed to load data if friendship is verified
      const { data, error } = await supabase
        .from('stacktrackmaster')
        .select('id, first_name, last_name, email')
        .eq('id', friendId)
        .single();
  
      if (error) throw error;
      setFriendInfo(data);
    } catch (err) {
      console.error('Error loading friend data:', err);
      setError('Could not load friend information');
      setLoading(false);
    }
  };

  const loadFriendTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('user_id', friendId)
        .order('date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error loading friend tournaments:', err);
      setError('Could not load tournament data');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  if (loading) {
    return <div className="loading">Loading friend's tournament data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="friend-stacks">
      <div className="friend-stacks-header">
        <button className="back-btn" onClick={() => navigate('/friends')}>
          ← Back to Friends
        </button>
        
        {friendInfo && (
          <h2>{friendInfo.first_name}'s Tournaments</h2>
        )}
      </div>

      {tournaments.length > 0 ? (
        <div className="friend-tournaments">
          {tournaments.map(tournament => {
            return (
              <div className="friend-tournament-card" key={tournament.id}>
                <div className="tournament-card-header">
                  <h3>{tournament.tournament_name}</h3>
                  <span className="tournament-date">{formatDate(tournament.date)}</span>
                </div>
                <div className="tournament-card-body">
                  <div className="tournament-info">
                    <p>
                      <span className="info-label">Location: </span> 
                      <span className="info-value">{tournament.location}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-tournaments">
          <p>No tournaments found for this friend.</p>
          <p>They haven't registered any tournaments yet or haven't shared their data.</p>
        </div>
      )}
    </div>
  );
}
export default FriendStacks;