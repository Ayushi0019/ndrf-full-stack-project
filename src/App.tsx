/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  Link 
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Package, 
  Truck, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MapPin, 
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Users,
  MessageSquare,
  Send,
  UserPlus,
  Activity,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
let DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

import { auth, db } from './firebase';
import { cn } from './lib/utils';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'field_member' | 'hq_admin';
  createdAt: any;
}

interface AffectedLocation {
  id: string;
  name: string;
  parentLocation?: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved';
  timestamp: any;
}

interface Resource {
  id: string;
  name: string;
  type: 'medical' | 'food' | 'personnel' | 'equipment' | 'water';
  totalQuantity: number;
  availableQuantity: number;
}

interface ResourceRequest {
  id: string;
  locationId: string;
  resourceType: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  requestedBy: string;
  timestamp: any;
}

interface Transfer {
  id: string;
  resourceType: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  status: 'preparing' | 'in-transit' | 'delivered';
  timestamp: any;
}

interface Message {
  id: string;
  locationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
}

interface Volunteer {
  id: string;
  name: string;
  locationId: string;
  skills: string[];
  status: 'active' | 'on-break' | 'off-duty';
  contact: string;
}

// --- Error Handling ---

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const MapView = ({ locations, selectedId, onSelect }: { locations: AffectedLocation[], selectedId?: string, onSelect: (id: string) => void }) => {
  const center: [number, number] = [30.3165, 78.0322]; // Dehradun center

  const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      if (center) map.setView(center, 10);
    }, [center]);
    return null;
  };

  const selectedLocation = locations.find(l => l.id === selectedId);
  const mapCenter: [number, number] = selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : center;

  return (
    <div className="h-full w-full rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative z-0">
      <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={mapCenter} />
        {locations.map((loc) => (
          <Marker 
            key={loc.id} 
            position={[loc.lat, loc.lng]}
            eventHandlers={{
              click: () => onSelect(loc.id),
            }}
          >
            <Popup>
              <div className="p-2">
                <h4 className="font-bold text-gray-900">{loc.name}</h4>
                <p className="text-xs text-gray-500 mb-2">{loc.parentLocation || 'Main Region'}</p>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  loc.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  loc.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                  loc.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {loc.severity}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

const CommandChat = ({ locationId, user }: { locationId: string, user: UserProfile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'messages'), 
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(allMsgs.filter(m => m.locationId === locationId));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));
    return unsub;
  }, [locationId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        locationId,
        senderId: user.uid,
        senderName: user.name,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="bg-gray-900 rounded-3xl border border-gray-800 flex flex-col h-[500px] overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <h3 className="text-sm font-bold text-gray-100 uppercase tracking-widest">Secure Command Channel</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex flex-col max-w-[80%]",
            msg.senderId === user.uid ? "ml-auto items-end" : "items-start"
          )}>
            <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">{msg.senderName}</span>
            <div className={cn(
              "px-4 py-2 rounded-2xl text-sm",
              msg.senderId === user.uid 
                ? "bg-orange-600 text-white rounded-tr-none" 
                : "bg-gray-800 text-gray-100 rounded-tl-none"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="p-4 bg-gray-950 border-t border-gray-800 flex gap-2">
        <input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type command..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none"
        />
        <button type="submit" className="p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

const AlertTicker = () => {
  const alerts = [
    "RED ALERT: Water levels rising in Hooghly River.",
    "HQ UPDATE: 500 additional personnel dispatched to WB coast.",
    "WEATHER: Heavy rainfall predicted for next 48 hours.",
    "LOGISTICS: Medical supplies reached Kolkata transit point."
  ];

  return (
    <div className="bg-orange-600 text-white py-2 overflow-hidden whitespace-nowrap relative">
      <div className="flex animate-marquee">
        {[...alerts, ...alerts].map((alert, i) => (
          <span key={i} className="mx-8 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3" /> {alert}
          </span>
        ))}
      </div>
    </div>
  );
};

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        try {
          const info = JSON.parse(event.error.message) as FirestoreErrorInfo;
          setErrorMsg(`Database error (${info.operationType} at ${info.path}): ${info.error}`);
        } catch {
          setErrorMsg(event.error.message);
        }
      } else {
        setErrorMsg(event.error?.message || 'An unexpected error occurred');
      }
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Refresh Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-orange-50">
    <div className="text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
      />
      <p className="text-orange-900 font-medium animate-pulse">Initializing NDRF Systems...</p>
    </div>
  </div>
);

const Navbar = ({ user }: { user: UserProfile }) => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const toggleRole = async () => {
    const newRole = user.role === 'hq_admin' ? 'field_member' : 'hq_admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
          <ShieldAlert className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">NDRF</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Resource Management</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <button 
          onClick={toggleRole}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all border border-gray-200"
        >
          <Zap className="w-3 h-3 text-orange-600" />
          Switch to {user.role === 'hq_admin' ? 'Field' : 'HQ'}
        </button>

        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-semibold text-gray-900">{user.name}</span>
          <span className="text-xs text-orange-600 font-bold uppercase tracking-tighter">
            {user.role.replace('_', ' ')}
          </span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

// --- Pages ---

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // Default role is field_member unless it's the admin email
        const role = user.email === 'ayushikhatri994@gmail.com' ? 'hq_admin' : 'field_member';
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || 'NDRF Member',
          email: user.email || '',
          role,
          createdAt: serverTimestamp()
        });
      }
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-orange-600 p-12 text-center">
          <ShieldAlert className="w-20 h-20 text-white mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">NDRF Portal</h2>
          <p className="text-orange-100">National Disaster Response Force</p>
        </div>
        <div className="p-10">
          <p className="text-gray-600 text-center mb-8">
            Access the resource coordination system for disaster response operations.
          </p>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const FieldDashboard = ({ user }: { user: UserProfile }) => {
  const [affectedLocations, setAffectedLocations] = useState<AffectedLocation[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const qLocations = query(collection(db, 'affectedLocations'), orderBy('timestamp', 'desc'));
    const unsubLocations = onSnapshot(qLocations, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AffectedLocation));
      setAffectedLocations(docs);
      if (docs.length > 0 && !selectedLocationId) setSelectedLocationId(docs[0].id);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'affectedLocations'));

    const qRequests = query(collection(db, 'requests'), orderBy('timestamp', 'desc'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceRequest)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'requests'));

    const unsubVolunteers = onSnapshot(collection(db, 'volunteers'), (snapshot) => {
      setVolunteers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
    });

    return () => {
      unsubLocations();
      unsubRequests();
      unsubVolunteers();
    };
  }, []);

  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      locationId: formData.get('locationId') as string,
      resourceType: formData.get('resourceType') as string,
      quantity: Number(formData.get('quantity')),
      status: 'pending',
      requestedBy: user.uid,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'requests'), data);
      setIsRequestModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'requests');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      parentLocation: formData.get('parentLocation') as string,
      lat: Number(formData.get('lat')),
      lng: Number(formData.get('lng')),
      severity: formData.get('severity') as string,
      status: 'active',
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'affectedLocations'), data);
      setIsLocationModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'affectedLocations');
    }
  };

  const filteredLocations = useMemo(() => {
    return affectedLocations.filter(l => 
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.parentLocation?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [affectedLocations, searchTerm]);

  const groupedLocations = useMemo(() => {
    const groups: Record<string, AffectedLocation[]> = {};
    filteredLocations.forEach(loc => {
      const parent = loc.parentLocation || 'Other Regions';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(loc);
    });
    // Sort groups so 'Other Regions' is at the bottom, or alphabetically
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => {
        if (a === 'Other Regions') return 1;
        if (b === 'Other Regions') return -1;
        return a.localeCompare(b);
      })
    );
  }, [filteredLocations]);

  const activeLocation = affectedLocations.find(l => l.id === selectedLocationId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Field Operations</h2>
          <p className="text-gray-500">Monitor affected locations and coordinate resource requirements.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <MapPin className="w-5 h-5 text-orange-600" />
            Report New Spot
          </button>
          <button 
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
          >
            <Plus className="w-5 h-5" />
            Request Resources
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Affected Location Selection Sidebar */}
        <div className="space-y-6">
          <div className="px-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Active Spots</h3>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search areas (e.g. Dehradun)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
              <LayoutDashboard className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2 scrollbar-hide">
            {(Object.entries(groupedLocations) as [string, AffectedLocation[]][]).map(([parent, locations]) => (
              <div key={parent} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-orange-600 rounded-full" />
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{parent}</h4>
                </div>
                <div className="space-y-2">
                  {locations.filter(l => l.status === 'active').map(location => (
                    <button
                      key={location.id}
                      onClick={() => setSelectedLocationId(location.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all",
                        selectedLocationId === location.id 
                          ? "bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100" 
                          : "bg-white border-gray-100 text-gray-900 hover:border-orange-200"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-80">{location.severity}</span>
                        <MapPin className="w-3 h-3 opacity-50" />
                      </div>
                      <p className="font-bold text-sm truncate">{location.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {activeLocation ? (
            <>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{activeLocation.name}</h3>
                    <p className="text-gray-500 flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> Active Sector
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="text-orange-600 w-5 h-5 animate-pulse" />
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">Live Monitoring</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Volunteers On-Site</p>
                    <p className="text-2xl font-black text-gray-900">
                      {volunteers.filter(v => v.locationId === activeLocation.id && v.status === 'active').length}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Resource Requests</p>
                    <p className="text-2xl font-black text-gray-900">
                      {requests.filter(r => r.locationId === activeLocation.id).length}
                    </p>
                  </div>
                </div>

                <CommandChat locationId={activeLocation.id} user={user} />
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center text-gray-400">
              <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select an affected location to begin command operations.</p>
            </div>
          )}
        </div>

        {/* Right Sidebar: My Requests & Volunteers */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">My Requests</h3>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase">
                {activeLocation?.name || 'Global'}
              </span>
            </div>
            <div className="space-y-3">
              {requests
                .filter(r => r.requestedBy === user.uid && (!selectedLocationId || r.locationId === selectedLocationId))
                .slice(0, 5)
                .map(request => {
                  const reqLocation = affectedLocations.find(l => l.id === request.locationId);
                  return (
                    <div key={request.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="font-bold text-gray-900 capitalize text-sm">{request.resourceType}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2 h-2 text-gray-400" />
                          <p className="text-[10px] text-gray-400 truncate max-w-[80px]">{reqLocation?.name || 'Unknown'}</p>
                          <span className="text-[10px] text-gray-300 mx-1">•</span>
                          <p className="text-[10px] text-gray-400">Qty: {request.quantity}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        request.status === 'approved' ? "bg-green-100 text-green-700" :
                        request.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {request.status}
                      </div>
                    </div>
                  );
                })}
              {requests.filter(r => r.requestedBy === user.uid && (!selectedLocationId || r.locationId === selectedLocationId)).length === 0 && (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-100 text-center">
                  <p className="text-xs text-gray-400">No requests for this location yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">Volunteers</h3>
            <div className="space-y-3">
              {volunteers.filter(v => v.locationId === selectedLocationId).map(v => (
                <div key={v.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                    {v.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{v.name}</p>
                    <p className="text-[10px] text-green-600 font-bold uppercase">{v.status}</p>
                  </div>
                </div>
              ))}
              {volunteers.filter(v => v.locationId === selectedLocationId).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No volunteers registered yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Location Modal */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-orange-600 p-6 text-white">
                <h3 className="text-xl font-bold">Report Affected Spot</h3>
                <p className="text-orange-100 text-sm">Add a new location to the disaster map.</p>
              </div>
              <form onSubmit={handleCreateLocation} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Spot Name</label>
                    <input 
                      name="name" 
                      required 
                      placeholder="e.g. Rajpur Road Sector 4"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Parent City/Region</label>
                    <input 
                      name="parentLocation" 
                      required 
                      placeholder="e.g. Dehradun"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Latitude</label>
                    <input 
                      name="lat" 
                      type="number" 
                      step="any" 
                      required 
                      placeholder="30.3165"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Longitude</label>
                    <input 
                      name="lng" 
                      type="number" 
                      step="any" 
                      required 
                      placeholder="78.0322"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Severity Level</label>
                    <select 
                      name="severity" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                  >
                    Add to Map
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Modal */}
      <AnimatePresence>
        {isRequestModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-orange-600 p-6 text-white">
                <h3 className="text-xl font-bold">New Resource Request</h3>
                <p className="text-orange-100 text-sm">Specify the needs for your current location.</p>
              </div>
              <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Affected Location</label>
                  <select name="locationId" required className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    {affectedLocations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Resource Type</label>
                  <select name="resourceType" required className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="medical">Medical Supplies</option>
                    <option value="food">Food & Rations</option>
                    <option value="personnel">Personnel / Manpower</option>
                    <option value="equipment">Heavy Equipment</option>
                    <option value="water">Drinking Water</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Quantity Needed</label>
                  <input name="quantity" type="number" required min="1" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsRequestModalOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 transition-all"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HQDashboard = ({ user }: { user: UserProfile }) => {
  const [affectedLocations, setAffectedLocations] = useState<AffectedLocation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    const unsubLocations = onSnapshot(collection(db, 'affectedLocations'), (snapshot) => {
      setAffectedLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AffectedLocation)));
    });
    const unsubResources = onSnapshot(collection(db, 'resources'), (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
    });
    const unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceRequest)));
    });
    const unsubTransfers = onSnapshot(collection(db, 'transfers'), (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transfer)));
    });
    const unsubVolunteers = onSnapshot(collection(db, 'volunteers'), (snapshot) => {
      setVolunteers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
    });

    return () => {
      unsubLocations();
      unsubResources();
      unsubRequests();
      unsubTransfers();
      unsubVolunteers();
    };
  }, []);

  const handleApproveRequest = async (request: ResourceRequest) => {
    try {
      await updateDoc(doc(db, 'requests', request.id), { status: 'approved' });
      // Create a transfer record
      const location = affectedLocations.find(l => l.id === request.locationId);
      await addDoc(collection(db, 'transfers'), {
        resourceType: request.resourceType,
        quantity: request.quantity,
        fromLocation: 'HQ Central Warehouse',
        toLocation: location?.name || 'Unknown Site',
        status: 'preparing',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requests');
    }
  };

  const handleUpdateTransferStatus = async (transferId: string, status: Transfer['status']) => {
    try {
      await updateDoc(doc(db, 'transfers', transferId), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'transfers');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      parentLocation: formData.get('parentLocation') as string,
      lat: Number(formData.get('lat')),
      lng: Number(formData.get('lng')),
      severity: formData.get('severity') as string,
      status: 'active',
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'affectedLocations'), data);
      setIsLocationModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'affectedLocations');
    }
  };

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const nearestLocations = useMemo(() => {
    if (!selectedLocationId) return [];
    const selected = affectedLocations.find(l => l.id === selectedLocationId);
    if (!selected) return [];

    return affectedLocations
      .filter(l => l.id !== selectedLocationId)
      .map(l => ({
        ...l,
        distance: getDistance(selected.lat, selected.lng, l.lat, l.lng)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [selectedLocationId, affectedLocations]);

  const resourceStats = useMemo(() => {
    return resources.map(r => ({
      name: r.name,
      available: r.availableQuantity,
      total: r.totalQuantity
    }));
  }, [resources]);

  const requestStatusData = useMemo(() => {
    const counts = requests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'Pending', value: counts.pending || 0, color: '#EAB308' },
      { name: 'Approved', value: counts.approved || 0, color: '#22C55E' },
      { name: 'Fulfilled', value: counts.fulfilled || 0, color: '#3B82F6' },
      { name: 'Rejected', value: counts.rejected || 0, color: '#EF4444' },
    ];
  }, [requests]);

  const disasterTimeline = useMemo(() => {
    return affectedLocations
      .filter(l => l.timestamp)
      .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
      .map(l => ({
        name: l.name,
        severity: l.severity === 'critical' ? 4 : l.severity === 'high' ? 3 : l.severity === 'medium' ? 2 : 1,
        date: new Date(l.timestamp.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      }));
  }, [affectedLocations]);

  const locationDeployments = useMemo(() => {
    const deployments: Record<string, { medical: number, food: number, personnel: number, equipment: number, water: number }> = {};
    
    transfers.filter(t => t.status === 'delivered').forEach(t => {
      if (!deployments[t.toLocation]) {
        deployments[t.toLocation] = { medical: 0, food: 0, personnel: 0, equipment: 0, water: 0 };
      }
      const type = t.resourceType as keyof typeof deployments[string];
      if (deployments[t.toLocation][type] !== undefined) {
        deployments[t.toLocation][type] += t.quantity;
      }
    });

    return Object.entries(deployments).map(([location, resources]) => ({
      location,
      ...resources
    }));
  }, [transfers]);

  const seedInitialData = async () => {
    try {
      // Seed Resources
      const resourcesToSeed = [
        { name: 'Oxygen Cylinders', type: 'medical', totalQuantity: 500, availableQuantity: 450 },
        { name: 'Rice Bags (25kg)', type: 'food', totalQuantity: 1000, availableQuantity: 800 },
        { name: 'NDRF Personnel', type: 'personnel', totalQuantity: 200, availableQuantity: 150 },
        { name: 'Excavators', type: 'equipment', totalQuantity: 20, availableQuantity: 15 },
        { name: 'Water Bottles (1L)', type: 'water', totalQuantity: 5000, availableQuantity: 4200 },
      ];

      for (const res of resourcesToSeed) {
        await addDoc(collection(db, 'resources'), res);
      }

      // Seed Affected Locations for North India (Dehradun Region)
      const locationsToSeed = [
        { name: 'Rajpur Road', parentLocation: 'Dehradun', lat: 30.3551, lng: 78.0614, severity: 'critical', status: 'active' },
        { name: 'Clock Tower Area', parentLocation: 'Dehradun', lat: 30.3244, lng: 78.0411, severity: 'high', status: 'active' },
        { name: 'ISBT Dehradun', parentLocation: 'Dehradun', lat: 30.2851, lng: 78.0014, severity: 'medium', status: 'active' },
        { name: 'Laxman Jhula', parentLocation: 'Rishikesh', lat: 30.1244, lng: 78.3311, severity: 'high', status: 'active' },
        { name: 'Triveni Ghat', parentLocation: 'Rishikesh', lat: 30.1044, lng: 78.2911, severity: 'medium', status: 'active' },
        { name: 'Har Ki Pauri', parentLocation: 'Haridwar', lat: 29.9544, lng: 78.1711, severity: 'critical', status: 'active' },
        { name: 'Mall Road', parentLocation: 'Mussoorie', lat: 30.4544, lng: 78.0711, severity: 'medium', status: 'active' },
      ];

      for (const loc of locationsToSeed) {
        await addDoc(collection(db, 'affectedLocations'), {
          ...loc,
          timestamp: serverTimestamp()
        });
      }

      alert('Initial NDRF data for North India seeded successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'seed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">HQ Command Center</h2>
          <p className="text-gray-500">Centralized resource tracking and deployment management.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <MapPin className="w-4 h-4 text-orange-600" />
            Report New Spot
          </button>
          {resources.length === 0 && (
            <button 
              onClick={seedInitialData}
              className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition-all"
            >
              Seed Initial Data
            </button>
          )}
        </div>
      </header>

      {affectedLocations.length === 0 && (
        <div className="bg-white p-16 rounded-[3rem] border border-dashed border-gray-200 text-center mb-8">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-orange-600 opacity-50" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">No Affected Areas Reported</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            Start by seeding initial North India data or manually reporting a new disaster spot.
          </p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={seedInitialData}
              className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
            >
              Seed Initial Data
            </button>
            <button 
              onClick={() => setIsLocationModalOpen(true)}
              className="px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all"
            >
              Report New Spot
            </button>
          </div>
        </div>
      )}

      {/* Resource Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-50 rounded-xl text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Affected Areas</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{affectedLocations.filter(l => l.status === 'active').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-yellow-50 rounded-xl text-yellow-600">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Pending Requests</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{requests.filter(r => r.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">In-Transit</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{transfers.filter(t => t.status === 'in-transit').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-50 rounded-xl text-green-600">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Volunteers</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{volunteers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Map View */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm min-h-[500px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="text-red-600 w-6 h-6" />
              Affected Areas Map
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">North India Region</span>
          </div>
          <div className="h-[400px]">
            <MapView 
              locations={affectedLocations} 
              selectedId={selectedLocationId || undefined} 
              onSelect={setSelectedLocationId} 
            />
          </div>
        </div>

        {/* Location Deployments & Nearest Areas */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Truck className="text-orange-600 w-6 h-6" />
              Active Deployments
            </h3>
            <div className="space-y-6 overflow-y-auto h-[200px] pr-2 scrollbar-hide">
              {locationDeployments.map((dep, i) => (
                <div key={i} className="border-b border-gray-50 pb-4 last:border-0">
                  <p className="font-bold text-gray-900 mb-2 truncate">{dep.location}</p>
                  <div className="flex flex-wrap gap-2">
                    {dep.medical > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-bold uppercase">Med: {dep.medical}</span>}
                    {dep.food > 0 && <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-[9px] font-bold uppercase">Food: {dep.food}</span>}
                    {dep.personnel > 0 && <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-[9px] font-bold uppercase">Staff: {dep.personnel}</span>}
                    {dep.water > 0 && <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded-lg text-[9px] font-bold uppercase">Water: {dep.water}</span>}
                  </div>
                </div>
              ))}
              {locationDeployments.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <Truck className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-xs font-medium">No active field deployments.</p>
                </div>
              )}
            </div>
          </div>

          {selectedLocationId && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800 shadow-2xl text-white"
            >
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Zap className="text-orange-500 w-5 h-5" />
                Nearest Areas
              </h3>
              <div className="space-y-4">
                {nearestLocations.map(loc => (
                  <div key={loc.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-2xl border border-gray-800">
                    <div>
                      <p className="font-bold text-sm">{loc.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{loc.parentLocation}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-orange-500">{loc.distance.toFixed(1)} km</p>
                      <span className={cn(
                        "text-[8px] font-bold uppercase",
                        loc.severity === 'critical' ? 'text-red-400' : 'text-gray-400'
                      )}>{loc.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Resource Inventory Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="text-orange-600 w-6 h-6" />
              Resource Distribution
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-600" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-100" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
              </div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resourceStats} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="available" fill="#EA580C" radius={[6, 6, 0, 0]} barSize={32} />
                <Bar dataKey="total" fill="#FFEDD5" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Request Status Distribution */}
        <div className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800 shadow-2xl text-white">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <LayoutDashboard className="text-orange-500 w-6 h-6" />
            Request Status
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={requestStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {requestStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {requestStatusData.map(item => (
              <div key={item.name} className="bg-gray-800/50 p-3 rounded-2xl border border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.name}</span>
                </div>
                <p className="text-xl font-black">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Requests Table */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Priority Requests</h3>
            <span className="px-4 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
              {requests.filter(r => r.status === 'pending').length} Active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Affected Location</th>
                  <th className="px-8 py-4">Resource</th>
                  <th className="px-8 py-4">Quantity</th>
                  <th className="px-8 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.filter(r => r.status === 'pending').map(request => {
                  const location = affectedLocations.find(l => l.id === request.locationId);
                  return (
                    <tr key={request.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <p className="font-bold text-gray-900">{location?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">Affected Sector</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-bold uppercase text-gray-600">
                          {request.resourceType}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-black text-gray-900">{request.quantity}</td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => handleApproveRequest(request)}
                          className="bg-orange-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                        >
                          Approve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {requests.filter(r => r.status === 'pending').length === 0 && (
              <div className="p-16 text-center text-gray-300">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="font-medium">All clear. No pending requests.</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Chat / Activity Feed */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">Global Command Feed</h3>
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-2 h-[500px] overflow-hidden">
             {affectedLocations.length > 0 ? (
               <CommandChat locationId={affectedLocations[0].id} user={user} />
             ) : (
               <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                 Initialize data to see command feed.
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Active Transfers Section */}
      <div className="mt-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Logistics & Transfers</h3>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">
              {transfers.filter(t => t.status !== 'delivered').length} Active
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Resource</th>
                <th className="px-8 py-4">Destination</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transfers.filter(t => t.status !== 'delivered').map(transfer => (
                <tr key={transfer.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-bold text-gray-900 capitalize">{transfer.resourceType}</p>
                    <p className="text-xs text-gray-400">Qty: {transfer.quantity}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium text-gray-700">{transfer.toLocation}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      transfer.status === 'preparing' ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"
                    )}>
                      {transfer.status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-2">
                      {transfer.status === 'preparing' && (
                        <button 
                          onClick={() => handleUpdateTransferStatus(transfer.id, 'in-transit')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700"
                        >
                          Ship
                        </button>
                      )}
                      {transfer.status === 'in-transit' && (
                        <button 
                          onClick={() => handleUpdateTransferStatus(transfer.id, 'delivered')}
                          className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold hover:bg-green-700"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transfers.filter(t => t.status !== 'delivered').length === 0 && (
            <div className="p-16 text-center text-gray-300">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="font-medium">No active transfers in progress.</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Location Modal */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-orange-600 p-6 text-white">
                <h3 className="text-xl font-bold">Report Affected Spot</h3>
                <p className="text-orange-100 text-sm">Add a new location to the disaster map.</p>
              </div>
              <form onSubmit={handleCreateLocation} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Spot Name</label>
                    <input 
                      name="name" 
                      required 
                      placeholder="e.g. Rajpur Road Sector 4"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Parent City/Region</label>
                    <input 
                      name="parentLocation" 
                      required 
                      placeholder="e.g. Dehradun"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Latitude</label>
                    <input 
                      name="lat" 
                      type="number" 
                      step="any" 
                      required 
                      placeholder="30.3165"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Longitude</label>
                    <input 
                      name="lng" 
                      type="number" 
                      step="any" 
                      required 
                      placeholder="78.0322"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Severity Level</label>
                    <select 
                      name="severity" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                  >
                    Add to Map
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Listen to user profile changes in real-time
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserProfile);
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50 font-sans">
          <AlertTicker />
          {user && <Navbar user={user} />}
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" /> : <Login />} 
            />
            <Route 
              path="/" 
              element={
                !user ? <Navigate to="/login" /> : 
                user.role === 'hq_admin' ? <HQDashboard user={user} /> : <FieldDashboard user={user} />
              } 
            />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
