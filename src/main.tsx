import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from './config/theme';
import App from './App.tsx';
import './index.css';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
