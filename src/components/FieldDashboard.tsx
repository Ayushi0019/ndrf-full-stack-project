import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Clock, Shield, AlertTriangle, 
  Navigation, CheckCircle2, Info, Send,
  LayoutDashboard, Map as MapIcon, Bell, PackagePlus,
  Camera, Image as ImageIcon, X, Plus, Users, Waves, ChevronRight
} from 'lucide-react';
import { 
  collection, onSnapshot, query, where, orderBy, 
  doc, updateDoc, serverTimestamp, addDoc, getDocs 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { UserProfile, Resource, EmergencyAlert, OperationType, ResourceRequest, IncidentPhoto } from '../types';
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
  const [activeTab, setActiveTab] = useState<'status' | 'map' | 'alerts' | 'requests' | 'evidence'>('status');
  const [myTeam, setMyTeam] = useState<Resource | null>(null);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const [inventory, setInventory] = useState<{name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ title: '', message: '', onConfirm: () => {} });
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    item: '',
    quantity: 1,
    priority: 'medium' as ResourceRequest['priority']
  });
  const [newPhoto, setNewPhoto] = useState({
    url: '',
    caption: ''
  });

  useEffect(() => {
    // Listen to my team data
    const q = query(collection(db, 'resources'), where('assignedTo', '==', user.uid));
    const unsubTeam = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMyTeam({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Resource);
      } else {
        setMyTeam(null);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'resources');
    });

    // Listen to all unassigned resources for claiming
    const qUnassigned = query(collection(db, 'resources'), where('assignedTo', '==', null));
    const unsubUnassigned = onSnapshot(qUnassigned, (snapshot) => {
      // Note: Firestore '==' null might not work as expected for missing fields, 
      // but if the field exists and is null, it should.
      // We can also just fetch all and filter in JS if needed.
      setAvailableResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
    });
    
    // Backup: Listen to all resources if unassigned is empty (in case it's a mapping issue)
    const unsubAll = onSnapshot(collection(db, 'resources'), (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource));
      setAvailableResources(all.filter(r => !r.assignedTo));
    });

    // Listen to active alerts
    const alertsQ = query(collection(db, 'alerts'), where('active', '==', true), orderBy('timestamp', 'desc'));
    const unsubAlerts = onSnapshot(alertsQ, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyAlert)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'alerts');
    });

    // Listen to my requests
    const requestsQ = query(collection(db, 'requests'), where('requesterId', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubRequests = onSnapshot(requestsQ, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceRequest)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'requests');
    });

    // Listen to photos in zone
    if (myTeam?.disasterZone) {
      const photosQ = query(
        collection(db, 'photos'), 
        where('disasterZone', '==', myTeam.disasterZone), 
        orderBy('timestamp', 'desc')
      );
      const unsubPhotos = onSnapshot(photosQ, (snapshot) => {
        setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncidentPhoto)));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'photos');
      });

      // Listen to inventory for suggestions
      const invQ = query(collection(db, 'inventory'), orderBy('name', 'asc'));
      const unsubInv = onSnapshot(invQ, (snapshot) => {
        setInventory(snapshot.docs.map(doc => ({ name: doc.data().name })));
      });

      return () => {
        unsubTeam();
        unsubUnassigned();
        unsubAll();
        unsubAlerts();
        unsubRequests();
        unsubPhotos();
        unsubInv();
      };
    }

    // Default return if no team
    const unsubInvFallback = onSnapshot(query(collection(db, 'inventory'), orderBy('name', 'asc')), (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ name: doc.data().name })));
    });

    return () => {
      unsubTeam();
      unsubUnassigned();
      unsubAll();
      unsubAlerts();
      unsubRequests();
      unsubInvFallback();
    };
  }, [user.uid, myTeam?.disasterZone]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        item: newRequest.item,
        quantity: Number(newRequest.quantity),
        priority: newRequest.priority,
        status: 'pending',
        disasterZone: myTeam?.disasterZone || 'General Mission',
        affectedArea: myTeam?.affectedArea || 'Unknown Sector',
        requestedBy: user.name,
        requesterId: user.uid,
        timestamp: serverTimestamp(),
        location: myTeam?.location || { lat: 20.5937, lng: 78.9629 }
      };
      
      console.log('Submitting Resource Request:', payload);
      await addDoc(collection(db, 'requests'), payload);
      
      setShowRequestForm(false);
      setNewRequest({ item: '', quantity: 1, priority: 'medium' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'requests');
    }
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTeam) return;

    try {
      await addDoc(collection(db, 'photos'), {
        ...newPhoto,
        uploadedBy: user.name,
        timestamp: serverTimestamp(),
        location: myTeam.location,
        disasterZone: myTeam.disasterZone || 'Active Mission'
      });
      setShowPhotoForm(false);
      setNewPhoto({ url: '', caption: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'photos');
    }
  };

  const handleClaimUnit = async (id: string) => {
    try {
      if (id === 'default_water_rescue_team') {
        // Special case: check if a water rescue team already exists and claim it, or create one
        const q = query(collection(db, 'resources'), where('name', '==', 'Water Rescue Unit'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docRef = doc(db, 'resources', snapshot.docs[0].id);
          await updateDoc(docRef, { assignedTo: user.uid, lastUpdated: serverTimestamp() });
          return;
        } else {
          await addDoc(collection(db, 'resources'), {
            name: 'Water Rescue Unit',
            type: 'team',
            status: 'on_standby',
            location: { lat: 30.7346, lng: 79.0669 },
            assignedTo: user.uid,
            lastUpdated: serverTimestamp(),
            disasterZone: 'Bhotia Para',
            affectedArea: 'Main Coastline'
          });
          return;
        }
      }
      await updateDoc(doc(db, 'resources', id), {
        assignedTo: user.uid,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${id}`);
    }
  };

  const updateStatus = (status: Resource['status']) => {
    if (!myTeam) return;
    setConfirmConfig({
      title: 'Update Mission Status?',
      message: `Change mission status to ${status.replace('_', ' ').toUpperCase()}? HQ will be notified immediately.`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'resources', myTeam.id), {
            status,
            lastUpdated: serverTimestamp()
          });
          setShowConfirm(false);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `resources/${myTeam.id}`);
        }
      }
    });
    setShowConfirm(true);
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
              <div className="flex-1">
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest leading-none mb-1">
                  Assigned Unit
                </p>
                <h3 className="text-lg font-bold leading-tight">{myTeam.name}</h3>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase text-orange-400 tracking-tighter">
                    {myTeam.disasterZone || 'Active Mission'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sector</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-orange-500" />
                  <span className="text-xs font-bold uppercase truncate">{myTeam.affectedArea || 'Unassigned'}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    myTeam.status === 'active' ? 'bg-green-500' : 
                    myTeam.status === 'en_route' ? 'bg-blue-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-xs font-bold uppercase">
                    {myTeam.status === 'active' ? 'Deployed' : 
                     myTeam.status === 'en_route' ? 'En Route' : 
                     myTeam.status === 'on_standby' ? 'Standby' : 'Off-Duty'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-center">
              <Shield className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-600">No Unit Assigned</p>
              <p className="text-xs text-gray-400 mt-1">Your profile is not yet linked to an active rescue unit by Command HQ.</p>
            </div>
            
            <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Tactical Claim</h4>
                <div className="px-2 py-0.5 bg-orange-600 text-white text-[8px] font-black rounded-lg">DEFAULT: WATER RESCUE</div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleClaimUnit('default_water_rescue_team')}
                  className="w-full p-5 bg-white rounded-2xl border-2 border-orange-500 text-left flex items-center justify-between group hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 group-hover:bg-white/20 group-hover:text-white transition-colors">
                      <Waves className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-black text-gray-900 group-hover:text-white transition-colors">Water Rescue Unit</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest group-hover:text-orange-200 transition-colors">Primary Deployment Team</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" />
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-orange-200"></div></div>
                  <div className="relative flex justify-center text-[8px] uppercase font-black text-orange-400 bg-orange-50 px-2 tracking-widest leading-none">Other Units</div>
                </div>

                {availableResources.length > 0 ? (
                  availableResources.filter(r => r.id !== 'default_water_rescue_team').slice(0, 3).map(res => (
                    <div
                      key={res.id}
                      className="w-full p-4 bg-white rounded-2xl border border-orange-200 flex items-center justify-between group hover:border-orange-500 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                          {res.type === 'team' ? <Users className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{res.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{res.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleClaimUnit(res.id)}
                        className="px-4 py-2 bg-orange-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                      >
                        Claim Unit
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-gray-400 font-medium text-center">All units currently deployed or unassigned listed.</p>
                )}
              </div>
            </div>
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
                  { id: 'active', label: 'Deployed', icon: Shield, color: 'bg-green-600', desc: 'Currently engaged in rescue operations' },
                  { id: 'en_route', label: 'En Route', icon: Navigation, color: 'bg-blue-600', desc: 'Moving towards target location' },
                  { id: 'on_standby', label: 'Standby', icon: Clock, color: 'bg-yellow-600', desc: 'Ready for immediate deployment' },
                  { id: 'maintenance', label: 'Off-Duty', icon: CheckCircle2, color: 'bg-gray-600', desc: 'Unit resting or under maintenance' }
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
                      <div className="p-1">
                        <p className="font-bold text-gray-900">{myTeam.name}</p>
                        <p className="text-[9px] text-orange-600 font-black uppercase tracking-tighter mb-1">{myTeam.disasterZone}</p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                          <MapPin className="w-2 h-2" />
                          {myTeam.affectedArea}
                        </div>
                      </div>
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

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Resource Requirements</h3>
                <button 
                  onClick={() => setShowRequestForm(!showRequestForm)}
                  className="p-2 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200"
                >
                  {showRequestForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              {showRequestForm && (
                <form onSubmit={handleCreateRequest} className="bg-white p-6 rounded-3xl border border-orange-100 shadow-xl space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Resource Needed</label>
                    <input 
                      required type="text" 
                      placeholder="Select or type item..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={newRequest.item}
                      onChange={(e) => setNewRequest({...newRequest, item: e.target.value})}
                      list="inventory-suggestions"
                    />
                    <datalist id="inventory-suggestions">
                      {inventory.map((item, idx) => (
                        <option key={idx} value={item.name} />
                      ))}
                      {inventory.length === 0 && (
                        <>
                          <option value="Advanced Medical Kit #12" />
                          <option value="Rescue Boat Fleet Bravo" />
                          <option value="Survival Rations PK-09" />
                        </>
                      )}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Quantity</label>
                      <input 
                        required type="number" min="1"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                        value={newRequest.quantity}
                        onChange={(e) => setNewRequest({...newRequest, quantity: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Priority</label>
                      <select 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                        value={newRequest.priority}
                        onChange={(e) => setNewRequest({...newRequest, priority: e.target.value as any})}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Submit Request
                  </button>
                </form>
              )}

              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-tighter rounded-bl-xl ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      request.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                      request.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {request.status}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600">
                        <PackagePlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{request.item}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Qty: {request.quantity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className={`w-3 h-3 ${
                          request.priority === 'critical' ? 'text-red-500' : 'text-orange-500'
                        }`} />
                        <span className="text-[9px] font-bold text-gray-500 uppercase">{request.priority}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-[9px] font-bold text-gray-500 uppercase">
                          {request.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {requests.length === 0 && !showRequestForm && (
                  <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <PackagePlus className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Resource Requests</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'evidence' && (
            <motion.div
              key="evidence"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Site Evidence</h3>
                <button 
                  onClick={() => setShowPhotoForm(!showPhotoForm)}
                  className="p-3 bg-gray-900 text-white rounded-2xl shadow-xl"
                >
                  {showPhotoForm ? <X className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </button>
              </div>

              {showPhotoForm && (
                <form onSubmit={handleUploadPhoto} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Photo URL</label>
                    <input 
                      required type="url" placeholder="https://..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={newPhoto.url}
                      onChange={(e) => setNewPhoto({...newPhoto, url: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Caption</label>
                    <textarea 
                      required placeholder="Describe the damage..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                      rows={2}
                      value={newPhoto.caption}
                      onChange={(e) => setNewPhoto({...newPhoto, caption: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Submit Evidence
                  </button>
                </form>
              )}

              <div className="grid grid-cols-2 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm group">
                    <div className="aspect-square bg-gray-100 relative">
                      <img 
                        src={photo.url} 
                        alt={photo.caption} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1547619292-24040a15ce1?w=800&auto=format&fit=crop&q=60';
                        }}
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-full text-[8px] text-white font-bold uppercase">
                        {photo.timestamp?.toDate().toLocaleDateString()}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] font-bold text-gray-900 line-clamp-2 mb-1">{photo.caption}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">By {photo.uploadedBy}</p>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && !showPhotoForm && (
                  <div className="col-span-2 p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Photos Recorded</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConfirm(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 text-center">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">{confirmConfig.title}</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed px-4">{confirmConfig.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmConfig.onConfirm}
                  className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-orange-700 transition-all"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-around items-center z-50">
        {[
          { id: 'status', icon: LayoutDashboard, label: 'Ops' },
          { id: 'requests', icon: PackagePlus, label: 'Needs' },
          { id: 'evidence', icon: Camera, label: 'Proof' },
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
