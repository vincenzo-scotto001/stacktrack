import React from 'react';

/**
 * The checkered edge of a chip stack, from the StackTrack logo.
 * Used as a progress meter: one square per event.
 *   segments: array of 'cash' | 'played' | 'upcoming'
 */
export default function ChipEdge({ segments, label }) {
  return (
    <div className="chip-edge" role="img" aria-label={label}>
      {segments.map((s, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} className={`chip-edge-seg is-${s}`} />
      ))}
    </div>
  );
}
