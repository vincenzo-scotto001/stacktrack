import React from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import ActivityCard from '../components/feed/ActivityCard';
import { Skeleton, ErrorState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { getActivity } from '../api/feed';

export default function Post() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => getActivity(id), [id]);
  return (
    <div className="page page-narrow">
      <PageHeader title="Post" back={{ to: '/feed', label: 'Feed' }} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={1} height={160} />}
      {data && <div className="feed"><ActivityCard item={data} defaultOpen /></div>}
    </div>
  );
}
