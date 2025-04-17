import { supabase } from '../supabaseClient';

/**
 * Like an activity
 * @param {string} activityId The activity ID to like
 * @returns {Promise<Object>} The created like record
 */
export const likeActivity = async (activityId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Check if already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('activity_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .maybeSingle();

    if (checkError) throw checkError;

    // If already liked, unlike it (toggle behavior)
    if (existingLike) {
      const { error: deleteError } = await supabase
        .from('activity_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) throw deleteError;
      return { action: 'unliked', id: existingLike.id };
    }

    // Otherwise, create new like
    const { data, error } = await supabase
      .from('activity_likes')
      .insert({
        user_id: userId,
        activity_id: activityId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return { action: 'liked', data };
  } catch (error) {
    console.error('Error liking activity:', error);
    throw error;
  }
};

/**
 * Get likes for an activity
 * @param {string} activityId The activity ID
 * @returns {Promise<Array>} Array of likes with user info
 */
export const getActivityLikes = async (activityId) => {
  try {
    const { data, error } = await supabase
      .from('activity_likes')
      .select(`
        id,
        created_at,
        stacktrackmaster:user_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(like => ({
      id: like.id,
      userId: like.stacktrackmaster.id,
      userName: `${like.stacktrackmaster.first_name} ${like.stacktrackmaster.last_name}`,
      timestamp: new Date(like.created_at)
    }));
  } catch (error) {
    console.error('Error getting activity likes:', error);
    throw error;
  }
};

/**
 * Check if user has liked an activity
 * @param {string} activityId The activity ID
 * @returns {Promise<boolean>} Whether the current user has liked the activity
 */
export const hasUserLikedActivity = async (activityId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { data, error } = await supabase
      .from('activity_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  } catch (error) {
    console.error('Error checking if user liked activity:', error);
    return false;
  }
};

/**
 * Add a comment to an activity
 * @param {string} activityId The activity ID
 * @param {string} content The comment content
 * @returns {Promise<Object>} The created comment
 */
export const addComment = async (activityId, content) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('activity_comments')
      .insert({
        user_id: userId,
        activity_id: activityId,
        content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

/**
 * Get comments for an activity
 * @param {string} activityId The activity ID
 * @returns {Promise<Array>} Array of comments with user info
 */
export const getActivityComments = async (activityId) => {
  try {
    const { data, error } = await supabase
      .from('activity_comments')
      .select(`
        id,
        content,
        created_at,
        stacktrackmaster:user_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(comment => ({
      id: comment.id,
      userId: comment.stacktrackmaster.id,
      userName: `${comment.stacktrackmaster.first_name} ${comment.stacktrackmaster.last_name}`,
      content: comment.content,
      timestamp: new Date(comment.created_at)
    }));
  } catch (error) {
    console.error('Error getting activity comments:', error);
    throw error;
  }
};

/**
 * Delete a comment
 * @param {string} commentId The comment ID
 * @returns {Promise<void>}
 */
export const deleteComment = async (commentId) => {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // First check if the comment belongs to this user
    const { data: comment, error: checkError } = await supabase
      .from('activity_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (checkError) throw checkError;

    if (comment.user_id !== userId) {
      throw new Error('You can only delete your own comments');
    }

    // Delete the comment
    const { error } = await supabase
      .from('activity_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};