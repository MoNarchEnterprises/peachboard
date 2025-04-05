import React from 'react'; // Changed from { StrictMode }
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Import AuthProvider
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode> {/* Keep StrictMode */}
    <AuthProvider>
      <App /> {/* App now has access to AuthContext */}
    </AuthProvider>
  </React.StrictMode>,
);
