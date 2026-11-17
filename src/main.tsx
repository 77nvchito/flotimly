import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/Toast';
import App from './App';
import { ConsentBanner } from './components/ConsentBanner';
import './styles.css';
import { initAnalytics } from './lib/analytics';

initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
          <ConsentBanner />
        </BrowserRouter>
      </ToastProvider>
    </StoreProvider>
  </React.StrictMode>,
);
