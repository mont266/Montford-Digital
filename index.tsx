import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

// If static deploy rewrites /api/emails/preview to /index.html, redirect to HashRouter email-preview route
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/api/emails/preview')) {
  const search = window.location.search || '';
  window.location.replace(`${window.location.origin}/#/email-preview${search}`);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

// A small change to trigger a new build.
