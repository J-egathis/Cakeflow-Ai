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
    const errMsg = String(error?.message || error || '').toLowerCase();
    // Auto-recover silently if a stale chunk / module cache error occurs after deployment
    if (
      errMsg.includes('dynamically imported module') ||
      errMsg.includes('loading chunk') ||
      errMsg.includes('importing a module script failed') ||
      errMsg.includes('mime type')
    ) {
      const reloadedKey = 'cakeflow_chunk_auto_reload';
      if (!sessionStorage.getItem(reloadedKey)) {
        sessionStorage.setItem(reloadedKey, '1');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', backgroundColor: '#F9FAFB', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '24px', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}>
            <h1 style={{ color: '#4C1D95', fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>VPN Restaurant</h1>
            <p style={{ color: '#4B5563', fontSize: '13px', marginBottom: '16px' }}>Refreshing page data...</p>
            <pre style={{ backgroundColor: '#F3F4F6', padding: '12px', borderRadius: '12px', color: '#111827', overflowX: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => {
                sessionStorage.removeItem('cakeflow_chunk_auto_reload');
                window.location.reload();
              }}
              style={{ marginTop: '20px', width: '100%', padding: '12px 24px', backgroundColor: '#4C1D95', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}
            >
              Reload Page
            </button>
          </div>
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
