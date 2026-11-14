import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionTabs, { SOCIAL_TABS } from '../components/layout/SectionTabs';
import ActivityCard from '../components/feed/ActivityCard';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { useUI } from '../context/UIContext';
import { listFeed } from '../api/feed';

export default function Feed() {
  const { toast } = useUI();
  const { data, error, loading, reload, setData } = useAsync(() => listFeed({ limit: 15 }), []);
  const [more, setMore] = useState(false);

  const loadMore = async () => {
    const items = data.items;
    setMore(true);
    try {
      const next = await listFeed({ limit: 15, before: items[items.length - 1].createdAt });
      setData((d) => ({ items: [...d.items, ...next.items], hasMore: next.hasMore }));
    } catch (e) {
      toast(e.message, { type: 'error' });
    } finally {
      setMore(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Social" />
      <SectionTabs tabs={SOCIAL_TABS} label="Social" />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={4} height={120} />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={Newspaper}
          title="Your feed is quiet"
          action={<Link to="/friends" className="btn btn-primary">Find friends</Link>}
        >
          Results you and your friends post show up here. Add a few friends to get it going.
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <div className="feed">
          {data.items.map((item) => <ActivityCard key={item.id} item={item} />)}
          {data.hasMore && (
            <div className="load-more">
              <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={more}>
                {more ? 'Loading…' : 'Load older posts'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
