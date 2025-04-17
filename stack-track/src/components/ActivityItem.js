import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  likeActivity, 
  hasUserLikedActivity,
  getActivityLikes,
  addComment,
  getActivityComments,
  deleteComment
} from '../services/activityInteractionService';

function ActivityItem({ activity }) {
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  useEffect(() => {
    // Check if user has liked this activity
    const checkLikeStatus = async () => {
      try {
        const hasLiked = await hasUserLikedActivity(activity.id);
        setIsLiked(hasLiked);
      } catch (err) {
        console.error('Error checking like status:', err);
      }
    };

    // Get like count for this activity
    const getLikes = async () => {
      setIsLoadingLikes(true);
      try {
        const likesData = await getActivityLikes(activity.id);
        setLikes(likesData);
        setLikeCount(likesData.length);
      } catch (err) {
        console.error('Error getting likes:', err);
      } finally {
        setIsLoadingLikes(false);
      }
    };

    checkLikeStatus();
    getLikes();
  }, [activity.id]);

  const handleLikeToggle = async () => {
    try {
      const result = await likeActivity(activity.id);
      
      // Toggle the local like state
      setIsLiked(prevState => !prevState);
      
      // Update like count
      setLikeCount(prevCount => result.action === 'liked' ? prevCount + 1 : prevCount - 1);
      
      // Refresh the likes
      const likesData = await getActivityLikes(activity.id);
      setLikes(likesData);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const loadComments = async () => {
    if (!showComments) {
      setIsLoadingComments(true);
      try {
        const commentsData = await getActivityComments(activity.id);
        setComments(commentsData);
      } catch (err) {
        console.error('Error loading comments:', err);
      } finally {
        setIsLoadingComments(false);
      }
    }
    setShowComments(!showComments);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      await addComment(activity.id, commentText);
      
      // Clear the comment input
      setCommentText('');
      
      // Refresh comments
      const commentsData = await getActivityComments(activity.id);
      setComments(commentsData);
    } catch (err) {
      console.error('Error submitting comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this comment?');
    if (!confirmDelete) return;

    try {
      await deleteComment(commentId);
      
      // Remove the comment locally
      setComments(prevComments => prevComments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert(err.message);
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      signDisplay: 'always'
    }).format(amount);
  };

  return (
    <div className="activity-item">
      <div className="activity-avatar">
        {activity.userName.split(' ').map(name => name.charAt(0)).join('')}
      </div>
      <div className="activity-content">
        <div className="activity-header">
          <p>
            <span className="activity-name">{activity.userName}</span> {activity.description}
            {activity.result && (
              <span className={`activity-result ${activity.result.isPositive ? 'positive' : 'negative'}`}>
                {formatMoney(activity.result.value)}
              </span>
            )}
          </p>
          <p className="activity-time">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </p>
        </div>
        
        <div className="activity-interactions">
          <div className="activity-actions">
            <button 
              className={`like-button ${isLiked ? 'liked' : ''}`} 
              onClick={handleLikeToggle}
              disabled={isLoadingLikes}
            >
              {isLiked ? '❤️ Liked' : '♡ Like'} {likeCount > 0 && `(${likeCount})`}
            </button>
            <button 
              className={`comment-button ${showComments ? 'active' : ''}`} 
              onClick={loadComments}
            >
              💬 Comments {comments.length > 0 && `(${comments.length})`}
            </button>
          </div>
          
          {showComments && (
            <div className="activity-comments">
              {isLoadingComments ? (
                <div className="loading-comments">Loading comments...</div>
              ) : (
                <>
                  {comments.length > 0 ? (
                    <div className="comments-list">
                      {comments.map(comment => (
                        <div className="comment" key={comment.id}>
                          <div className="comment-avatar">
                            {comment.userName.split(' ').map(name => name.charAt(0)).join('')}
                          </div>
                          <div className="comment-content">
                            <div className="comment-header">
                              <span className="comment-author">{comment.userName}</span>
                              <span className="comment-time">
                                {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="comment-text">{comment.content}</p>
                          </div>
                          {/* Only show delete button for user's own comments */}
                          {/* This will require additional check in a real app */}
                          <button 
                            className="delete-comment-btn"
                            onClick={() => handleDeleteComment(comment.id)}
                            title="Delete comment"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-comments">No comments yet. Be the first to comment!</div>
                  )}
                  
                  <form className="comment-form" onSubmit={handleSubmitComment}>
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={isSubmittingComment}
                      className="comment-input"
                    />
                    <button 
                      type="submit" 
                      disabled={isSubmittingComment || !commentText.trim()}
                      className="submit-comment-btn"
                    >
                      {isSubmittingComment ? 'Sending...' : 'Send'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityItem;