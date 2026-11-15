import {
  enrich,
  summarize,
  cumulativeSeries,
  periodSeries,
  breakdown,
  buyInBucket,
  filterByRange,
  hasResult,
} from './stats';
import { money, ordinal, parseDay, toDayString, compactMoney, percent } from './format';
import {
  parseCsv, importTournamentsFromCsv, tournamentsToCsv, importScheduleFromCsv, parseTime, parseAmount, parseWeekday,
} from './csv';

const T = (o) => ({ id: Math.random().toString(36).slice(2), tournament_name: 'Event', location: 'Venue', action_sold: 0, winnings: 0, place: null, ...o });

describe('enrich / net result', () => {
  test('no action sold', () => {
    const t = enrich(T({ buy_in: 100, winnings: 450 }));
    expect(t.net).toBe(350);
    expect(t.cashed).toBe(true);
  });

  test('action sold scales both cost and payout', () => {
    const t = enrich(T({ buy_in: 1000, winnings: 5000, action_sold: 40 }));
    expect(t.cost).toBe(600);
    expect(t.payout).toBe(3000);
    expect(t.net).toBe(2400);
  });

  test('bust with action sold only costs your share', () => {
    expect(enrich(T({ buy_in: 1000, action_sold: 50 })).net).toBe(-500);
  });

  test('hasResult', () => {
    expect(hasResult({ winnings: 0, place: null })).toBe(false);
    expect(hasResult({ winnings: 10 })).toBe(true);
    expect(hasResult({ place: 120 })).toBe(true);
  });
});

describe('summarize', () => {
  const list = [
    T({ date: '2026-01-05', buy_in: 100 }),
    T({ date: '2026-01-06', buy_in: 100, winnings: 400, place: 3 }),
    T({ date: '2026-01-07', buy_in: 100, winnings: 150, place: 12 }),
    T({ date: '2026-01-08', buy_in: 100 }),
    T({ date: '2026-01-09', buy_in: 100 }),
    T({ date: '2026-01-10', buy_in: 100, winnings: 1000, place: 1 }),
  ];
  const s = summarize(list);

  test('totals', () => {
    expect(s.count).toBe(6);
    expect(s.cost).toBe(600);
    expect(s.payout).toBe(1550);
    expect(s.net).toBe(950);
    expect(s.roi).toBeCloseTo(158.33, 1);
  });

  test('cashes, wins, top nine', () => {
    expect(s.cashes).toBe(3);
    expect(s.itm).toBe(50);
    expect(s.wins).toBe(1);
    expect(s.topNine).toBe(2);
    expect(s.biggestCash.cash).toBe(1000);
  });

  test('streaks and drawdown', () => {
    expect(s.longestCashStreak).toBe(2);
    expect(s.longestDryStreak).toBe(2);
    expect(s.currentStreak).toEqual({ type: 'cash', length: 1 });
    // cum: -100, 200, 250, 150, 50, 950 → peak 250 → trough 50 → drawdown 200
    expect(s.maxDrawdown).toBe(200);
  });

  test('empty list is safe', () => {
    const e = summarize([]);
    expect(e.count).toBe(0);
    expect(e.roi).toBe(0);
    expect(e.biggestCash).toBeNull();
  });

  test('sorts by date regardless of input order', () => {
    const series = cumulativeSeries([...list].reverse());
    expect(series[0].cum).toBe(0);
    expect(series[1].cum).toBe(-100);
    expect(series[series.length - 1].cum).toBe(950);
  });
});

describe('grouping', () => {
  const list = [
    T({ date: '2026-01-31', buy_in: 50, location: 'A' }),
    T({ date: '2026-02-01', buy_in: 2000, winnings: 6000, location: 'B' }),
    T({ date: '2026-02-15', buy_in: 300, location: 'A' }),
  ];

  test('monthly periods in order', () => {
    const months = periodSeries(list, 'month');
    expect(months.map((m) => m.key)).toEqual(['2026-01', '2026-02']);
    expect(months[1].net).toBe(3700);
    expect(months[1].count).toBe(2);
  });

  test('weekly periods start on Monday', () => {
    const weeks = periodSeries([T({ date: '2026-03-08', buy_in: 1 })], 'week'); // Sunday
    expect(weeks[0].key).toBe('2026-03-02');
  });

  test('breakdown by location', () => {
    const rows = breakdown(list, (t) => t.location);
    const a = rows.find((r) => r.key === 'A');
    expect(a.count).toBe(2);
    expect(a.net).toBe(-350);
  });

  test('buy-in buckets', () => {
    expect(buyInBucket({ buy_in: 99 }).label).toBe('Under $100');
    expect(buyInBucket({ buy_in: 100 }).label).toBe('$100–$299');
    expect(buyInBucket({ buy_in: 10000 }).label).toBe('$5k and up');
  });

  test('filter by preset and explicit range', () => {
    const now = new Date(2026, 2, 2); // 30 days back = Feb 1
    expect(filterByRange(list, '30d', now)).toHaveLength(2);
    expect(filterByRange(list, 'all', now)).toHaveLength(3);
    expect(filterByRange(list, { from: '2026-02-01', to: '2026-02-01' })).toHaveLength(1);
  });
});

describe('format', () => {
  test('money', () => {
    expect(money(1234.5)).toBe('$1,235');
    expect(money(-50)).toBe('−$50');
    expect(money(50, { sign: true })).toBe('+$50');
    expect(money(-50, { sign: true })).toBe('−$50');
    expect(money(0, { sign: true })).toBe('$0');
  });

  test('compact money and percent', () => {
    expect(compactMoney(1500)).toBe('$1.5k');
    expect(compactMoney(-2_400_000)).toBe('−$2.4M');
    expect(percent(12.345)).toBe('12.3%');
    expect(percent(-3, { sign: true })).toBe('−3.0%');
  });

  test('ordinal', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(1023)).toBe('1023rd');
  });

  test('day strings are local calendar days', () => {
    const d = parseDay('2026-03-04');
    expect(d.getDate()).toBe(4);
    expect(d.getMonth()).toBe(2);
    expect(toDayString(d)).toBe('2026-03-04');
  });
});

describe('csv', () => {
  test('parses quotes, commas and CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });

  test('round trip export → import', () => {
    const csv = tournamentsToCsv([
      { tournament_name: 'Main, Event', date: '2026-07-03', location: 'Horseshoe', buy_in: 10000, action_sold: 25, place: 87, winnings: 52000 },
    ]);
    const { rows, errors } = importTournamentsFromCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ tournament_name: 'Main, Event', date: '2026-07-03', buy_in: 10000, action_sold: 25, place: 87, winnings: 52000 });
  });

  test('accepts loose headers and money formatting', () => {
    const { rows, errors } = importTournamentsFromCsv('Event,Date,Venue,Buy in,Payout\nDaily $150,3/14/2026,Borgata,"$1,100","$2,450.50"');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ tournament_name: 'Daily $150', date: '2026-03-14', location: 'Borgata', buy_in: 1100, winnings: 2450.5 });
  });

  test('reports missing required columns', () => {
    const { rows, errors } = importTournamentsFromCsv('Name,Venue\nA,B');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/Date, Buy-in/);
  });

  test('reports bad rows without dropping good ones', () => {
    const { rows, errors } = importTournamentsFromCsv('Name,Date,Buy-in\nGood,2026-01-01,100\nBad,someday,100');
    expect(rows).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 3/);
  });
});

describe('schedule import', () => {
  test('parses times in common formats', () => {
    expect(parseTime('11:00 AM')).toBe('11:00');
    expect(parseTime('7:10 pm')).toBe('19:10');
    expect(parseTime('12pm')).toBe('12:00');
    expect(parseTime('12:30 a.m.')).toBe('00:30');
    expect(parseTime('19:00')).toBe('19:00');
    expect(parseTime('')).toBeNull();
    expect(parseTime('noonish')).toBeUndefined();
    expect(parseTime('13 pm')).toBeUndefined();
  });

  test('parses guarantees and buy-ins', () => {
    expect(parseAmount('$500K GTD')).toBe(500000);
    expect(parseAmount('$1.5M')).toBe(1500000);
    expect(parseAmount('$1,100')).toBe(1100);
    expect(parseAmount('—')).toBeNull();
    expect(Number.isNaN(parseAmount('lots'))).toBe(true);
  });

  test('parses weekdays', () => {
    expect(parseWeekday('Mon')).toBe(1);
    expect(parseWeekday('Saturdays')).toBe(6);
    expect(parseWeekday('Daily')).toBe('daily');
    expect(parseWeekday('Funday')).toBeUndefined();
  });

  test('pasted spreadsheet cells (tab separated) with long dates', () => {
    const paste = [
      'Date\tTime\t#\tEvent\tBuy-in\tGTD',
      'Saturday, December 19, 2026\t10:10 AM\t56\tNo Limit Hold\'em 1E\t$1,100\t$500K GTD',
      '12/19/2026\t5:10 PM\t58\tNLH Bounty\t$200\t$20K',
    ].join('\n');
    const { rows, errors } = importScheduleFromCsv(paste);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: "Event #56 No Limit Hold'em 1E", event_date: '2026-12-19', start_time: '10:10', buy_in: 1100, guarantee: 500000, weekday: null });
    expect(rows[1]).toMatchObject({ name: 'Event #58 NLH Bounty', start_time: '17:10', buy_in: 200, guarantee: 20000 });
  });

  test('weekly and daily rows use a Day column', () => {
    const csv = 'Day,Time,Tournament,Buy-in\nMonday,7pm,Monday Night Bounty,250\nDaily,11am,Daily Deepstack,150';
    const { rows, errors } = importScheduleFromCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ weekday: 1, event_date: null, start_time: '19:00' });
    expect(rows[1]).toMatchObject({ weekday: null, event_date: null, name: 'Daily Deepstack' });
  });

  test('reports missing columns and bad rows', () => {
    expect(importScheduleFromCsv('Event,Time\nA,11am').errors[0]).toMatch(/Buy-in, Date/);
    const { rows, errors } = importScheduleFromCsv('Date,Event,Buy-in,Time\n2027-01-08,Kickoff,400,11am\nsoon,Bad,400,11am\n2027-01-09,Bad time,400,25:00');
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  test('a stray inch mark inside a cell is kept as text', () => {
    expect(parseCsv('a,b\n5" table,x')).toEqual([['a', 'b'], ['5" table', 'x']]);
  });
});

describe('catalog suggestions', () => {
  // eslint-disable-next-line global-require
  const { historySuggestions, mergeSuggestions, scheduleLabel, formatTime, fillFromSuggestion } = require('./catalog');
  const history = [
    { tournament_name: 'Borgata Daily $150', location: 'Borgata', buy_in: 150, date: '2026-11-01' },
    { tournament_name: 'borgata  daily $150', location: 'borgata', buy_in: 150, date: '2026-11-08' },
    { tournament_name: 'Wynn Signature $1,100', location: 'Wynn', buy_in: 1100, date: '2026-10-01' },
    { tournament_name: 'Venetian $400', location: 'Venetian', buy_in: 400, date: '2026-09-01' },
  ];

  test('history groups repeats and matches every typed word', () => {
    const all = historySuggestions(history, '');
    expect(all[0]).toMatchObject({ name: 'Borgata Daily $150', count: 2, last_played: '2026-11-08' });
    expect(historySuggestions(history, 'daily borg')).toHaveLength(1);
    expect(historySuggestions(history, 'wynn')).toHaveLength(1);
    expect(historySuggestions(history, 'aria')).toHaveLength(0);
  });

  test('merge drops history entries the catalog already has', () => {
    const catalog = [{ id: 'c1', source: 'community', name: 'BORGATA DAILY $150', venue: 'Borgata', buy_in: 150 }];
    const merged = mergeSuggestions(catalog, historySuggestions(history, ''));
    expect(merged.map((m) => m.name)).toEqual(['BORGATA DAILY $150', 'Wynn Signature $1,100', 'Venetian $400']);
  });

  test('schedule labels', () => {
    expect(formatTime('19:00:00')).toBe('7:00 PM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(scheduleLabel({ weekday: 1, start_time: '19:00' })).toBe('Every Monday, 7:00 PM');
    expect(scheduleLabel({ source: 'official', start_time: '11:00' })).toBe('Daily, 11:00 AM');
    expect(scheduleLabel({ source: 'community' })).toBe('');
    expect(scheduleLabel({ event_date: '2027-01-12', start_time: '11:00' })).toMatch(/^Jan 12, 2027, 11:00 AM$/);
  });

  test('picking fills the form and keeps the catalog link', () => {
    const current = { date: '2026-11-14', buy_in: '', game_type: 'NLH' };
    expect(fillFromSuggestion({ id: 'e1', source: 'official', name: 'Event #5', venue: 'Borgata', buy_in: 600, event_date: '2027-01-12', game_type: 'PLO' }, current))
      .toEqual({ tournament_name: 'Event #5', location: 'Borgata', buy_in: '600', game_type: 'PLO', date: '2027-01-12', catalog_event_id: 'e1' });
    expect(fillFromSuggestion({ source: 'history', name: 'X', venue: 'Y', buy_in: 50 }, current))
      .toMatchObject({ date: '2026-11-14', catalog_event_id: null, game_type: 'NLH' });
  });
});
