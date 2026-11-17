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

// Si un archivo de la app no carga (por ejemplo, justo después de publicar una versión nueva), recarga una vez.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const key = 'flotimly.reloaded-at';
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 60_000) return; // evita recargas en bucle
    sessionStorage.setItem(key, String(Date.now()));
    e.preventDefault();
    window.location.reload();
  } catch {
    /* sin almacenamiento: no se recarga */
  }
});

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
