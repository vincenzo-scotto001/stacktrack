import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="home-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Track Your Poker Journey with StackTrack</h1>
          <p className="hero-subtitle">
            The ultimate tool for serious poker players to track tournaments, analyze performance, and improve their game.
          </p>
          <div className="hero-buttons">
            <Link to="/signup" className="btn primary-btn">Get Started</Link>
            <Link to="/signin" className="btn secondary-btn">Sign In</Link>
          </div>
        </div>
        {/* <div className="hero-image"> */}
          {/* Placeholder for hero image */}
          {/* <div className="poker-image-placeholder"></div> */}
        {/* </div> */}
      </section>

      <section className="features-section">
        <h2>Why Use StackTrack?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Track Your Results</h3>
            <p>Record every tournament, including buy-ins, winnings, and placements to see your progress over time.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Analyze Performance</h3>
            <p>Get detailed statistics on your ROI, ITM percentage, and more to identify strengths and weaknesses.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <h3>Manage Investments</h3>
            <p>Keep track of action sold and calculate your actual profits accounting for backers and stakes.</p>
          </div>
          <div className="feature-card">
          <div className="feature-icon">🏆</div>
            <h3>Tourney Journeys</h3>
            <p>Plan and track entire tournament series with our spreadsheet-like interface. Perfect for selling action!</p>
          </div>
        </div>
      </section>

      <section className="testimonials-section">
        <h2>What Players Are Saying</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <p>"StackTrack helped me identify leaks in my tournament game that I wasn't aware of. After three months of tracking, my ROI improved by 12%!"</p>
            <div className="testimonial-author">- Robert S., Poker Legend</div>
          </div>
          <div className="testimonial-card">
            <p>"I use StackTrack to manage my poker bankroll and track my tournament results. The stats feature is invaluable for my annual tax filing."</p>
            <div className="testimonial-author">- Steve B., Falcon CEO</div>
          </div>
          <div className="testimonial-card">
            <p>"As someone who sells action regularly, the 'action sold' feature is a game-changer. No more complicated spreadsheets!"</p>
            <div className="testimonial-author">- Vincenzo S., Terrible poker player</div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Level Up Your Poker Game?</h2>
        <p>Join thousands of players who trust StackTrack to keep their poker career on track.</p>
        <Link to="/signup" className="btn primary-btn large-btn">Create Free Account</Link>
      </section>

      <section className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>Is StackTrack free to use?</h3>
            <p>Yes! StackTrack is completely free to use with all features included. No hidden fees or premium tiers (yet).</p>
          </div>
          <div className="faq-item">
            <h3>Can I export my data?</h3>
            <p>Yes, you can easily download all of your data as a CSV file using our export feature.</p>
          </div>
          <div className="faq-item">
            <h3>Is my data secure?</h3>
            <p>Absolutely. We use Supabase for our database which implements industry-standard security practices.</p>
          </div>
          <div className="faq-item">
            <h3>Can I track cash games too?</h3>
            <p>Currently, StackTrack is focused on tournament play. However the "Add Tournament" feature works for cash games too!</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;