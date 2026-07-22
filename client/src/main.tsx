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
        <div style={{ padding: '40px', color: '#f8fafc', backgroundColor: '#020617', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#f43f5e', fontSize: '24px', marginBottom: '16px' }}>CakeFlow AI - Application Error</h1>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>An error occurred while loading the page:</p>
          <pre style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', color: '#fb7185', overflowX: 'auto', fontSize: '13px' }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: '#f43f5e', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
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

