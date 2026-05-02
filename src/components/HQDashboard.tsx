import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Package, Truck, MapPin, Plus, 
  Search, Filter, Trash2, Edit3, Send,
  AlertTriangle, Shield, CheckCircle2, X,
  TrendingUp, Activity, Globe, Clock, Bell, PackagePlus,
  Image as ImageIcon
} from 'lucide-react';
import { 
  collection, onSnapshot, query, orderBy, 
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { db } from '../firebase';
import { UserProfile, Resource, EmergencyAlert, OperationType, ResourceRequest, InventoryItem, IncidentPhoto, DisasterIncident } from '../types';
import { handleFirestoreError } from './Common';

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export const HQDashboard = ({ user }: { user: UserProfile }) => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const [incidents, setIncidents] = useState<DisasterIncident[]>([]);
  const [activeIncident, setActiveIncident] = useState<DisasterIncident | null>(null);
  const [activeTab, setActiveTab] = useState<'resources' | 'inventory' | 'incidents'>('resources');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddIncidentModal, setShowAddIncidentModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ title: '', message: '', onConfirm: () => {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<Resource['type'] | 'all'>('all');

  // Form states
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    name: 'Water Rescue Unit Alpha', 
    type: 'team', 
    status: 'on_standby', 
    location: { lat: 30.7346, lng: 79.0669 },
    disasterZone: '',
    affectedArea: ''
  });

  const [newIncident, setNewIncident] = useState<Partial<DisasterIncident>>({
    name: '',
    severity: 'high',
    epicenter: { lat: 30.7346, lng: 79.0669 },
    radiusKm: 15
  });
  const [newAlert, setNewAlert] = useState<Partial<EmergencyAlert>>({
    title: '', 
    message: '', 
    severity: 'medium',
    disasterZone: '',
    affectedArea: ''
  });

  useEffect(() => {
    // Listen to all resources
    const q = query(collection(db, 'resources'), orderBy('lastUpdated', 'desc'));
    const unsubResources = onSnapshot(q, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'resources');
    });

    // Listen to all alerts
    const alertsQ = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsubAlerts = onSnapshot(alertsQ, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyAlert)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'alerts');
    });

    // Listen to all requests
    const requestsQ = query(collection(db, 'requests'), orderBy('timestamp', 'desc'));
    const unsubRequests = onSnapshot(requestsQ, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceRequest)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'requests');
    });

    // Listen to inventory
    const inventoryQ = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubInventory = onSnapshot(inventoryQ, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    });

    // Listen to photos
    const unsubPhotos = onSnapshot(query(collection(db, 'photos'), orderBy('timestamp', 'desc')), (snapshot) => {
      setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncidentPhoto)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'photos');
    });

    // Listen to incidents
    const unsubIncidents = onSnapshot(query(collection(db, 'incidents'), orderBy('timestamp', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisasterIncident));
      setIncidents(data);
      
      // Auto-select first incident if none selected or if current one was deleted
      if (data.length > 0) {
        if (!activeIncident || !data.find(i => i.id === activeIncident.id)) {
          setActiveIncident(data[0]);
        }
      } else {
        setActiveIncident(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'incidents');
    });

    // Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => {
      unsubResources();
      unsubAlerts();
      unsubRequests();
      unsubInventory();
      unsubPhotos();
      unsubIncidents();
      unsubUsers();
    };
  }, []); 

  const handleUpdateStatus = async (id: string, status: Resource['status']) => {
    try {
      await updateDoc(doc(db, 'resources', id), {
        status,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${id}`);
    }
  };

  const handleAssignUser = async (resourceId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'resources', resourceId), {
        assignedTo: userId,
        lastUpdated: serverTimestamp()
      });
      setShowAssignModal(false);
      setSelectedResourceId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${resourceId}`);
    }
  };

  const handleDeleteResource = (id: string) => {
    setConfirmConfig({
      title: 'Decommission Asset?',
      message: 'Are you sure you want to remove this resource unit from active registry? This action is permanent.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'resources', id));
          setShowConfirm(false);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `resources/${id}`);
        }
      }
    });
    setShowConfirm(true);
  };

  const handleUpdateRequestStatus = async (request: ResourceRequest, status: ResourceRequest['status']) => {
    try {
      // Logic: If status is 'approved' or 'dispatched', attempt to subtract from inventory
      if (status === 'approved' || status === 'dispatched') {
        if (request.status === 'pending') {
          const inventoryItem = inventory.find(i => 
            i.name.toLowerCase().includes((request.item || '').toLowerCase()) ||
            (request.item || '').toLowerCase().includes(i.name.toLowerCase())
          );
          if (inventoryItem) {
            const qtyToSubtract = Number(request.quantity) || 1;
            if (inventoryItem.quantity < qtyToSubtract) {
              console.warn(`Insufficient inventory for ${request.item}. Current: ${inventoryItem.quantity}`);
            } else {
              console.log(`Subtracting ${qtyToSubtract} from ${inventoryItem.name}`);
              await updateDoc(doc(db, 'inventory', inventoryItem.id), {
                quantity: Math.max(0, inventoryItem.quantity - qtyToSubtract),
                lastUpdated: serverTimestamp()
              });
            }
          } else {
            console.warn('No matching inventory item found for sync:', request.item);
          }
        }
      }
      
      await updateDoc(doc(db, 'requests', request.id), { 
        status,
        lastUpdated: serverTimestamp() 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requests/${request.id}`);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      console.log('Declaring Incident with state:', newIncident);
      const payload = {
        name: newIncident.name || 'Unnamed Disaster',
        severity: newIncident.severity || 'high',
        epicenter: newIncident.epicenter || { lat: 30.7346, lng: 79.0669 },
        radiusKm: Number(newIncident.radiusKm) || 15,
        status: 'active',
        affectedClusters: [],
        timestamp: serverTimestamp()
      };
      
      await addDoc(collection(db, 'incidents'), payload);
      setShowAddIncidentModal(false);
      setNewIncident({ name: '', severity: 'high', epicenter: { lat: 30.7346, lng: 79.0669 }, radiusKm: 15 });
    } catch (err) {
      console.error('Add Incident Error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'incidents');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'resources') {
        await addDoc(collection(db, 'resources'), {
          ...newResource,
          lastUpdated: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...newInventoryItem,
          lastUpdated: serverTimestamp()
        });
      }
      setShowAddModal(false);
      setNewResource({ 
        name: '', type: 'team', status: 'on_standby', 
        location: { lat: 30.7346, lng: 79.0669 },
        disasterZone: '', affectedArea: ''
      });
      setNewInventoryItem({ name: '', category: 'medical', quantity: 0, unit: '', minThreshold: 0 });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, activeTab);
    }
  };

  const [newInventoryItem, setNewInventoryItem] = useState<Partial<InventoryItem>>({
    name: '', category: 'medical', quantity: 0, unit: '', minThreshold: 0
  });

  const [showGlobalRequests, setShowGlobalRequests] = useState(false);
  const [showGroundProof, setShowGroundProof] = useState(false);

  const handleDeleteRequest = (id: string) => {
    setConfirmConfig({
      title: 'Cancel Request?',
      message: 'Are you sure you want to permanently delete this field request?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'requests', id));
          setShowConfirm(false);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `requests/${id}`);
        }
      }
    });
    setShowConfirm(true);
  };

  const handleDeleteIncident = (id: string) => {
    setConfirmConfig({
      title: 'End Mission?',
      message: 'This will permanently remove the disaster record and all associated logs. Are you sure?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'incidents', id));
          setShowConfirm(false);
          setActiveIncident(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `incidents/${id}`);
        }
      }
    });
    setShowConfirm(true);
  };

  const stats = {
    total: resources.length,
    active: resources.filter(r => r.status === 'active').length,
    enRoute: resources.filter(r => r.status === 'en_route').length,
    standby: resources.filter(r => r.status === 'on_standby').length,
  };

  const chartData = [
    { name: 'Active', value: stats.active, color: '#16a34a' },
    { name: 'En Route', value: stats.enRoute, color: '#2563eb' },
    { name: 'Standby', value: stats.standby, color: '#ca8a04' },
  ];

  const handleAddResource = async (e: React.FormEvent) => {
    // Legacy mapping to new unified function
    handleAddSubmit(e);
  };

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'alerts'), {
        ...newAlert,
        active: true,
        timestamp: serverTimestamp()
      });
      setShowAlertModal(false);
      setNewAlert({ title: '', message: '', severity: 'medium', disasterZone: '', affectedArea: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'alerts');
    }
  };

  const filteredResources = resources.filter(r => 
    (filterType === 'all' || r.type === filterType) &&
    (r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.disasterZone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     r.affectedArea?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUnassignUser = async (resourceId: string) => {
    try {
      await updateDoc(doc(db, 'resources', resourceId), {
        assignedTo: null,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${resourceId}`);
    }
  };

  // AI Logic: Closest Resource Routing
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const suggestedResources = activeIncident ? resources
    .filter(r => r.status === 'on_standby')
    .map(r => ({
      ...r,
      distance: calculateDistance(
        activeIncident.epicenter.lat, 
        activeIncident.epicenter.lng, 
        r.location.lat, 
        r.location.lng
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3) : [];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* AI Intelligence Header */}
      <div className="bg-gray-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-orange-600/20 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 p-2 rounded-xl animate-pulse">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight">Geospatial Intelligence Dashboard</h1>
            </div>
              <div className="flex flex-wrap gap-3">
                {incidents
                  .reduce((acc: DisasterIncident[], curr) => {
                    if (!acc.find(i => i.name === curr.name)) acc.push(curr);
                    return acc;
                  }, [])
                  .map(inc => (
                  <button
                    key={inc.id}
                    onClick={() => setActiveIncident(inc)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      activeIncident?.id === inc.id 
                      ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-900/50' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {inc.name}
                  </button>
                ))}
              </div>
          </div>
          
          <div className="flex items-center gap-6 divide-x divide-white/10">
            <div className="pl-6 first:pl-0">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Impact Level</p>
              <p className={`text-xl font-black uppercase ${activeIncident?.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>
                {activeIncident?.severity || 'Normal'}
              </p>
            </div>
            <div className="pl-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Radius (KM)</p>
              <p className="text-xl font-black text-white">{activeIncident?.radiusKm || 0}</p>
            </div>
            <div className="pl-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Alert Scale</p>
              <p className="text-xl font-black text-white">{alerts.length}</p>
            </div>
            {activeIncident && (
              <div className="pl-6 border-l border-white/10">
                <button 
                  onClick={() => handleDeleteIncident(activeIncident.id)}
                  className="bg-red-600/20 hover:bg-red-600 p-3 rounded-2xl text-red-500 hover:text-white transition-all group"
                  title="End Mission"
                >
                  <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Map View - 3 Columns */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden h-[650px] relative">
            <div className="absolute top-6 left-6 z-[40] space-y-3">
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center text-white">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operational View</p>
                  <p className="text-lg font-black text-gray-900">{activeIncident?.name || 'Select Incident'}</p>
                </div>
              </div>
            </div>

            <MapContainer 
              center={activeIncident ? [activeIncident.epicenter.lat, activeIncident.epicenter.lng] : [30.2850, 78.9811]} 
              zoom={activeIncident ? 11 : 8} 
              className="h-full w-full z-10"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {activeIncident && (
                <>
                  {/* Epicenter Pulse Effect */}
                  <Circle
                    center={[activeIncident.epicenter.lat, activeIncident.epicenter.lng]}
                    radius={500}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }}
                    className="animate-pulse"
                  />
                  {/* Impact Zone Boundary */}
                  <Circle
                    center={[activeIncident.epicenter.lat, activeIncident.epicenter.lng]}
                    radius={activeIncident.radiusKm * 1000}
                    pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.05, weight: 2, dashArray: '10, 10' }}
                  />
                </>
              )}

              {resources.map((r) => (
                <Marker key={r.id} position={[r.location.lat, r.location.lng]}>
                  <Popup>
                    <div className="p-3 space-y-3 min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          r.type === 'team' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {r.type === 'team' ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-sm leading-tight">{r.name}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">{r.type}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${r.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <span className="text-[10px] font-black uppercase text-gray-700">{r.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-[10px] text-orange-600 font-black uppercase tracking-tight bg-orange-50 px-2 py-1 rounded w-fit">
                          Cluster: {r.disasterZone}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            
            <div className="absolute bottom-6 right-6 z-[40]">
              <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] shadow-2xl border border-gray-100 w-80">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <Shield className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-xs text-gray-900 uppercase">AI-Suggested Dispatch</h4>
                </div>
                <div className="space-y-3">
                  {suggestedResources.map(res => (
                    <div 
                      key={res.id} 
                      onClick={() => handleUpdateStatus(res.id, 'active')}
                      className="p-3 rounded-2xl bg-gray-50 border border-gray-100 group hover:border-blue-200 transition-all cursor-pointer"
                      title="Click to dispatch immediately"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-gray-900">{res.name}</span>
                        <span className="text-[9px] font-bold text-blue-600">{(res as any).distance.toFixed(1)} km</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-1000" 
                            style={{ width: `${Math.max(0, 100 - (res as any).distance)}%` }} 
                          />
                        </div>
                        <span className="text-[8px] font-black text-gray-400 uppercase">Proximity</span>
                      </div>
                      <div className="mt-2 text-[8px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        CLICK TO DISPATCH →
                      </div>
                    </div>
                  ))}
                  {suggestedResources.length === 0 && (
                    <p className="text-[10px] text-gray-400 font-medium text-center py-4">No standby units nearby</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-8">
                {['resources', 'inventory', 'incidents'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex items-center gap-3 transition-all ${activeTab === tab ? 'text-orange-600 scale-105' : 'text-gray-300'}`}
                  >
                    {tab === 'resources' ? <Users className="w-5 h-5" /> : 
                     tab === 'inventory' ? <Package className="w-5 h-5" /> :
                     <Activity className="w-5 h-5" />}
                    <h3 className="font-black uppercase tracking-widest text-xs">
                      {tab === 'resources' ? 'Operational Assets' : 
                       tab === 'inventory' ? 'Global Logistics' : 
                       'Disaster Registry'}
                    </h3>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowAddIncidentModal(true)}
                  className="flex items-center gap-3 bg-red-600 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-red-700 transition-all shadow-xl shadow-red-200 uppercase tracking-widest border border-red-500"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Declare Incident
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('resources');
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-black transition-all shadow-xl shadow-gray-200 uppercase tracking-widest border border-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  Register Asset
                </button>
              </div>
            </div>

            <div className="p-8 border-b border-gray-50 flex gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder={`Intercept signals in ${activeTab}...`} 
                  className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {activeTab === 'resources' && (
                <div className="flex items-center gap-3 bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select 
                    className="bg-transparent text-sm font-black text-gray-700 focus:outline-none appearance-none"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                  >
                    <option value="all">All Specs</option>
                    <option value="team">Rescue Teams</option>
                    <option value="personnel">Personnel</option>
                    <option value="equipment">Specialized Gear</option>
                    <option value="vehicle">Air/Land Craft</option>
                  </select>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                {activeTab === 'incidents' ? (
                  <>
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Incident Name</th>
                        <th className="px-6 py-4">Severity</th>
                        <th className="px-6 py-4">Radius</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {incidents.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map((incident) => (
                        <tr key={incident.id} className="hover:bg-gray-50 transition-all group">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-gray-900">{incident.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              incident.severity === 'critical' ? 'bg-red-100 text-red-600' :
                              incident.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {incident.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-gray-500">{incident.radiusKm} km</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteIncident(incident.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : activeTab === 'resources' ? (
                  <>
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Resource</th>
                        <th className="px-6 py-4">Status & Zone</th>
                        <th className="px-6 py-4">Assignment</th>
                        <th className="px-6 py-4">Area Impact</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredResources.map((resource) => (
                        <tr key={resource.id} className="hover:bg-gray-50 transition-all group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                resource.type === 'team' ? 'bg-orange-100 text-orange-600' :
                                resource.type === 'vehicle' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                              }`}>
                                {resource.type === 'team' ? <Users className="w-4 h-4" /> :
                                 resource.type === 'vehicle' ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 text-sm block">{resource.name}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase">{resource.type}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  resource.status === 'active' ? 'bg-green-500' : 
                                  resource.status === 'en_route' ? 'bg-blue-500' : 'bg-yellow-500'
                                }`} />
                                <span className="text-xs font-bold text-gray-700 uppercase">{resource.status.replace('_', ' ')}</span>
                              </div>
                              <div className="text-[10px] text-orange-600 font-black uppercase tracking-tight bg-orange-50 px-1.5 py-0.5 rounded leading-none w-fit">
                                {resource.disasterZone || 'No Zone'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-gray-400" />
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                {resource.assignedTo ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                      {users.find(u => u.uid === resource.assignedTo)?.name || 
                                      resource.assignedTo.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                    </span>
                                    <button 
                                      onClick={() => handleUnassignUser(resource.id)}
                                      className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                                      title="Unassign"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : 'UNASSIGNED'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              {resource.affectedArea || 'Unspecified Area'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setSelectedResourceId(resource.id);
                                  setShowAssignModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                title="Assign Personnel"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(resource.id, resource.status === 'on_standby' ? 'active' : 'on_standby')}
                                className={`p-2 rounded-lg transition-all ${
                                  resource.status === 'on_standby' ? 'text-green-600 hover:bg-green-50' : 'text-blue-600 hover:bg-blue-50'
                                }`}
                                title={resource.status === 'on_standby' ? 'Dispatch' : 'Return to Standby'}
                              >
                                {resource.status === 'on_standby' ? <Send className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => handleDeleteResource(resource.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Decommission Assets"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Item Name</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Quantity In Stock</th>
                        <th className="px-6 py-4 text-right">Last Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {inventory
                        .reduce((acc: InventoryItem[], curr) => {
                          const existing = acc.find(item => item.name.toLowerCase() === curr.name.toLowerCase());
                          if (existing) {
                            existing.quantity += curr.quantity;
                            return acc;
                          }
                          return [...acc, { ...curr }];
                        }, [])
                        .map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-all group">
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 text-sm block">{item.name}</span>
                          </td>
                          <td className="px-6 py-4 uppercase text-[10px] font-bold text-gray-400">{item.category}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-black ${item.quantity <= (item.minThreshold || 0) ? 'text-red-600' : 'text-gray-900'}`}>
                                {item.quantity} {item.unit}
                              </span>
                              {item.quantity <= (item.minThreshold || 0) && (
                                <span className="text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">Low Stock</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-[10px] font-bold text-gray-400">
                            {item.lastUpdated ? (item.lastUpdated as any).toDate().toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>

          {/* Map View */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-[500px] relative">
            <div className="absolute top-4 left-4 z-[40] bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold text-gray-900 uppercase tracking-widest">Global Fleet View (All Assets)</span>
              </div>
            </div>
            <MapContainer center={[30.2850, 78.9811]} zoom={8} className="h-full w-full z-10">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {resources.map((r) => (
                <Marker key={r.id} position={[r.location.lat, r.location.lng]}>
                  <Popup>
                    <div className="p-2 space-y-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{r.name}</p>
                        <p className="text-[10px] text-orange-600 font-black uppercase">{r.disasterZone}</p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <div className={`w-2 h-2 rounded-full ${
                          r.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">{r.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 italic">Sector: {r.affectedArea}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Right Sidebar: Analytics & Logistics - 1 Column */}
        <div className="space-y-8 h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide pr-2">
          {/* Send Alert Action Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Emergency Protocol</h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setShowAlertModal(true)}
                className="flex items-center justify-center gap-3 bg-red-600 text-white px-6 py-4 rounded-3xl text-xs font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 uppercase tracking-widest"
              >
                <AlertTriangle className="w-5 h-5" />
                Broadcast Alert
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Impact Analytics</h3>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#9ca3af' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f9fafb' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-red-600" />
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Intelligence Feed</h3>
              </div>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-2xl border-l-4 ${
                  alert.severity === 'critical' ? 'bg-red-50 border-red-600' :
                  alert.severity === 'high' ? 'bg-orange-50 border-orange-600' : 'bg-blue-50 border-blue-600'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-[8px] text-gray-400 font-bold">{alert.timestamp?.toDate().toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-[11px] font-bold text-gray-900 mb-1 leading-tight">{alert.title}</h4>
                  <p className="text-[9px] text-orange-600 font-black uppercase leading-none">{alert.disasterZone}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <PackagePlus className="w-5 h-5 text-orange-600" />
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Global Requests</h3>
              </div>
              <button 
                onClick={() => setShowGlobalRequests(true)}
                className="text-[10px] font-black text-orange-600 uppercase hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {requests.filter(r => r.status === 'pending').slice(0, 5).map((request) => (
                <div key={request.id} className="p-4 rounded-3xl border border-gray-100 bg-gray-50/50 space-y-3 transition-all hover:border-orange-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-gray-900">{request.item}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-orange-600">Qty: {request.quantity}</span>
                      <button onClick={() => handleDeleteRequest(request.id)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase">{request.affectedArea}</p>
                  <button 
                    onClick={() => handleUpdateRequestStatus(request, 'approved')}
                    className="w-full py-2.5 bg-gray-900 text-white rounded-2xl text-[9px] font-black hover:bg-black uppercase tracking-widest shadow-lg shadow-gray-200 active:scale-95 transition-all"
                  >
                    Quick Dispatch
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-orange-600" />
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Ground Proof</h3>
              </div>
              <button 
                onClick={() => setShowGroundProof(true)}
                className="text-[10px] font-black text-orange-600 uppercase hover:underline"
              >
                Gallery
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.slice(0, 4).map((photo) => (
                <div 
                  key={photo.id} 
                  onClick={() => setShowGroundProof(true)}
                  className="aspect-square rounded-2xl overflow-hidden border border-gray-100 group relative cursor-pointer"
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <span className="text-[7px] text-white font-black uppercase text-center px-1">{photo.disasterZone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modals */}
      <AnimatePresence>
        {showGlobalRequests && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGlobalRequests(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-4xl max-h-[80vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-orange-100 p-3 rounded-2xl text-orange-600">
                    <PackagePlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">All Field Requests</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Awaiting Command Approval</p>
                  </div>
                </div>
                <button onClick={() => setShowGlobalRequests(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {requests.filter(r => r.status === 'pending').map(request => (
                    <div key={request.id} className="p-6 rounded-[2.5rem] border border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-black text-gray-900">{request.item}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{request.affectedArea}</p>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-black text-gray-900">QTY: {request.quantity}</span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                            request.priority === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                          }`}>{request.priority}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateRequestStatus(request, 'approved')}
                        className="p-4 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {requests.filter(r => r.status === 'pending').length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <CheckCircle2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                      <p className="font-black text-gray-400 uppercase tracking-widest">No Pending Requests</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showGroundProof && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGroundProof(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-6xl max-h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Situational Intelligence Gallery</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Verified Evidence from Field Teams</p>
                  </div>
                </div>
                <button onClick={() => setShowGroundProof(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {photos.map(photo => (
                    <div key={photo.id} className="group space-y-4">
                      <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-xl shadow-gray-200 border border-gray-100 relative">
                        <img src={photo.url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute top-4 left-4 flex gap-2">
                          <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[9px] font-black uppercase rounded-full">
                            {photo.disasterZone}
                          </span>
                        </div>
                      </div>
                      <div className="px-2">
                        <p className="text-sm font-bold text-gray-900 leading-snug">{photo.caption}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users className="w-3 h-3 text-gray-400" />
                          </div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">{photo.uploadedBy} • {photo.timestamp?.toDate().toLocaleTimeString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
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
                  className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showAddIncidentModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddIncidentModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-gray-900">Record Disaster Incident</h3>
                <button onClick={() => setShowAddIncidentModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAddIncident} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Incident Name</label>
                  <input 
                    required type="text" placeholder="e.g. Cyclone Relief 2024"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    value={newIncident.name}
                    onChange={(e) => setNewIncident({...newIncident, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Severity</label>
                    <select 
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none"
                      value={newIncident.severity}
                      onChange={(e) => setNewIncident({...newIncident, severity: e.target.value as any})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Impact Radius (Km)</label>
                    <input 
                      required type="number" 
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none"
                      value={newIncident.radiusKm}
                      onChange={(e) => setNewIncident({...newIncident, radiusKm: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Latitude</label>
                    <input 
                      required type="number" step="any"
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none"
                      value={newIncident.epicenter?.lat}
                      onChange={(e) => setNewIncident({...newIncident, epicenter: { ...newIncident.epicenter!, lat: parseFloat(e.target.value) }})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Longitude</label>
                    <input 
                      required type="number" step="any"
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none"
                      value={newIncident.epicenter?.lng}
                      onChange={(e) => setNewIncident({...newIncident, epicenter: { ...newIncident.epicenter!, lng: parseFloat(e.target.value) }})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-5 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-red-200 cursor-pointer ${
                    isSubmitting ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'
                  }`}
                >
                  {isSubmitting ? 'Recording Signal...' : 'Confirm Incident Location'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-900 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeTab === 'resources' ? <Plus className="w-5 h-5 text-orange-500" /> : <Package className="w-5 h-5 text-blue-500" />}
                  <h3 className="font-bold">{activeTab === 'resources' ? 'Register New Resource' : 'Add Inventory Item'}</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddSubmit} className="p-8 space-y-6">
                {activeTab === 'resources' ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Resource Name (e.g. NDRF Team 01)</label>
                      <input 
                        required type="text" list="ndrf-teams"
                        placeholder="e.g. NDRF Unit Alpha"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={newResource.name}
                        onChange={(e) => setNewResource({...newResource, name: e.target.value})}
                      />
                      <datalist id="ndrf-teams">
                        <option value="NDRF Team 01 (Water Rescue)" />
                        <option value="NDRF Team 02 (Mountain Rescue)" />
                        <option value="NDRF Team 03 (Logistics)" />
                        <option value="NDRF Team 04 (Medical)" />
                        <option value="NDRF Team 05 (Communication)" />
                        <option value="NDRF Team 06 (Technical Search)" />
                        <option value="NDRF Team 07 (K9 Unit)" />
                        <option value="NDRF Team 08 (CBRN Response)" />
                        <option value="NDRF Team 10 (Airborne Support)" />
                        <option value="NDRF Team 12 (Special Ops)" />
                      </datalist>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Disaster Cluster / Zone</label>
                      <input 
                        required type="text" placeholder="e.g. Northern Sector Floods"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={newResource.disasterZone}
                        onChange={(e) => setNewResource({...newResource, disasterZone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Specific Affected Area</label>
                      <input 
                        required type="text" placeholder="e.g. Devprayag Junction"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={newResource.affectedArea}
                        onChange={(e) => setNewResource({...newResource, affectedArea: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Type</label>
                        <select 
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newResource.type}
                          onChange={(e) => setNewResource({...newResource, type: e.target.value as any})}
                        >
                          <option value="team">Rescue Team</option>
                          <option value="personnel">Field Personnel</option>
                          <option value="equipment">Equipment</option>
                          <option value="vehicle">Vehicle</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Initial Status</label>
                        <select 
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newResource.status}
                          onChange={(e) => setNewResource({...newResource, status: e.target.value as any})}
                        >
                          <option value="on_standby">On Standby</option>
                          <option value="active">Active</option>
                          <option value="en_route">En Route</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Assign Field Officer</label>
                      <select 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                        value={newResource.assignedTo || ''}
                        onChange={(e) => setNewResource({...newResource, assignedTo: e.target.value})}
                      >
                        <option value="">Unassigned</option>
                        {users.filter(u => u.role === 'field').length > 0 ? (
                          users.filter(u => u.role === 'field').map(u => (
                            <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>
                          ))
                        ) : (
                          <>
                            <option value="default_1">Field Commander Alpha</option>
                            <option value="default_2">Response Lead Beta</option>
                            <option value="default_3">Logistics Head Gamma</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Latitude</label>
                        <input 
                          required type="number" step="any"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newResource.location?.lat}
                          onChange={(e) => setNewResource({...newResource, location: { ...newResource.location!, lat: parseFloat(e.target.value) }})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Longitude</label>
                        <input 
                          required type="number" step="any"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newResource.location?.lng}
                          onChange={(e) => setNewResource({...newResource, location: { ...newResource.location!, lng: parseFloat(e.target.value) }})}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Item Name</label>
                      <input 
                        required type="text" placeholder="e.g. Life Jackets"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newInventoryItem.name}
                        onChange={(e) => setNewInventoryItem({...newInventoryItem, name: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Category</label>
                        <select 
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newInventoryItem.category}
                          onChange={(e) => setNewInventoryItem({...newInventoryItem, category: e.target.value as any})}
                        >
                          <option value="medical">Medical</option>
                          <option value="rescue">Rescue</option>
                          <option value="shelter">Shelter</option>
                          <option value="rations">Rations</option>
                          <option value="vehicles">Vehicles</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Unit</label>
                        <input 
                          required type="text" placeholder="e.g. Kits, Units"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newInventoryItem.unit}
                          onChange={(e) => setNewInventoryItem({...newInventoryItem, unit: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Initial Quantity</label>
                        <input 
                          required type="number" min="0"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newInventoryItem.quantity}
                          onChange={(e) => setNewInventoryItem({...newInventoryItem, quantity: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Min Threshold</label>
                        <input 
                          required type="number" min="0"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                          value={newInventoryItem.minThreshold}
                          onChange={(e) => setNewInventoryItem({...newInventoryItem, minThreshold: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </>
                )}
                <button type="submit" className={`w-full text-white py-4 rounded-2xl font-bold transition-all shadow-lg ${activeTab === 'resources' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                  {activeTab === 'resources' ? 'Register Resource' : 'Add Inventory Item'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAlertModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAlertModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-bold">Broadcast Emergency Alert</h3>
                </div>
                <button onClick={() => setShowAlertModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSendAlert} className="p-8 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Alert Title</label>
                  <input 
                    required type="text" placeholder="e.g. Flash Flood Warning"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={newAlert.title}
                    onChange={(e) => setNewAlert({...newAlert, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Disaster Zone</label>
                    <input 
                      required type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                      value={newAlert.disasterZone}
                      onChange={(e) => setNewAlert({...newAlert, disasterZone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Affected Area</label>
                    <input 
                      required type="text" placeholder="e.g. Devprayag"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"
                      value={newAlert.affectedArea}
                      onChange={(e) => setNewAlert({...newAlert, affectedArea: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Severity Level</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['low', 'medium', 'high', 'critical'].map((s) => (
                      <button
                        key={s} type="button"
                        onClick={() => setNewAlert({...newAlert, severity: s as any})}
                        className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all ${
                          newAlert.severity === s 
                            ? 'bg-red-600 border-red-600 text-white shadow-md' 
                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Message</label>
                  <textarea 
                    required rows={3} placeholder="Provide detailed instructions for field units..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={newAlert.message}
                    onChange={(e) => setNewAlert({...newAlert, message: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200">
                  Broadcast Alert
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAssignModal && selectedResourceId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAssignModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-orange-600 p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  <h3 className="font-bold">Assign Operational Unit</h3>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-8">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Select Personnel for {resources.find(r => r.id === selectedResourceId)?.name}</p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {[
                    ...users.filter(u => u.role === 'field'),
                    { uid: 'default_water_rescue', name: 'Water Rescue Specialist', email: 'specialist@ndrf.gov.in' },
                    { uid: 'default_commander', name: 'Field Commander Alpha', email: 'standby@ndrf.gov.in' },
                    { uid: 'default_lead', name: 'Response Lead Beta', email: 'standby@ndrf.gov.in' },
                    { uid: 'default_logistics', name: 'Logistics Head Gamma', email: 'standby@ndrf.gov.in' }
                  ].map((u) => (
                    <button
                      key={u.uid}
                      onClick={() => handleAssignUser(selectedResourceId, u.uid)}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                        resources.find(r => r.id === selectedResourceId)?.assignedTo === u.uid
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{u.name}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{u.email}</p>
                      </div>
                      {resources.find(r => r.id === selectedResourceId)?.assignedTo === u.uid && (
                        <CheckCircle2 className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
