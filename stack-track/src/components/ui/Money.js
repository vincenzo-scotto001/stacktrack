import React from 'react';
import { money } from '../../lib/format';

/** Money with gain/loss colouring. `sign` shows +/− and colours by sign. */
export default function Money({ value, sign = false, cents = false, className = '' }) {
  const n = Number(value) || 0;
  const tone = sign ? (n > 0.5 ? 'gain' : n < -0.5 ? 'loss' : 'flat') : '';
  return <span className={`num ${tone} ${className}`.trim()}>{money(n, { sign, cents })}</span>;
}
