import React from 'react';
import { Link } from 'react-router-dom';
import Money from './ui/Money';
import { enrich, hasResult } from '../lib/stats';
import { formatDay, ordinal, todayString } from '../lib/format';

function outcome(t, showResults) {
  if (!showResults) return null;
  if (t.place) {
    return `${ordinal(t.place)}${t.entries ? ` of ${Number(t.entries).toLocaleString('en-US')}` : ''}`;
  }
  if (t.cashed) return 'Cashed';
  if (t.date > todayString()) return 'Upcoming';
  return 'No cash';
}

/**
 * One tournament in a list. Links to the edit form when `editable`.
 * When `showResults` is false (a friend hides results) only the schedule shows.
 */
export default function TournamentRow({ t: raw, editable = true, showResults = true, selectable, selected, onToggle }) {
  const t = enrich(raw);
  const body = (
    <>
      {selectable && (
        <input
          type="checkbox"
          className="row-check"
          checked={selected}
          onChange={() => onToggle(t.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${t.tournament_name}`}
        />
      )}
      <div className="list-main">
        <span className="list-title">{t.tournament_name}</span>
        <span className="list-meta">
          <span>{formatDay(t.date, { short: true })}</span>
          {t.location && <span className="truncate">{t.location}</span>}
          {t.sold > 0 && showResults && <span>{Math.round(t.sold * 100)}% sold</span>}
        </span>
      </div>
      {showResults && (
        <div className="list-end">
          {hasResult(t) || t.date <= todayString() ? <Money value={t.net} sign /> : <Money value={t.buyIn} className="faint" />}
          <small>{outcome(t, showResults)}</small>
        </div>
      )}
    </>
  );

  if (selectable) {
    return (
      // eslint-disable-next-line jsx-a11y/label-has-associated-control
      <label className={`list-row is-selectable ${selected ? 'is-selected' : ''}`}>{body}</label>
    );
  }
  if (editable) {
    return <Link to={`/tournaments/${t.id}/edit`} className="list-row">{body}</Link>;
  }
  return <div className="list-row">{body}</div>;
}
