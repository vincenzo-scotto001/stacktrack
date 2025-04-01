import { supabase } from '../supabaseClient';

/**
 * Create an activity record
 * @param {string} activityType Type of activity ('tournament_added', 'tournament_finished', etc.)
 * @param {string|null} tournamentId Optional tournament ID
 * @param {Object} metadata Additional data for the activity
 * @returns {Promise<Object>} The created activity record
 */
export const createActivity = async (activityType, tournamentId = null, metadata = {}) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('activity_feed')
      .insert({
        user_id: userId,
        activity_type: activityType,
        tournament_id: tournamentId,
        metadata
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
};

/**
 * Get friend activity for the current user
 * @param {number} limit Number of activities to return
 * @param {number} offset Offset for pagination
 * @returns {Promise<Array>} List of friend activities
 */
export const getFriendActivity = async (limit = 10, offset = 0) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Get IDs of all friends
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`and(user_id.eq.${userId},status.eq.accepted),and(friend_id.eq.${userId},status.eq.accepted)`);

    if (friendshipsError) throw friendshipsError;

    if (!friendships || friendships.length === 0) {
      return []; // No friends, no activity
    }

    // Extract friend IDs
    const friendIds = friendships.map(f => 
      f.user_id === userId ? f.friend_id : f.user_id
    );

    // Get activities from friends
    const { data, error } = await supabase
      .from('activity_feed')
      .select(`
        id,
        user_id,
        activity_type,
        tournament_id,
        metadata,
        created_at,
        stacktrackmaster:user_id (
          first_name,
          last_name
        ),
        tournaments:tournament_id (
          tournament_name,
          buy_in,
          place,
          winnings
        )
      `)
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Format the activities for display
    return data.map(activity => {
      const userName = `${activity.stacktrackmaster.first_name} ${activity.stacktrackmaster.last_name}`;
      let description = '';
      let result = null;

      switch (activity.activity_type) {
        case 'tournament_added':
          description = `registered for ${activity.tournaments?.tournament_name || 'a tournament'}`;
          break;
        case 'tournament_finished':
          description = `finished ${activity.tournaments?.tournament_name || 'a tournament'}`;
          if (activity.tournaments) {
            const profit = (activity.tournaments.winnings || 0) - activity.tournaments.buy_in;
            result = {
              value: profit,
              place: activity.tournaments.place,
              isPositive: profit >= 0
            };
          }
          break;
        case 'level_up':
          description = `reached ${activity.metadata?.level || 'a new'} level`;
          break;
        case 'friend_joined':
          description = `became friends with ${activity.metadata?.friend_name || 'someone'}`;
          break;
        default:
          description = 'did something';
      }

      return {
        id: activity.id,
        userId: activity.user_id,
        userName,
        description,
        result,
        timestamp: new Date(activity.created_at),
        metadata: activity.metadata
      };
    });
  } catch (error) {
    console.error('Error getting friend activity:', error);
    throw error;
  }
};

/**
 * Create a tournament activity automatically
 * This can be called when a user adds or completes a tournament
 * @param {string} tournamentId The tournament ID
 * @param {boolean} isCompleted Whether the tournament is completed
 * @returns {Promise<Object>} The created activity record
 */
export const createTournamentActivity = async (tournamentId, isCompleted = false) => {
  try {
    const activityType = isCompleted ? 'tournament_finished' : 'tournament_added';
    return await createActivity(activityType, tournamentId);
  } catch (error) {
    console.error('Error creating tournament activity:', error);
    throw error;
  }
};