import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { TeamDirectoryContent } from './components/TeamDirectoryContent.mjs';
import { LegalLinksContent } from './components/LegalLinks/LegalLinksContent.mjs';

const legalLinksIsland = document.getElementById('legal-links-island');
if (legalLinksIsland) {
  ReactDOM.hydrateRoot(legalLinksIsland, <LegalLinksContent />, {
    onRecoverableError: error => console.error('Footer hydration failed:', error),
  });
}

const directoryIsland = document.getElementById('team-directory-island');
const directoryData = document.getElementById('team-directory-initial-data');
if (directoryIsland && directoryData) {
  try {
    const teams = JSON.parse(directoryData.textContent);
    ReactDOM.hydrateRoot(directoryIsland, <TeamDirectoryContent teams={teams} />, {
      onRecoverableError: error => console.error('Team directory hydration failed:', error),
    });
  } catch (error) {
    console.error('Could not hydrate team directory:', error);
    directoryIsland.remove();
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
