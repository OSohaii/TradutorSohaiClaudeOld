import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateLegacyLocalStorage } from './store';

// Copy any pre-Phase-2a localStorage entries into the zustand-managed
// stores before React mounts, so hooks read the migrated values on
// first render.
migrateLegacyLocalStorage();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
