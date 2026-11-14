import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Avatar from '../components/ui/Avatar';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { listNotifications, markNotificationsRead } from '../api/social';
import { fullName, timeAgo } from '../lib/format';

const TEXT = {
  like: 'liked your post',
  comment: 'commented on your post',
  friend_request: 'sent you a friend request',
  friend_accept: 'accepted your friend request',
};

function target(n) {
  if (n.type === 'friend_request') return '/friends';
  if (n.activity_id) return `/posts/${n.activity_id}`;
  return `/players/${n.actor_id}`;
}

export default function Notifications() {
  const { data, error, loading, reload } = useAsync(() => listNotifications(), []);

  useEffect(() => {
    if (data && data.some((n) => !n.read_at)) {
      markNotificationsRead().then(() => window.dispatchEvent(new Event('stacktrack:notifications-read')));
    }
  }, [data]);

  return (
    <div className="page page-narrow">
      <PageHeader title="Notifications" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={5} />}
      {data && data.length === 0 && (
        <EmptyState icon={Bell} title="You’re all caught up">
          Likes, comments and friend requests show up here.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="panel panel-flush">
          <ul className="list">
            {data.map((n) => (
              <li key={n.id}>
                <Link to={target(n)} className={`list-row notif ${n.read_at ? '' : 'is-unread'}`}>
                  <Avatar profile={n.actor} id={n.actor_id} size={40} />
                  <span className="list-main">
                    <span className="notif-text"><strong>{fullName(n.actor)}</strong> {TEXT[n.type] || 'interacted with you'}</span>
                    <span className="list-meta">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="unread-dot" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
