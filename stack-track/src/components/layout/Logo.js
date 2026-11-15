import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Hovering, focusing or tapping the logo spins the chip like one flicked flat
 * on the felt: fast at first, slowing to a stop. Each spin is a little
 * different, always lands on a whole edge spot (the chip looks the same every
 * 45°) so it settles without a jump, and finishes even if the pointer leaves.
 */
export default function Logo({ to = '/' }) {
  const [spin, setSpin] = useState(null);
  const spinning = useRef(false);

  const flick = useCallback(() => {
    if (spinning.current || prefersReducedMotion()) return;
    spinning.current = true;
    const spots = 20 + Math.floor(Math.random() * 13); // 20–32 spots = 2.5–4 turns
    const angle = spots * 45;
    setSpin({ angle, duration: 1.1 + angle / 1800 }); // about 1.6–1.9s
  }, []);

  const settle = (e) => {
    if (e.animationName !== 'chip-spin') return;
    spinning.current = false;
    setSpin(null);
  };

  return (
    <Link to={to} className="logo" aria-label="StackTrack home" onMouseEnter={flick} onFocus={flick}>
      <span
        className={`logo-chip ${spin ? 'is-spinning' : ''}`}
        style={spin ? { '--spin-angle': `${spin.angle}deg`, '--spin-duration': `${spin.duration}s` } : undefined}
        onAnimationEnd={settle}
        aria-hidden="true"
      />
      StackTrack
    </Link>
  );
}
