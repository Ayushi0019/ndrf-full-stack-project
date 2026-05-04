import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, XCircle } from 'lucide-react';
import { EmergencyAlert, OperationType, DataProcessingError } from '../types';
import { getMockDb } from '../lib/mockDb';

export const handleSystemError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: DataProcessingError = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'mock-user',
      email: 'mock@ndrf.gov.in',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('System Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export const formatTimestamp = (timestamp: any, type: 'date' | 'time' | 'full' = 'full') => {
  if (!timestamp) return 'N/A';
  
  let date: Date;
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return 'Invalid Date';

  switch (type) {
    case 'date': return date.toLocaleDateString();
    case 'time': return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'full': return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    default: return date.toLocaleString();
  }
};

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  props: { children: ReactNode };
  state: { hasError: boolean, error: Error | null } = { hasError: false, error: null };

  constructor(props: { children: ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorData: DataProcessingError | null = null;
      try {
        errorData = JSON.parse(this.state.error?.message || '');
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-10 border border-red-100">
            <div className="flex items-center gap-4 mb-6 text-red-600">
              <XCircle className="w-12 h-12" />
              <h1 className="text-3xl font-black tracking-tight">System Error</h1>
            </div>
            
            <div className="bg-red-50 p-6 rounded-2xl mb-8 border border-red-100">
              <p className="text-red-800 font-bold mb-2">
                {errorData ? `${errorData.operationType.toUpperCase()} Error` : 'Unexpected Application Error'}
              </p>
              <p className="text-red-600 text-sm font-mono break-all leading-relaxed">
                {errorData ? errorData.error : this.state.error?.message}
              </p>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-slate-200"
            >
              Restart NDRF Portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <div className="relative mb-8">
        <div className="w-20 h-20 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        <ShieldAlert className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600" />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-2">NDRF Portal</h2>
      <p className="text-slate-900 font-medium animate-pulse uppercase tracking-[0.2em] text-[10px] font-black">Initializing Mission Control...</p>
    </div>
  </div>
);

export const AlertTicker = () => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

  useEffect(() => {
    const fetchAlerts = () => {
      const db = getMockDb();
      setAlerts(db.alerts.filter(a => a.active));
    };
    
    fetchAlerts();
    window.addEventListener('mock-db-update', fetchAlerts);
    return () => window.removeEventListener('mock-db-update', fetchAlerts);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-red-600 text-white py-2 px-4 overflow-hidden whitespace-nowrap relative z-[60]">
      <div className="animate-marquee inline-flex items-center gap-12">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="font-black uppercase tracking-wider text-xs">
              [{alert.severity}] {alert.title}: {alert.message} 
              {alert.disasterZone && <span className="text-white/70 ml-2">({alert.disasterZone})</span>}
            </span>
          </div>
        ))}
        {/* Duplicate for seamless loop */}
        {alerts.map((alert) => (
          <div key={`${alert.id}-dup`} className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="font-black uppercase tracking-wider text-xs">
              [{alert.severity}] {alert.title}: {alert.message}
              {alert.disasterZone && <span className="text-white/70 ml-2">({alert.disasterZone})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
