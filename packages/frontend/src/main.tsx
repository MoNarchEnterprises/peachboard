import React from 'react'; // Changed from { StrictMode }
import { createRoot } from 'react-dom/client';
import App from './App'; // Import the App component
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode> {/* Keep StrictMode */}
    <App /> {/* Render the App component which contains the Router */}
  </React.StrictMode>,
);
