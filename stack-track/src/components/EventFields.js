import React from 'react';

/** Editable fields for one journey event, used in create and edit. */
export default function EventFields({ value, onChange, minDate, maxDate, idPrefix, withResult = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const id = (k) => `${idPrefix}-${k}`;
  return (
    <div className="form-grid">
      <div className="field span-2">
        <label htmlFor={id('name')}>Event</label>
        <input id={id('name')} className="input" value={value.tournament_name} onChange={set('tournament_name')} placeholder="e.g. Event #12 $1,500 Monster Stack" required />
      </div>
      <div className="field">
        <label htmlFor={id('date')}>Date</label>
        <input id={id('date')} className="input" type="date" min={minDate} max={maxDate} value={value.date} onChange={set('date')} required />
      </div>
      <div className="field">
        <label htmlFor={id('loc')}>Venue</label>
        <input id={id('loc')} className="input" value={value.location} onChange={set('location')} />
      </div>
      <div className="field">
        <label htmlFor={id('buy')}>Buy-in</label>
        <div className="input-affix">
          <span className="affix">$</span>
          <input id={id('buy')} className="input" type="number" inputMode="decimal" min="0" step="any" value={value.buy_in} onChange={set('buy_in')} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id('sold')}>Action sold</label>
        <div className="input-affix has-right">
          <input id={id('sold')} className="input" type="number" inputMode="decimal" min="0" max="100" step="any" value={value.action_sold} onChange={set('action_sold')} placeholder="0" />
          <span className="affix affix-right">%</span>
        </div>
      </div>
      <div className="field span-2">
        <label htmlFor={id('notes')}>Notes <span className="field-optional">(optional)</span></label>
        <input id={id('notes')} className="input" value={value.notes} onChange={set('notes')} placeholder="Who you sold to, start time, satellites…" />
      </div>
      {withResult && (
        <>
          <label className="switch span-2 result-switch">
            <span>
              <strong>I’ve played this event</strong>
              <span className="field-hint block">Played events count toward your stats.</span>
            </span>
            <input type="checkbox" checked={!!value.is_completed} onChange={set('is_completed')} />
          </label>
          {value.is_completed && (
            <>
              <div className="field">
                <label htmlFor={id('place')}>Finish <span className="field-optional">(optional)</span></label>
                <input id={id('place')} className="input" type="number" inputMode="numeric" min="1" step="1" value={value.place ?? ''} onChange={set('place')} />
              </div>
              <div className="field">
                <label htmlFor={id('win')}>Cashed for</label>
                <div className="input-affix">
                  <span className="affix">$</span>
                  <input id={id('win')} className="input" type="number" inputMode="decimal" min="0" step="any" value={value.winnings ?? ''} onChange={set('winnings')} placeholder="0" />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
