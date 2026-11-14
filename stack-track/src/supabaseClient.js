import { createClient } from '@supabase/supabase-js';

// Demo mode runs the whole app against an in-memory database with sample
// players, so you can try the UI without touching real data:
//   REACT_APP_DEMO=true npm start
// The condition is written inline so webpack drops the demo code (and its
// sample data) from normal production builds.
export const isDemo = process.env.REACT_APP_DEMO === 'true';

export const supabase = process.env.REACT_APP_DEMO === 'true'
  // eslint-disable-next-line global-require
  ? require('./demo/demoClient').createDemoClient()
  : createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
