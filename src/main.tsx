import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/globals.css';
import { AutoUpdaterProvider } from './hooks/use-auto-updater';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AutoUpdaterProvider>
        <App />
      </AutoUpdaterProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
