import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App';
import './index.css';

if (Capacitor.isNativePlatform()) {
  StatusBar.setBackgroundColor({ color: '#52796f' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
} else if ('serviceWorker' in navigator) {
  // Register the PWA service worker only on the web build (not inside Capacitor).
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
