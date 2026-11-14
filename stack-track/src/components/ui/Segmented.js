import React from 'react';

/** Segmented control (radio group styled as tabs). */
export default function Segmented({ options, value, onChange, label, size }) {
  return (
    <div className={`segmented ${size === 'sm' ? 'segmented-sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'is-active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.badge ? <span className="seg-badge">{o.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
