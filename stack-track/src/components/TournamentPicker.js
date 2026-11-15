import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BadgeCheck, History, Users } from 'lucide-react';
import { searchCatalog } from '../api/catalog';
import { getMyHistory } from '../api/tournaments';
import { historySuggestions, mergeSuggestions, scheduleLabel, nameKey } from '../lib/catalog';
import { money, pluralize } from '../lib/format';

function Tag({ s }) {
  if (s.source === 'official') {
    return <span className="tag tag-orange"><BadgeCheck size={12} aria-hidden="true" /> Official</span>;
  }
  if (s.source === 'history') {
    return <span className="tag"><History size={12} aria-hidden="true" /> {s.count > 1 ? `Played ${s.count}×` : 'Played'}</span>;
  }
  if (s.mine) {
    const others = (s.player_count || 1) - 1;
    return <span className="tag"><History size={12} aria-hidden="true" /> {others > 0 ? `You + ${others}` : 'Played'}</span>;
  }
  return <span className="tag"><Users size={12} aria-hidden="true" /> {pluralize(s.player_count || 0, 'player')}</span>;
}

/**
 * Tournament name field that suggests tournaments as you type: your own
 * history instantly, plus the shared catalog (official schedules and
 * tournaments other players log). Picking one calls onPick with the entry.
 */
export default function TournamentPicker({
  id, value, onChange, onPick, date, placeholder, autoFocus, required, describedBy,
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [history, setHistory] = useState([]);
  const [remote, setRemote] = useState({ term: '', items: [] });
  const [loading, setLoading] = useState(false);
  const blurTimer = useRef(null);
  // Last pointer position over the list. Browsers send hover events when the
  // list appears under a resting mouse; only real movement should move the
  // highlight, or keyboard users could pick the wrong row.
  const pointer = useRef(null);
  const term = value || '';
  const q = term.trim();

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  useEffect(() => {
    if (!open || q.length < 2) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchCatalog(q, date).then((items) => {
        if (!alive) return;
        setRemote({ term: q, items });
        setLoading(false);
      });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, date, open]);

  const items = useMemo(() => {
    const own = historySuggestions(history, q, q.length < 2 ? 6 : 5);
    if (q.length < 2) return own;
    // While a new search is in flight, keep showing earlier results that
    // still contain every typed word, so the list doesn't flicker.
    const words = nameKey(q).split(' ');
    const catalog = remote.items.filter((c) => {
      const hay = `${nameKey(c.name)} ${nameKey(c.venue)}`;
      return remote.term === q || words.every((w) => hay.includes(w));
    });
    return mergeSuggestions(catalog, own);
  }, [history, q, remote]);

  const showList = open && (items.length > 0 || (q.length >= 2 && !loading) || (loading && !items.length));

  const pick = (s) => {
    onPick(s);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') pointer.current = null;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter' && open && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape' && showList) {
      // Close the list without closing a surrounding dialog
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="picker">
      <input
        id={id}
        className="input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck="false"
        value={term}
        placeholder={placeholder}
        required={required}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
          pointer.current = null;
        }}
        onFocus={() => {
          clearTimeout(blurTimer.current);
          getMyHistory().then(setHistory).catch(() => {});
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="picker-list" aria-label="Suggested tournaments">
          {q.length < 2 && items.length > 0 && <li className="picker-head" role="presentation">Your regulars</li>}
          {items.map((s, i) => {
            const when = scheduleLabel(s);
            return (
              <li
                key={s.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`picker-option ${i === active ? 'is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={(e) => {
                  const p = pointer.current;
                  pointer.current = { x: e.clientX, y: e.clientY };
                  if (p && (p.x !== e.clientX || p.y !== e.clientY)) setActive(i);
                }}
                onClick={() => pick(s)}
              >
                <span className="picker-main">
                  <span className="picker-name">{s.name}</span>
                  <span className="picker-meta">
                    {(s.series_name || s.venue) && <span className="truncate">{s.series_name || s.venue}</span>}
                    {when && <span>{when}</span>}
                    {s.buy_in != null && <span className="num">{money(s.buy_in)}</span>}
                  </span>
                </span>
                <Tag s={s} />
              </li>
            );
          })}
          {loading && !items.length && <li className="picker-note" role="presentation">Searching…</li>}
          {!loading && q.length >= 2 && !items.length && (
            <li className="picker-note" role="presentation">No matches yet. Fill in the details below to add it.</li>
          )}
        </ul>
      )}
    </div>
  );
}
