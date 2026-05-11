import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const appTree = (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  isTauriRuntime ? appTree : <React.StrictMode>{appTree}</React.StrictMode>,
);
