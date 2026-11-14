import React from 'react';
import { Link } from 'react-router-dom';
import { NotebookPen, ChartNoAxesCombined, Route as RouteIcon, Users } from 'lucide-react';
import Logo from '../components/layout/Logo';
import ChipEdge from '../components/ui/ChipEdge';

// The hero shows the product doing its one job: an honest running total.
const LAST_20 = ['played', 'played', 'cash', 'played', 'played', 'played', 'cash', 'played', 'cash', 'played',
  'played', 'played', 'played', 'cash', 'played', 'played', 'cash', 'played', 'played', 'cash'];

const RECENT = [
  { name: 'Borgata Fall Open $600', meta: '3rd of 1,240', value: '+$21,150', tone: 'gain' },
  { name: 'Wynn Signature $1,100', meta: 'Busted', value: '−$1,100', tone: 'loss' },
  { name: 'Venetian DeepStack $400', meta: '58th of 612', value: '+$660', tone: 'gain' },
];

const FEATURES = [
  {
    icon: NotebookPen,
    title: 'Log it in under a minute',
    body: 'Buy-in, finish, field size, payout and any action you sold. Fix a typo later instead of living with it. Import your old spreadsheet in one go.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'See the real number',
    body: 'A bankroll graph, ROI and ITM after backers are paid, plus your biggest scores, longest downswing and results by venue and buy-in level.',
  },
  {
    icon: RouteIcon,
    title: 'Plan the whole series',
    body: 'Map out a festival before you fly out, copy the schedule for your backers, and mark each event as you play it.',
  },
  {
    icon: Users,
    title: 'Sweat it with friends',
    body: 'Follow friends’ results, react to deep runs and see who is running hottest this month on the leaderboard.',
  },
];

const FAQ = [
  ['Is StackTrack free?', 'Yes. Every feature is free.'],
  ['How is action sold handled?', 'Tell us the percentage you sold and StackTrack counts only your share of the buy-in and the payout, so your ROI is yours alone.'],
  ['Who can see my results?', 'Only players you accept as friends. You can hide your results from friends entirely in Settings.'],
  ['Can I bring my old data?', 'Yes. Import a CSV from any spreadsheet, and export everything whenever you like.'],
  ['Does it work on my phone?', 'Yes. Add it to your home screen and it opens like an app, even with spotty casino Wi-Fi.'],
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className="row">
          <Link to="/signin" className="btn btn-text">Sign in</Link>
          <Link to="/signup" className="btn btn-primary btn-sm hide-mobile">Create account</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">Know if you’re actually winning.</h1>
          <p className="hero-lede">
            StackTrack keeps every tournament you play, from the buy-in and the action you sold to the cash,
            and turns it into a running total you can trust. Your friends can follow along.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn btn-primary btn-lg">Create free account</Link>
            <Link to="/signin" className="btn btn-ghost btn-lg">Sign in</Link>
          </div>
        </div>

        <figure className="hero-card" aria-label="Example StackTrack summary">
          <div className="hero-card-top">
            <span className="muted">Net this year</span>
            <span className="tag tag-gain">ROI 41.2%</span>
          </div>
          <div className="hero-total num">+$24,310</div>
          <svg className="hero-graph" viewBox="0 0 320 90" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0 70 L16 74 L32 72 L48 78 L64 66 L80 70 L96 72 L112 60 L128 64 L144 67 L160 52 L176 56 L192 60 L208 58 L224 30 L240 34 L256 38 L272 33 L288 36 L304 12 L320 14"
              fill="none"
              stroke="var(--orange)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="hero-edge">
            <ChipEdge segments={LAST_20} label="Last 20 tournaments: 6 cashes" />
            <div className="hero-edge-legend">
              <span>Last 20 tournaments</span>
              <span><i className="lg-cash" /> Cash <i className="lg-played" /> Bust</span>
            </div>
          </div>
          <ul className="hero-recent">
            {RECENT.map((r) => (
              <li key={r.name}>
                <span className="grow">
                  <strong className="truncate">{r.name}</strong>
                  <small>{r.meta}</small>
                </span>
                <span className={`num ${r.tone}`}>{r.value}</span>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <section className="features" aria-labelledby="features-title">
        <h2 id="features-title" className="sr-only">What StackTrack does</h2>
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="feature">
            <Icon size={22} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions</h2>
        <dl>
          {FAQ.map(([q, a]) => (
            <div key={q} className="faq-item">
              <dt>{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="landing-cta">
        <h2>Your next session starts the count.</h2>
        <Link to="/signup" className="btn btn-primary btn-lg">Create free account</Link>
      </section>

      <footer className="landing-footer">
        <Logo />
        <span className="faint">© {new Date().getFullYear()} StackTrack</span>
      </footer>
    </div>
  );
}
