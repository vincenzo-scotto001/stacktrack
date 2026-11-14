import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted Archivo (weight + width axes) so the font works offline in the PWA.
import '@fontsource-variable/archivo/standard.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Offline support. When a new version is deployed, the app shows a toast
// with a Reload button (see UIContext).
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    window.dispatchEvent(new CustomEvent('stacktrack:update', { detail: registration }));
  },
});
