// Deterministic sample data for demo mode. Dates are relative to "now" so the
// demo always looks current.

export const DEMO_USER = {
  id: 'u-me',
  first_name: 'Alex',
  last_name: 'Rivera',
  username: 'arivera',
  email: 'alex@example.com',
  bio: 'Mid-stakes MTT grinder. Chasing a WSOP bracelet one $1,500 at a time.',
  home_venue: 'Borgata',
  share_results: true,
};

const PLAYERS = [
  DEMO_USER,
  { id: 'u-maya', first_name: 'Maya', last_name: 'Chen', username: 'mayachen', bio: 'High roller in training.', home_venue: 'Aria', share_results: true },
  { id: 'u-dre', first_name: 'Dre', last_name: 'Johnson', username: 'dre', bio: 'Weekend warrior.', home_venue: 'Seminole Hard Rock', share_results: true },
  { id: 'u-sofia', first_name: 'Sofia', last_name: 'Marquez', username: 'sofi', bio: '', home_venue: 'Commerce Casino', share_results: true },
  { id: 'u-tom', first_name: 'Tom', last_name: 'Kowalski', username: 'tk_poker', bio: 'Daily deepstacks and bad beats.', home_venue: 'Wynn', share_results: true },
  { id: 'u-priya', first_name: 'Priya', last_name: 'Shah', username: 'priya', bio: 'PLO when I can find it.', home_venue: 'Venetian', share_results: false },
  { id: 'u-hannah', first_name: 'Hannah', last_name: 'Brooks', username: 'hbrooks', bio: '', home_venue: 'Borgata', share_results: true },
  { id: 'u-ben', first_name: 'Ben', last_name: 'Adler', username: 'benadler', bio: '', home_venue: 'Resorts World', share_results: true },
  { id: 'u-luis', first_name: 'Luis', last_name: 'Ortega', username: 'lortega', bio: '', home_venue: 'Horseshoe Las Vegas', share_results: true },
  { id: 'u-nina', first_name: 'Nina', last_name: 'Park', username: 'ninap', bio: '', home_venue: 'Aria', share_results: true },
];

const EVENTS = [
  { name: 'Daily $150 Deepstack', venue: 'Borgata', buy: 150, field: 140 },
  { name: 'Borgata Fall Open $600 NLH', venue: 'Borgata', buy: 600, field: 1100 },
  { name: 'Wynn Signature $1,100', venue: 'Wynn', buy: 1100, field: 420 },
  { name: 'Venetian DeepStack $400', venue: 'Venetian', buy: 400, field: 600 },
  { name: 'Aria Daily $240', venue: 'Aria', buy: 240, field: 90 },
  { name: 'Seminole Showdown $1,700', venue: 'Seminole Hard Rock', buy: 1700, field: 1500 },
  { name: 'Commerce Monday $250', venue: 'Commerce Casino', buy: 250, field: 180 },
  { name: 'Horseshoe Monster Stack $1,500', venue: 'Horseshoe Las Vegas', buy: 1500, field: 5200 },
  { name: 'PLO Bounty $400', venue: 'Venetian', buy: 400, field: 160, game: 'PLO' },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function daysAgo(now, n) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - n);
  return d;
}

function makeResult(rand, ev) {
  const field = Math.round(ev.field * (0.8 + rand() * 0.5));
  const paid = Math.max(1, Math.round(field * 0.15));
  const r = rand();
  if (r > 0.19) return { place: null, winnings: 0, entries: field };
  // Cashed. Most cashes are small; a few go deep.
  const depth = rand();
  let place;
  let mult;
  if (depth < 0.62) {
    place = Math.round(paid * (0.55 + rand() * 0.45));
    mult = 1.4 + rand() * 1.2;
  } else if (depth < 0.9) {
    place = Math.max(10, Math.round(paid * (0.08 + rand() * 0.4)));
    mult = 3 + rand() * 5;
  } else {
    place = 1 + Math.floor(rand() * 9);
    mult = place === 1 ? 45 + rand() * 30 : 12 + rand() * 20 / place;
  }
  return { place, winnings: Math.round((ev.buy * mult) / 5) * 5, entries: field };
}

export function seedDatabase(now) {
  const rand = rng(20261114);
  const db = {
    stacktrackmaster: PLAYERS.map((p, i) => ({
      email: `${p.username}@example.com`,
      phone_number: '',
      datetime: daysAgo(now, 400 - i * 30).toISOString(),
      ...p,
    })),
    tournaments: [],
    journeys: [],
    journey_tournaments: [],
    friendships: [],
    activity_feed: [],
    activity_likes: [],
    activity_comments: [],
    notifications: [],
  };

  let tid = 0;
  const addTournaments = (userId, count, spanDays, bias = 0) => {
    for (let i = 0; i < count; i += 1) {
      const ev = EVENTS[Math.floor(rand() * EVENTS.length)];
      const ago = Math.floor((spanDays * (count - i)) / count + rand() * 4);
      const res = makeResult(rand, ev);
      if (bias && !res.winnings && rand() < bias) {
        res.place = Math.round(res.entries * 0.1);
        res.winnings = ev.buy * 2;
      }
      tid += 1;
      db.tournaments.push({
        id: `t-${tid}`,
        user_id: userId,
        tournament_name: ev.name,
        date: dayStr(daysAgo(now, ago)),
        location: ev.venue,
        buy_in: ev.buy,
        action_sold: ev.buy >= 1500 && rand() < 0.6 ? [20, 25, 40, 50][Math.floor(rand() * 4)] : 0,
        place: res.place,
        winnings: res.winnings,
        entries: res.entries,
        game_type: ev.game || 'NLH',
        notes: null,
        created_at: daysAgo(now, ago).toISOString(),
      });
    }
  };

  addTournaments('u-me', 74, 420, 0.04);
  // A couple of memorable scores for the demo player.
  db.tournaments.push(
    { id: 't-big1', user_id: 'u-me', tournament_name: 'WSOP Event #31 $1,500 NLH', date: dayStr(daysAgo(now, 140)), location: 'Horseshoe Las Vegas', buy_in: 1500, action_sold: 25, place: 14, winnings: 38420, entries: 2104, game_type: 'NLH', notes: 'Lost AK < QQ for a top-10 stack.', created_at: daysAgo(now, 140).toISOString() },
    { id: 't-big2', user_id: 'u-me', tournament_name: 'Borgata Fall Open $600 NLH', date: dayStr(daysAgo(now, 9)), location: 'Borgata', buy_in: 600, action_sold: 0, place: 3, winnings: 21750, entries: 1240, game_type: 'NLH', notes: null, created_at: daysAgo(now, 9).toISOString() },
    { id: 't-up1', user_id: 'u-me', tournament_name: 'Wynn Signature $1,100', date: dayStr(daysAgo(now, 1)), location: 'Wynn', buy_in: 1100, action_sold: 0, place: null, winnings: 0, entries: null, game_type: 'NLH', notes: null, created_at: daysAgo(now, 1).toISOString() },
  );
  addTournaments('u-maya', 40, 300, 0.05);
  addTournaments('u-dre', 22, 200);
  addTournaments('u-sofia', 31, 260, 0.02);
  addTournaments('u-tom', 55, 300);
  addTournaments('u-priya', 18, 200);
  addTournaments('u-hannah', 12, 120);

  // Friendships
  ['u-maya', 'u-dre', 'u-sofia', 'u-tom', 'u-priya'].forEach((f, i) => {
    db.friendships.push({ id: `f-${i}`, user_id: i % 2 ? 'u-me' : f, friend_id: i % 2 ? f : 'u-me', status: 'accepted', created_at: daysAgo(now, 200 - i * 20).toISOString() });
  });
  db.friendships.push(
    { id: 'f-maya-tom', user_id: 'u-maya', friend_id: 'u-tom', status: 'accepted', created_at: daysAgo(now, 90).toISOString() },
    { id: 'f-maya-nina', user_id: 'u-maya', friend_id: 'u-nina', status: 'accepted', created_at: daysAgo(now, 80).toISOString() },
    { id: 'f-tom-nina', user_id: 'u-tom', friend_id: 'u-nina', status: 'accepted', created_at: daysAgo(now, 70).toISOString() },
    { id: 'f-dre-luis', user_id: 'u-dre', friend_id: 'u-luis', status: 'accepted', created_at: daysAgo(now, 60).toISOString() },
    { id: 'f-req-in', user_id: 'u-hannah', friend_id: 'u-me', status: 'pending', created_at: daysAgo(now, 1).toISOString() },
    { id: 'f-req-out', user_id: 'u-me', friend_id: 'u-ben', status: 'pending', created_at: daysAgo(now, 3).toISOString() },
  );

  // Feed: recent tournaments become activities
  const recent = db.tournaments
    .filter((t) => ['u-me', 'u-maya', 'u-dre', 'u-sofia', 'u-tom', 'u-priya'].includes(t.user_id))
    .filter((t) => new Date(t.created_at) > daysAgo(now, 24))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  recent.forEach((t, i) => {
    const finished = t.place || t.winnings;
    const created = new Date(new Date(t.created_at).getTime() + (20 + (i % 5)) * 3600 * 1000);
    db.activity_feed.push({
      id: `a-${t.id}`,
      user_id: t.user_id,
      activity_type: finished ? 'tournament_finished' : 'tournament_added',
      tournament_id: t.id,
      metadata: {},
      created_at: (created > now ? new Date(now.getTime() - i * 3600 * 1000) : created).toISOString(),
    });
  });
  db.activity_feed.push({
    id: 'a-journey', user_id: 'u-maya', activity_type: 'journey_created', tournament_id: null,
    metadata: { journey_name: 'WSOP Paradise', events: 6 }, created_at: daysAgo(now, 2).toISOString(),
  });

  const big = db.activity_feed.find((a) => a.tournament_id === 't-big2');
  const comments = [
    ['u-maya', 'Third for $21k?! Absolute heater 🔥'],
    ['u-dre', 'Ship it. Drinks on you this weekend'],
    ['u-tom', 'What happened 3-handed?'],
    ['u-me', 'Flipped JJ vs AK for the chip lead and lost. Still happy with it'],
  ];
  if (big) {
    ['u-maya', 'u-dre', 'u-tom', 'u-sofia'].forEach((u, i) => db.activity_likes.push({ id: `l-big-${i}`, user_id: u, activity_id: big.id, created_at: daysAgo(now, 8).toISOString() }));
    comments.forEach(([u, c], i) => db.activity_comments.push({ id: `c-big-${i}`, user_id: u, activity_id: big.id, content: c, created_at: new Date(daysAgo(now, 8).getTime() + i * 1800 * 1000).toISOString() }));
  }
  db.activity_feed.forEach((a, i) => {
    if (a.id === big?.id) return;
    if (i % 3 === 0) db.activity_likes.push({ id: `l-${i}`, user_id: a.user_id === 'u-me' ? 'u-maya' : 'u-me', activity_id: a.id, created_at: a.created_at });
    if (i % 4 === 1) db.activity_comments.push({ id: `c-${i}`, user_id: a.user_id === 'u-tom' ? 'u-dre' : 'u-tom', activity_id: a.id, content: ['gl!', 'Nice one', 'Unlucky, next one', 'Running good 💪'][i % 4], created_at: a.created_at });
  });

  db.notifications.push(
    { id: 'n-1', user_id: 'u-me', actor_id: 'u-hannah', type: 'friend_request', activity_id: null, read_at: null, created_at: daysAgo(now, 1).toISOString() },
    { id: 'n-2', user_id: 'u-me', actor_id: 'u-tom', type: 'comment', activity_id: big && big.id, read_at: null, created_at: daysAgo(now, 8).toISOString() },
    { id: 'n-3', user_id: 'u-me', actor_id: 'u-maya', type: 'like', activity_id: big && big.id, read_at: null, created_at: daysAgo(now, 8).toISOString() },
    { id: 'n-4', user_id: 'u-me', actor_id: 'u-sofia', type: 'friend_accept', activity_id: null, read_at: daysAgo(now, 30).toISOString(), created_at: daysAgo(now, 30).toISOString() },
  );

  // Journeys: one finished summer series, one running now.
  const wsopStart = daysAgo(now, 150);
  db.journeys.push(
    { id: 'j-wsop', user_id: 'u-me', name: 'WSOP 2026', start_date: dayStr(wsopStart), end_date: dayStr(daysAgo(now, 128)), is_completed: true, total_buy_ins: 0, created_at: daysAgo(now, 170).toISOString() },
    { id: 'j-shr', user_id: 'u-me', name: 'Seminole Hard Rock Showdown', start_date: dayStr(daysAgo(now, 6)), end_date: dayStr(daysAgo(now, -9)), is_completed: false, total_buy_ins: 0, created_at: daysAgo(now, 20).toISOString() },
  );
  const wsopEvents = [
    ['Event #3 $1,000 Mystery Millions', 1000, 0, null, 0],
    ['Event #12 $1,500 Monster Stack', 1500, 25, null, 0],
    ['Event #18 $800 Deepstack', 800, 0, 211, 2140],
    ['Event #31 $1,500 NLH', 1500, 25, 14, 38420],
    ['Event #44 $3,000 6-Max', 3000, 50, null, 0],
    ['Event #52 $1,000 Super Seniors (railing Dad)', 0, 0, null, 0],
  ];
  wsopEvents.forEach(([name, buy, sold, place, win], i) => {
    db.journey_tournaments.push({ id: `jt-w${i}`, journey_id: 'j-wsop', tournament_name: name, date: dayStr(daysAgo(now, 150 - i * 4)), location: 'Horseshoe Las Vegas', buy_in: buy, action_sold: sold, notes: '', is_completed: true, place, winnings: win, tournament_id: null });
  });
  const shrEvents = [
    ['Event #1 $400 Kickoff', 400, -6, true, null, 0],
    ['Event #4 $600 Deepstack', 600, -4, true, 61, 1420],
    ['Event #7 $1,100 Bounty', 1100, -2, true, null, 0],
    ['Event #9 $250 Turbo', 250, 1, false],
    ['Event #11 $1,700 Main Event Day 1A', 1700, 3, false],
    ['Event #15 $600 PLO', 600, 5, false],
    ['Event #18 $2,200 High Roller', 2200, 7, false],
    ['Event #20 $400 Closer', 400, 9, false],
  ];
  shrEvents.forEach(([name, buy, offset, done, place, win], i) => {
    db.journey_tournaments.push({ id: `jt-s${i}`, journey_id: 'j-shr', tournament_name: name, date: dayStr(daysAgo(now, -offset)), location: 'Seminole Hard Rock', buy_in: buy, action_sold: buy >= 1700 ? 30 : 0, notes: buy >= 1700 ? '30% sold to Maya' : '', is_completed: !!done, place: place || null, winnings: win || 0, tournament_id: null });
  });
  db.journeys.forEach((j) => {
    j.total_buy_ins = db.journey_tournaments.filter((t) => t.journey_id === j.id).reduce((s, t) => s + t.buy_in, 0);
  });

  return db;
}
