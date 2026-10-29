import React, { Component, ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: '#F9FAFB', backgroundColor: '#4C1D95', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#4C1D95', fontSize: '24px', marginBottom: '16px' }}>VPN Restaurant - Application Error</h1>
          <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>An error occurred while loading the page:</p>
          <pre style={{ backgroundColor: '#4C1D95', padding: '16px', borderRadius: '12px', color: '#4C1D95', overflowX: 'auto', fontSize: '13px' }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: '#4C1D95', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Clear Cache & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)


