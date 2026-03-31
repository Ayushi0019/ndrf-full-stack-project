import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Clock, Shield, AlertTriangle, 
  Navigation, CheckCircle2, Info, Send,
  LayoutDashboard, Map as MapIcon, Bell
} from 'lucide-react';
import { 
  collection, onSnapshot, query, where, orderBy, 
  doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { UserProfile, Resource, EmergencyAlert, OperationType } from '../types';
import { handleFirestoreError } from './Common';

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

export const FieldDashboard = ({ user }: { user: UserProfile }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'map' | 'alerts'>('status');
  const [myTeam, setMyTeam] = useState<Resource | null>(null);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to my team data
    const q = query(collection(db, 'resources'), where('assignedTo', '==', user.uid));
    const unsubTeam = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMyTeam({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Resource);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'resources');
    });

    // Listen to active alerts
    const alertsQ = query(collection(db, 'alerts'), where('active', '==', true), orderBy('timestamp', 'desc'));
    const unsubAlerts = onSnapshot(alertsQ, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyAlert)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'alerts');
    });

    return () => {
      unsubTeam();
      unsubAlerts();
    };
  }, [user.uid]);

  const updateStatus = async (status: Resource['status']) => {
    if (!myTeam) return;
    try {
      await updateDoc(doc(db, 'resources', myTeam.id), {
        status,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${myTeam.id}`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Mobile Header Stats */}
      <div className="p-6 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">Field Ops</h2>
          <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Live Connection
          </div>
        </div>

        {myTeam ? (
          <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl shadow-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Assigned Unit</p>
                <h3 className="text-lg font-bold">{myTeam.name}</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    myTeam.status === 'active' ? 'bg-green-500' : 
                    myTeam.status === 'en_route' ? 'bg-blue-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-xs font-bold uppercase">{myTeam.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Location</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-orange-500" />
                  <span className="text-xs font-bold uppercase">{myTeam.location.lat.toFixed(2)}, {myTeam.location.lng.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-orange-50 rounded-3xl border border-dashed border-orange-200 text-center">
            <Info className="w-8 h-8 text-orange-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-orange-800">No Unit Assigned</p>
            <p className="text-xs text-orange-600 mt-1">Contact HQ to assign your unit for deployment.</p>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'status' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Update Mission Status</h3>
              <div className="grid gap-4">
                {[
                  { id: 'active', label: 'Active Deployment', icon: Shield, color: 'bg-green-600', desc: 'Currently engaged in rescue operations' },
                  { id: 'en_route', label: 'En Route', icon: Navigation, color: 'bg-blue-600', desc: 'Moving towards target location' },
                  { id: 'on_standby', label: 'On Standby', icon: Clock, color: 'bg-yellow-600', desc: 'Ready for immediate deployment' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateStatus(opt.id as Resource['status'])}
                    disabled={!myTeam}
                    className={`p-5 rounded-3xl border-2 text-left transition-all flex items-center gap-4 ${
                      myTeam?.status === opt.id 
                        ? 'border-orange-600 bg-orange-50 ring-4 ring-orange-100' 
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    } disabled:opacity-50`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${opt.color}`}>
                      <opt.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{opt.label}</p>
                      <p className="text-[10px] text-gray-500 font-medium">{opt.desc}</p>
                    </div>
                    {myTeam?.status === opt.id && (
                      <CheckCircle2 className="w-6 h-6 text-orange-600" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-[50vh] rounded-3xl overflow-hidden border-4 border-white shadow-2xl relative"
            >
              {myTeam ? (
                <MapContainer 
                  center={[myTeam.location.lat, myTeam.location.lng]} 
                  zoom={13} 
                  className="h-full w-full z-10"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[myTeam.location.lat, myTeam.location.lng]}>
                    <Popup>
                      <div className="font-bold">{myTeam.name}</div>
                      <div className="text-xs">{myTeam.status}</div>
                    </Popup>
                  </Marker>
                  <RecenterMap center={[myTeam.location.lat, myTeam.location.lng]} />
                </MapContainer>
              ) : (
                <div className="h-full bg-gray-100 flex items-center justify-center text-gray-400">
                  Map Unavailable
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Active Alerts</h3>
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div key={alert.id} className={`p-5 rounded-3xl border-l-8 ${
                    alert.severity === 'critical' ? 'bg-red-50 border-red-600' :
                    alert.severity === 'high' ? 'bg-orange-50 border-orange-600' : 'bg-blue-50 border-blue-600'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.severity === 'critical' ? 'text-red-600' : 'text-orange-600'
                      }`} />
                      <span className="font-black uppercase tracking-widest text-[10px]">{alert.severity} Priority</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">{alert.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{alert.message}</p>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Active Alerts</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-around items-center z-50">
        {[
          { id: 'status', icon: LayoutDashboard, label: 'Status' },
          { id: 'map', icon: MapIcon, label: 'Map' },
          { id: 'alerts', icon: Bell, label: 'Alerts', badge: alerts.length > 0 }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === tab.id ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="relative">
              <tab.icon className="w-6 h-6" />
              {tab.badge && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
