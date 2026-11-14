// In-memory stand-in for the Supabase client, used only when REACT_APP_DEMO=true.
// It implements the subset of the query builder StackTrack uses, over seeded
// sample data, so every screen can be explored without a backend.

import { seedDatabase, DEMO_USER } from './seed';

let idCounter = 1000;
const newId = (prefix = 'id') => `${prefix}-${(idCounter += 1).toString(36)}`;
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function likeToRegex(pattern) {
  const body = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${body}$`, 'i');
}

function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function compare(op, actual, raw) {
  switch (op) {
    case 'eq': return String(actual) === String(raw);
    case 'neq': return String(actual) !== String(raw);
    case 'is': return raw === 'null' ? actual == null : String(actual) === raw;
    case 'ilike': return likeToRegex(raw).test(actual || '');
    case 'in': return raw.replace(/^\(|\)$/g, '').split(',').includes(String(actual));
    case 'gte': return actual >= raw;
    case 'lte': return actual <= raw;
    case 'lt': return actual < raw;
    case 'gt': return actual > raw;
    default: return true;
  }
}

function parseCondition(expr) {
  const s = expr.trim();
  if (s.startsWith('and(') && s.endsWith(')')) {
    const subs = splitTopLevel(s.slice(4, -1)).map(parseCondition);
    return (row) => subs.every((f) => f(row));
  }
  if (s.startsWith('or(') && s.endsWith(')')) {
    const subs = splitTopLevel(s.slice(3, -1)).map(parseCondition);
    return (row) => subs.some((f) => f(row));
  }
  const [col, op, ...rest] = s.split('.');
  const raw = rest.join('.');
  return (row) => compare(op, row[col], raw);
}

const UNIQUE = {
  stacktrackmaster: [['id'], ['username']],
  activity_likes: [['user_id', 'activity_id']],
};

const TRIGGERS = {
  activity_likes: (db, row) => {
    const act = db.activity_feed.find((a) => a.id === row.activity_id);
    if (act && act.user_id !== row.user_id) {
      db.notifications.push({ id: newId('n'), user_id: act.user_id, actor_id: row.user_id, type: 'like', activity_id: act.id, read_at: null, created_at: new Date().toISOString() });
    }
  },
  activity_comments: (db, row) => {
    const act = db.activity_feed.find((a) => a.id === row.activity_id);
    if (act && act.user_id !== row.user_id) {
      db.notifications.push({ id: newId('n'), user_id: act.user_id, actor_id: row.user_id, type: 'comment', activity_id: act.id, read_at: null, created_at: new Date().toISOString() });
    }
  },
};

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.orders = [];
    this.limitN = null;
    this.rangeAB = null;
    this.mode = null;
    this.payload = null;
    this.returning = false;
    this.countOpt = null;
    this.head = false;
    this.conflict = 'id';
  }

  select(_cols, opts = {}) {
    if (this.op === 'select') {
      this.countOpt = opts.count || null;
      this.head = !!opts.head;
    } else this.returning = true;
    return this;
  }

  insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }

  upsert(rows, opts = {}) {
    this.op = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = opts.onConflict || 'id';
    return this;
  }

  update(patch) { this.op = 'update'; this.payload = patch; return this; }

  delete() { this.op = 'delete'; return this; }

  eq(c, v) { this.filters.push((r) => compare('eq', r[c], v)); return this; }

  neq(c, v) { this.filters.push((r) => compare('neq', r[c], v)); return this; }

  is(c, v) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }

  in(c, arr) { const set = new Set((arr || []).map(String)); this.filters.push((r) => set.has(String(r[c]))); return this; }

  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }

  lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }

  lt(c, v) { this.filters.push((r) => r[c] < v); return this; }

  gt(c, v) { this.filters.push((r) => r[c] > v); return this; }

  ilike(c, p) { const re = likeToRegex(p); this.filters.push((r) => re.test(r[c] || '')); return this; }

  not(c, op, v) {
    const raw = v === null ? 'null' : String(v);
    this.filters.push((r) => !compare(op, r[c], raw));
    return this;
  }

  or(expr) {
    const subs = splitTopLevel(expr).map(parseCondition);
    this.filters.push((r) => subs.some((f) => f(r)));
    return this;
  }

  order(c, { ascending = true } = {}) { this.orders.push([c, ascending]); return this; }

  limit(n) { this.limitN = n; return this; }

  range(a, b) { this.rangeAB = [a, b]; return this; }

  single() { this.mode = 'single'; return this; }

  maybeSingle() { this.mode = 'maybe'; return this; }

  then(resolve, reject) {
    return new Promise((r) => setTimeout(r, 60)).then(() => this.exec()).then(resolve, reject);
  }

  rows() {
    const table = this.db[this.table];
    if (!table) return null;
    return table.filter((r) => this.filters.every((f) => f(r)));
  }

  finish(data) {
    if (this.mode === 'single') {
      if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
      return { data: data[0], error: null };
    }
    if (this.mode === 'maybe') {
      if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'Multiple rows' } };
      return { data: data[0] || null, error: null };
    }
    return { data, error: null };
  }

  violates(row, self = null) {
    const keys = UNIQUE[this.table] || [];
    const table = this.db[this.table];
    return keys.some((cols) => cols.every((c) => row[c] != null)
      && table.some((r) => r !== self && cols.every((c) => String(r[c]).toLowerCase() === String(row[c]).toLowerCase())));
  }

  exec() {
    const table = this.db[this.table];
    if (!table) return { data: null, error: { code: '42P01', message: `relation "${this.table}" does not exist` } };

    if (this.op === 'select') {
      let rows = this.rows();
      for (const [c, asc] of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          if (a[c] === b[c]) return 0;
          if (a[c] == null) return 1;
          if (b[c] == null) return -1;
          return (a[c] < b[c] ? -1 : 1) * (asc ? 1 : -1);
        });
      }
      const count = rows.length;
      if (this.rangeAB) rows = rows.slice(this.rangeAB[0], this.rangeAB[1] + 1);
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      if (this.head) return { data: null, count, error: null };
      return { ...this.finish(clone(rows)), count: this.countOpt ? count : null };
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const out = [];
      for (const input of this.payload) {
        if (this.op === 'upsert') {
          const existing = table.find((r) => String(r[this.conflict]) === String(input[this.conflict]));
          if (existing) {
            Object.assign(existing, input);
            out.push(existing);
            continue;
          }
        }
        const row = { id: newId(this.table.slice(0, 2)), created_at: new Date().toISOString(), ...input };
        if (this.violates(row)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        table.push(row);
        if (TRIGGERS[this.table]) TRIGGERS[this.table](this.db, row);
        out.push(row);
      }
      return this.returning ? this.finish(clone(out)) : { data: null, error: null };
    }

    if (this.op === 'update') {
      const rows = this.rows();
      for (const r of rows) {
        const next = { ...r, ...this.payload };
        if (this.violates(next, r)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        Object.assign(r, this.payload);
      }
      return this.returning ? this.finish(clone(rows)) : { data: null, error: null };
    }

    if (this.op === 'delete') {
      const rows = this.rows();
      this.db[this.table] = table.filter((r) => !rows.includes(r));
      return { data: this.returning ? clone(rows) : null, error: null };
    }

    return { data: null, error: null };
  }
}

const SESSION_KEY = 'stacktrack-demo-session';

export function createDemoClient() {
  const db = seedDatabase(new Date());
  const listeners = new Set();
  let session = null;
  try {
    session = JSON.parse(window.localStorage.getItem(SESSION_KEY));
  } catch (e) {
    session = null;
  }

  const emit = (event) => listeners.forEach((cb) => cb(event, session));
  const signIn = () => {
    session = {
      access_token: 'demo',
      user: { id: DEMO_USER.id, email: DEMO_USER.email, user_metadata: { first_name: DEMO_USER.first_name, last_name: DEMO_USER.last_name } },
    };
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
    emit('SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  };

  return {
    from: (table) => new Query(db, table),
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }),
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session ? session.user : null }, error: null }),
      onAuthStateChange(cb) {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword: async () => signIn(),
      signUp: async () => signIn(),
      signOut: async () => {
        session = null;
        try { window.localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
        emit('SIGNED_OUT');
        return { error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user: session && session.user }, error: null }),
    },
  };
}
