import { supabase } from '../supabaseClient';

/**
 * Get all friends for the current user
 * @returns {Promise<Array>} List of friends
 */
export const getFriends = async () => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Get friends where the current user is the requester
    const { data: sentFriends, error: sentError } = await supabase
      .from('friendships')
      .select(`
        friend_id,
        status,
        stacktrackmaster:friend_id (
          id, 
          first_name, 
          last_name, 
          email
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (sentError) throw sentError;

    // Get friends where the current user is the recipient
    const { data: receivedFriends, error: receivedError } = await supabase
      .from('friendships')
      .select(`
        user_id,
        status,
        stacktrackmaster:user_id (
          id, 
          first_name, 
          last_name, 
          email
        )
      `)
      .eq('friend_id', userId)
      .eq('status', 'accepted');

    if (receivedError) throw receivedError;

    // Combine and format the results
    const sentFormatted = sentFriends.map(item => ({
      id: item.stacktrackmaster.id,
      first_name: item.stacktrackmaster.first_name,
      last_name: item.stacktrackmaster.last_name,
      email: item.stacktrackmaster.email
    }));

    const receivedFormatted = receivedFriends.map(item => ({
      id: item.stacktrackmaster.id,
      first_name: item.stacktrackmaster.first_name,
      last_name: item.stacktrackmaster.last_name,
      email: item.stacktrackmaster.email
    }));

    return [...sentFormatted, ...receivedFormatted];
  } catch (error) {
    console.error('Error getting friends:', error);
    throw error;
  }
};

/**
 * Get pending friend requests for the current user
 * @returns {Promise<Array>} List of pending friend requests
 */
export const getPendingRequests = async () => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Get friend requests sent to the current user
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        status,
        created_at,
        stacktrackmaster:user_id (
          id, 
          first_name, 
          last_name, 
          email
        )
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    // Format the results
    return data.map(item => ({
      requestId: item.id,
      id: item.stacktrackmaster.id,
      first_name: item.stacktrackmaster.first_name,
      last_name: item.stacktrackmaster.last_name,
      email: item.stacktrackmaster.email,
      created_at: item.created_at
    }));
  } catch (error) {
    console.error('Error getting pending requests:', error);
    throw error;
  }
};

/**
 * Search for users by name or email
 * @param {string} searchTerm The search term
 * @returns {Promise<Array>} List of users matching the search
 */
export const searchUsers = async (searchTerm) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    // Search for users by name or email
    const { data, error } = await supabase
      .from('stacktrackmaster')
      .select('id, first_name, last_name, email')
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .neq('id', userId) // Exclude the current user
      .limit(20);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

/**
 * Get friendship suggestions for the current user
 * @returns {Promise<Array>} List of suggested users
 */
export const getFriendSuggestions = async () => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Get all existing friendships (including pending)
    const { data: existingFriends, error: friendsError } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (friendsError) throw friendsError;

    // Extract all user IDs that are already friends or have pending requests
    let excludeIds = [userId]; // Start with the current user
    existingFriends.forEach(friendship => {
      if (friendship.user_id === userId) {
        excludeIds.push(friendship.friend_id);
      } else if (friendship.friend_id === userId) {
        excludeIds.push(friendship.user_id);
      }
    });

    // Find users that are not already connected
    const { data, error } = await supabase
      .from('stacktrackmaster')
      .select('id, first_name, last_name, email')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(10);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting friend suggestions:', error);
    throw error;
  }
};

/**
 * Send a friend request
 * @param {string} friendId The ID of the user to send a request to
 * @returns {Promise<Object>} The created friendship record
 */
export const sendFriendRequest = async (friendId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Check if a friendship already exists
    const { data: existing, error: checkError } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('You are already friends with this user');
      } else {
        throw new Error('A friend request already exists');
      }
    }

    // Create a new friendship record
    const { data, error } = await supabase
      .from('friendships')
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Accept a friend request
 * @param {string} requestId The ID of the friendship record
 * @returns {Promise<Object>} The updated friendship record
 */
export const acceptFriendRequest = async (requestId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Update the friendship status to accepted
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date() })
      .eq('id', requestId)
      .eq('friend_id', userId) // Ensure the current user is the recipient
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Reject a friend request
 * @param {string} requestId The ID of the friendship record
 * @returns {Promise<void>}
 */
export const rejectFriendRequest = async (requestId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Delete the friendship record
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', requestId)
      .eq('friend_id', userId); // Ensure the current user is the recipient

    if (error) throw error;
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

/**
 * Remove a friend
 * @param {string} friendId The ID of the friend to remove
 * @returns {Promise<void>}
 */
export const removeFriend = async (friendId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Delete the friendship record(s)
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

    if (error) throw error;
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};