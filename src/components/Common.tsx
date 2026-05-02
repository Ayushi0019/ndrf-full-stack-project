import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { EmergencyAlert, OperationType, FirestoreErrorInfo } from '../types';

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
      let errorData: FirestoreErrorInfo | null = null;
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
                {errorData ? `Firestore ${errorData.operationType.toUpperCase()} Error` : 'Unexpected Application Error'}
              </p>
              <p className="text-red-600 text-sm font-mono break-all leading-relaxed">
                {errorData ? errorData.error : this.state.error?.message}
              </p>
            </div>

            {errorData && (
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Path</p>
                  <p className="text-xs font-bold text-gray-700">{errorData.path || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">User ID</p>
                  <p className="text-xs font-bold text-gray-700 truncate">{errorData.authInfo.userId || 'Not Authenticated'}</p>
                </div>
              </div>
            )}

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
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
  <div className="min-h-screen bg-orange-50 flex items-center justify-center">
    <div className="text-center">
      <div className="relative mb-8">
        <div className="w-20 h-20 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
        <ShieldAlert className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-orange-600" />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-2">NDRF Portal</h2>
      <p className="text-orange-900 font-medium animate-pulse">Initializing NDRF Systems...</p>
    </div>
  </div>
);

export const AlertTicker = () => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Get active incident zone
    const incidentsQ = query(collection(db, 'incidents'), where('status', '==', 'active'), orderBy('timestamp', 'desc'), limit(1));
    const unsubIncidents = onSnapshot(incidentsQ, (snapshot) => {
      if (!snapshot.empty) {
        setActiveZone(snapshot.docs[0].data().name);
      }
    }, (err) => {
      console.warn('Alert Ticker Incident Listen Error:', err);
    });

    // 2. Get alerts
    const q = query(
      collection(db, 'alerts'),
      where('active', '==', true),
      orderBy('timestamp', 'desc')
    );

    const unsubAlerts = onSnapshot(q, (snapshot) => {
      const alertData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyAlert));
      
      // Prioritize alerts from active zone
      const prioritized = [...alertData].sort((a, b) => {
        const aMatch = a.disasterZone === activeZone;
        const bMatch = b.disasterZone === activeZone;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
      
      setAlerts(prioritized);
    }, (err) => {
      console.warn('Alert Ticker Alert Listen Error:', err);
    });

    return () => {
      unsubIncidents();
      unsubAlerts();
    };
  }, [activeZone, isAuthenticated]);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-red-600 text-white py-2 px-4 overflow-hidden whitespace-nowrap relative z-[60]">
      <div className="animate-marquee inline-flex items-center gap-12">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="font-black uppercase tracking-wider text-xs">
              [{alert.severity}] {alert.title}: {alert.message} 
              {alert.disasterZone && <span className="text-white/70 ml-2">({alert.disasterZone} | {alert.affectedArea || 'Multiple Areas'})</span>}
            </span>
          </div>
        ))}
        {/* Duplicate for seamless loop */}
        {alerts.map((alert) => (
          <div key={`${alert.id}-dup`} className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="font-black uppercase tracking-wider text-xs">
              [{alert.severity}] {alert.title}: {alert.message}
              {alert.disasterZone && <span className="text-white/70 ml-2">({alert.disasterZone} | {alert.affectedArea || 'Multiple Areas'})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
