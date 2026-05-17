import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ActivationGate } from '@chamber-19/desktop-toolkit/activation';
import App from './App';
import './styles/globals.css';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const appTree = (
  <ActivationGate>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </ActivationGate>
);

if (isTauriRuntime && typeof window !== 'undefined') {
  // Always reset to a sane baseline so prior zoom state cannot shrink the UI.
  document.documentElement.style.zoom = '1';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  isTauriRuntime ? appTree : <React.StrictMode>{appTree}</React.StrictMode>,
);
