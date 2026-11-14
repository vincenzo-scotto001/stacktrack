import React from 'react';
import { initials } from '../../lib/format';

// Casino chip colours. Each player gets a stable chip based on their id.
const CHIPS = ['#ED7B3F', '#3B6FD4', '#2E8B5E', '#C9433F', '#7B55C7', '#D9A21B', '#7C7D81', '#1F9AA8'];

export function chipColor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CHIPS[h % CHIPS.length];
}

/** A player avatar drawn as a poker chip with their initials. */
export default function Avatar({ profile, id, size = 40 }) {
  const key = id || profile?.id || '';
  return (
    <span
      className="avatar"
      style={{ '--chip': chipColor(key), '--size': `${size}px` }}
      aria-hidden="true"
    >
      <span className="avatar-face">{initials(profile)}</span>
    </span>
  );
}
