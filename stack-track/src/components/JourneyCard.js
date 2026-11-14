import React from 'react';
import { Link } from 'react-router-dom';
import ChipEdge from './ui/ChipEdge';
import Money from './ui/Money';
import { summarize } from '../lib/stats';
import { formatDayRange, todayString, money } from '../lib/format';

export function journeyStatus(j) {
  const today = todayString();
  if (j.is_completed) return { label: 'Complete', tone: '' };
  if (j.start_date > today) return { label: 'Upcoming', tone: 'tag-orange' };
  if (j.end_date < today) return { label: 'Needs results', tone: 'tag-orange' };
  return { label: 'Live now', tone: 'tag-gain' };
}

export function journeySegments(events) {
  return events.map((e) => {
    if (!e.is_completed) return 'upcoming';
    return Number(e.winnings) > 0 ? 'cash' : 'played';
  });
}

export default function JourneyCard({ journey }) {
  const events = journey.events || [];
  const done = events.filter((e) => e.is_completed);
  const s = summarize(done);
  const status = journeyStatus(journey);
  const committed = events.reduce((sum, e) => sum + (Number(e.buy_in) || 0), 0);
  return (
    <Link to={`/journeys/${journey.id}`} className="journey-card">
      <div className="row-between">
        <h3 className="truncate">{journey.name}</h3>
        <span className={`tag ${status.tone}`}>{status.label}</span>
      </div>
      <p className="muted journey-dates">{formatDayRange(journey.start_date, journey.end_date)}</p>
      <ChipEdge segments={journeySegments(events)} label={`${done.length} of ${events.length} events played`} />
      <div className="journey-foot">
        <span className="muted">{done.length} of {events.length} played</span>
        {done.length > 0 ? (
          <span><Money value={s.net} sign /> <span className="faint">net</span></span>
        ) : (
          <span className="num">{money(committed)} <span className="faint">planned</span></span>
        )}
      </div>
    </Link>
  );
}
