import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Route as RouteIcon } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import SectionTabs, { TRACK_TABS } from '../components/layout/SectionTabs';
import JourneyCard from '../components/JourneyCard';
import { Skeleton, ErrorState, EmptyState } from '../components/ui/States';
import useAsync from '../hooks/useAsync';
import { listJourneys } from '../api/journeys';

export default function Journeys() {
  const { data, error, loading, reload } = useAsync(() => listJourneys(), []);
  const open = (data || []).filter((j) => !j.is_completed).sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
  const done = (data || []).filter((j) => j.is_completed);

  return (
    <div className="page">
      <PageHeader
        title="Tournaments"
        actions={<Link to="/journeys/new" className="btn btn-primary btn-sm"><Plus size={16} aria-hidden="true" /> New journey</Link>}
      />
      <SectionTabs tabs={TRACK_TABS} label="Tournaments" />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Skeleton rows={3} height={140} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={RouteIcon}
          title="Plan your next series"
          action={<Link to="/journeys/new" className="btn btn-primary">Create a journey</Link>}
        >
          A journey is a schedule of events for a festival or trip. Plan buy-ins and action sold before you go,
          copy the schedule for your backers, then mark results as you play. Finished events land in your stats.
        </EmptyState>
      )}

      {open.length > 0 && (
        <section className="section-gap-lg">
          <h2 className="group-title">Live and upcoming</h2>
          <div className="journey-grid">{open.map((j) => <JourneyCard key={j.id} journey={j} />)}</div>
        </section>
      )}
      {done.length > 0 && (
        <section className="section-gap-lg">
          <h2 className="group-title">Completed</h2>
          <div className="journey-grid">{done.map((j) => <JourneyCard key={j.id} journey={j} />)}</div>
        </section>
      )}
    </div>
  );
}
