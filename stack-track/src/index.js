// Update your index.js file to register the service worker

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker for PWA functionality
serviceWorkerRegistration.register({
  onUpdate: registration => {
    // Show a notification to the user when a new version is available
    const updateNotification = document.createElement('div');
    updateNotification.className = 'update-notification';
    updateNotification.innerHTML = `
      <div class="update-message">
        <p>A new version of StackTrack is available!</p>
        <button id="update-button">Update Now</button>
      </div>
    `;
    document.body.appendChild(updateNotification);

    // Add click handler for the update button
    document.getElementById('update-button').addEventListener('click', () => {
      if (registration && registration.waiting) {
        // Send a message to the waiting service worker
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Reload the page to activate the new version
      window.location.reload();
    });
  }
});