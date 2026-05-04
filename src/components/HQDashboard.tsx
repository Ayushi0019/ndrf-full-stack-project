import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Package, Truck, MapPin, Plus, 
  Search, Filter, Trash2, Edit3, Send,
  AlertTriangle, Shield, CheckCircle2, X,
  TrendingUp, Activity, Globe, Clock, Bell, PackagePlus,
  Image as ImageIcon, History, ClipboardList
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { UserProfile, Resource, EmergencyAlert, OperationType, ResourceRequest, InventoryItem, IncidentPhoto, DisasterIncident, OperationalLog } from '../types';
import { handleFirestoreError, formatTimestamp } from './Common';
import { getMockDb, updateMockDb, mockServerTimestamp } from '../lib/mockDb';

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
  const [logs, setLogs] = useState<OperationalLog[]>([]);
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyResourceId, setHistoryResourceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<Resource['type'] | 'all'>('all');

  // Form states
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    name: 'National NDRF Unit', 
    type: 'team', 
    status: 'on_standby', 
    location: { lat: 20.5937, lng: 78.9629 }, // Center of India
    disasterZone: '',
    affectedArea: ''
  });

  const [newIncident, setNewIncident] = useState<Partial<DisasterIncident>>({
    name: '',
    type: 'flood',
    severity: 'high',
    epicenter: { lat: 20.5937, lng: 78.9629 },
    radiusKm: 50
  });
  const [newAlert, setNewAlert] = useState<Partial<EmergencyAlert>>({
    title: '', 
    message: '', 
    severity: 'medium',
    disasterZone: '',
    affectedArea: ''
  });

  useEffect(() => {
    const fetchData = () => {
      const db = getMockDb();
      setResources(db.resources);
      setAlerts(db.alerts);
      setRequests(db.requests);
      setInventory(db.inventory);
      setPhotos(db.photos);
      setIncidents(db.incidents);
      setUsers(db.users);
      setLogs(db.logs);
      
      if (db.incidents.length > 0) {
        if (!activeIncident || !db.incidents.find(i => i.id === activeIncident.id)) {
          setActiveIncident(db.incidents[0]);
        }
      } else {
        setActiveIncident(null);
      }
      
      setLoading(false);
    };

    fetchData();
    window.addEventListener('mock-db-update', fetchData);
    return () => window.removeEventListener('mock-db-update', fetchData);
  }, [activeIncident]); 

  const handleUpdateStatus = (id: string, status: Resource['status']) => {
    const db = getMockDb();
    const updatedResources = db.resources.map(r => 
      r.id === id ? { ...r, status, lastUpdated: mockServerTimestamp() } : r
    );
    updateMockDb({ resources: updatedResources });
  };

  const handleAssignUser = (resourceId: string, userId: string) => {
    const db = getMockDb();
    const updatedResources = db.resources.map(r => 
      r.id === resourceId ? { ...r, assignedTo: userId, lastUpdated: mockServerTimestamp() } : r
    );
    updateMockDb({ resources: updatedResources });
    setShowAssignModal(false);
    setSelectedResourceId(null);
  };

  const handleDeleteResource = (id: string) => {
    setConfirmConfig({
      title: 'Decommission Asset?',
      message: 'Are you sure you want to remove this resource unit from active registry? This action is permanent.',
      onConfirm: () => {
        const db = getMockDb();
        updateMockDb({ resources: db.resources.filter(r => r.id !== id) });
        setShowConfirm(false);
      }
    });
    setShowConfirm(true);
  };

  const handleUpdateRequestStatus = (request: ResourceRequest, status: ResourceRequest['status']) => {
    const data = getMockDb();
    
    // Logic: If status is 'approved' or 'dispatched', attempt to subtract from inventory
    if ((status === 'approved' || status === 'dispatched') && request.status === 'pending') {
      const inventoryItem = data.inventory.find(i => 
        i.name.toLowerCase().includes((request.item || '').toLowerCase()) ||
        (request.item || '').toLowerCase().includes(i.name.toLowerCase())
      );
      
      if (inventoryItem) {
        const qtyToSubtract = Number(request.quantity) || 1;
        if (inventoryItem.quantity >= qtyToSubtract) {
          // Update global inventory
          const updatedInventory = data.inventory.map(i => 
            i.id === inventoryItem.id ? { ...i, quantity: Math.max(0, i.quantity - qtyToSubtract), lastUpdated: mockServerTimestamp() } : i
          );

          // Update team inventory
          let updatedResources = data.resources;
          if (request.resourceId) {
            const newItemKey = inventoryItem.name.toLowerCase().replace(/\s+/g, '_');
            updatedResources = data.resources.map(r => 
              r.id === request.resourceId ? { 
                ...r, 
                inventory: { ...(r.inventory || {}), [newItemKey]: (r.inventory?.[newItemKey] || 0) + qtyToSubtract },
                lastUpdated: mockServerTimestamp() 
              } : r
            );
          }
          
          updateMockDb({ inventory: updatedInventory, resources: updatedResources });
        }
      }
    }
    
    const updatedRequests = data.requests.map(r => 
      r.id === request.id ? { ...r, status, lastUpdated: mockServerTimestamp() } : r
    );
    updateMockDb({ requests: updatedRequests });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const db = getMockDb();
      const payload: DisasterIncident = {
        id: `inc-${Date.now()}`,
        name: newIncident.name || 'Unnamed Disaster',
        type: newIncident.type || 'flood',
        severity: newIncident.severity || 'high',
        epicenter: newIncident.epicenter || { lat: 20.5937, lng: 78.9629 },
        radiusKm: Number(newIncident.radiusKm) || 50,
        timestamp: mockServerTimestamp(),
        status: 'active',
        affectedClusters: []
      };
      
      updateMockDb({ incidents: [payload, ...db.incidents] });
      setShowAddIncidentModal(false);
      setNewIncident({ name: '', severity: 'high', epicenter: { lat: 30.7346, lng: 79.0669 }, radiusKm: 15 });
    } catch (err) {
      console.error('Add Incident Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const db = getMockDb();
    if (activeTab === 'resources') {
      const payload: Resource = {
        ...newResource as Resource,
        id: `res-${Date.now()}`,
        lastUpdated: mockServerTimestamp()
      };
      updateMockDb({ resources: [payload, ...db.resources] });
    } else {
      const payload: InventoryItem = {
        ...newInventoryItem as InventoryItem,
        id: `inv-${Date.now()}`,
        lastUpdated: mockServerTimestamp()
      };
      updateMockDb({ inventory: [payload, ...db.inventory] });
    }
    setShowAddModal(false);
    setNewResource({ 
      name: '', type: 'team', status: 'on_standby', 
      location: { lat: 30.7346, lng: 79.0669 },
      disasterZone: '', affectedArea: ''
    });
    setNewInventoryItem({ name: '', category: 'medical', quantity: 0, unit: '', minThreshold: 0 });
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
      onConfirm: () => {
        const data = getMockDb();
        updateMockDb({ requests: data.requests.filter(r => r.id !== id) });
        setShowConfirm(false);
      }
    });
    setShowConfirm(true);
  };

  const handleEndMission = (id: string) => {
    setConfirmConfig({
      title: 'End Mission / Archive Data?',
      message: 'This will mark the disaster as resolved and archive all associated operational data. Action is permanent.',
      onConfirm: () => {
        const data = getMockDb();
        // Update incident status to resolved
        const updatedIncidents = data.incidents.map(i => 
          i.id === id ? { ...i, status: 'resolved' as const } : i
        );
        
        // Archive associated alerts
        const activeIncidentObj = data.incidents.find(i => i.id === id);
        const updatedAlerts = data.alerts.map(a => 
          a.disasterZone === activeIncidentObj?.name ? { ...a, active: false } : a
        );

        updateMockDb({ 
          incidents: updatedIncidents,
          alerts: updatedAlerts
        });
        
        setShowConfirm(false);
        setActiveIncident(null);
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

  const handleSendAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const db = getMockDb();
    const payload: EmergencyAlert = {
      ...newAlert as EmergencyAlert,
      id: `alt-${Date.now()}`,
      active: true,
      timestamp: mockServerTimestamp()
    };
    updateMockDb({ alerts: [payload, ...db.alerts] });
    setShowAlertModal(false);
    setNewAlert({ title: '', message: '', severity: 'medium', disasterZone: '', affectedArea: '' });
  };

  const filteredResources = resources.filter(r => 
    (filterType === 'all' || r.type === filterType) &&
    (r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.disasterZone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     r.affectedArea?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUnassignUser = (resourceId: string) => {
    const data = getMockDb();
    const updated = data.resources.map(r => r.id === resourceId ? { ...r, assignedTo: undefined, lastUpdated: mockServerTimestamp() } : r);
    updateMockDb({ resources: updated });
  };

  const forceResetData = () => {
    setConfirmConfig({
      title: 'Factory Reset Mock Database?',
      message: 'This will purge all local data and restore NDRF specialized units to factory defaults. Use if you encounter missing units or "0 Total" errors.',
      onConfirm: () => {
        localStorage.removeItem('ndrf_mock_db');
        window.location.reload();
      }
    });
    setShowConfirm(true);
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
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* NDRF READY SUMMARY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total NDRF Assets', value: resources.length, color: 'text-white', bg: 'bg-slate-900 border-slate-800' },
          { label: 'Available / Standby', value: resources.filter(r => !r.assignedTo).length, color: 'text-green-500', bg: 'bg-green-500/5 border-green-500/20' },
          { label: 'Occupied / On Duty', value: resources.filter(r => r.assignedTo).length, color: 'text-orange-500', bg: 'bg-orange-500/5 border-orange-500/20' },
          { label: 'Active Engagements', value: resources.filter(r => r.status === 'active').length, color: 'text-red-500', bg: 'bg-red-500/5 border-red-500/20' }
        ].map(stat => (
          <div key={stat.label} className={`p-6 rounded-[2rem] border ${stat.bg} shadow-sm backdrop-blur-md`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</p>
            <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* AI Intelligence Header */}
      <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-600 p-2 rounded-xl animate-pulse">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight uppercase">National Tactical Command Center</h1>
            </div>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">Digital War Room • All-India Tactical Intelligence</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {incidents
                .filter(i => i.status !== 'resolved')
                .map(inc => (
                <button
                  key={inc.id}
                  onClick={() => setActiveIncident(inc)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    activeIncident?.id === inc.id 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/50' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {inc.type?.toUpperCase() || 'OPS'}: {inc.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-6 divide-x divide-white/10">
            <div className="pl-6 first:pl-0">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Threat Level</p>
              <p className={`text-xl font-black uppercase ${activeIncident?.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>
                {activeIncident?.severity || 'STANDBY'}
              </p>
            </div>
            <div className="pl-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Combat Zone</p>
              <p className="text-xl font-black text-white">{activeIncident?.radiusKm || 0} KM</p>
            </div>
            <div className="pl-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Asset Count</p>
              <p className="text-xl font-black text-white">{resources.filter(r => r.disasterZone === activeIncident?.name).length}</p>
            </div>
            <div className="pl-6 border-l border-white/10 flex items-center gap-4">
                <button 
                  onClick={forceResetData}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  title="Force Reset Data"
                >
                  Reset DB
                </button>
                {activeIncident && (
                  <button 
                    onClick={() => handleEndMission(activeIncident.id)}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-900/40 transition-all active:scale-95 group"
                  >
                    <CheckCircle2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                    End Mission
                  </button>
                )}
              </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Map View - 3 Columns */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden h-[650px] relative">
            <div className="absolute top-6 left-6 z-[40] space-y-3">
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
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
                          r.type === 'team' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
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
                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-tight bg-blue-50 px-2 py-1 rounded w-fit">
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
                    className={`flex items-center gap-3 transition-all ${activeTab === tab ? 'text-blue-600 scale-105' : 'text-slate-300'}`}
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
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Radius</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {incidents
                        .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => (a.status === 'resolved' ? 1 : -1))
                        .map((incident) => (
                        <tr key={incident.id} className="hover:bg-gray-50 transition-all group">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-gray-900">{incident.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              incident.severity === 'critical' ? 'bg-red-100 text-red-600' :
                              incident.severity === 'high' ? 'bg-blue-100 text-blue-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {incident.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              incident.status === 'resolved' ? 'bg-gray-100 text-gray-400' :
                              incident.status === 'active' ? 'bg-green-100 text-green-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {incident.status || 'active'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-gray-500">{incident.radiusKm} km</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {incident.status !== 'resolved' && (
                              <button 
                                onClick={() => handleEndMission(incident.id)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                title="Resolve Incident"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
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
                                resource.type === 'team' ? 'bg-blue-100 text-blue-600' :
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
                                  resource.status === 'on_duty' ? 'bg-blue-600' :
                                  resource.status === 'near_disaster' ? 'bg-orange-500' :
                                  resource.status === 'en_route' ? 'bg-cyan-500' :
                                  resource.status === 'at_rest' ? 'bg-indigo-500' : 'bg-slate-400'
                                }`} />
                                <span className="text-xs font-bold text-gray-700 uppercase">{resource.status.replace('_', ' ')}</span>
                              </div>
                              <div className="text-[10px] text-blue-600 font-black uppercase tracking-tight bg-blue-50 px-1.5 py-0.5 rounded leading-none w-fit">
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
                                  setHistoryResourceId(resource.id);
                                  setShowHistoryModal(true);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Operation History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedResourceId(resource.id);
                                  setShowAssignModal(true);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
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
                        .reduce((acc: any[], curr) => {
                          const existing = acc.find(item => item.name.toLowerCase() === curr.name.toLowerCase());
                          if (existing) {
                            existing.quantity += curr.quantity;
                            return acc;
                          }
                          
                          // Calculate global field usage
                          const fieldUsage = resources.reduce((usageAcc, res) => {
                            const resInv = res.inventory || {};
                            const key = curr.name.toLowerCase().replace(/\s+/g, '_');
                            return usageAcc + (resInv[key] || 0);
                          }, 0);

                          return [...acc, { ...curr, fieldQuantity: fieldUsage }];
                        }, [])
                        .map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-all group">
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 text-sm block">{item.name}</span>
                            <span className="text-[9px] text-gray-400 font-bold uppercase">Asset Cluster</span>
                          </td>
                          <td className="px-6 py-4 uppercase text-[10px] font-bold text-gray-400">{item.category}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-6">
                              <div>
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">HQ Stock</p>
                                <span className={`text-sm font-black ${item.quantity <= (item.minThreshold || 0) ? 'text-red-600' : 'text-gray-900'}`}>
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                              <div className="w-px h-6 bg-gray-100" />
                              <div>
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">In Field</p>
                                <span className="text-sm font-black text-blue-600">
                                  {item.fieldQuantity} {item.unit}
                                </span>
                                {item.fieldQuantity > 0 && (
                                  <span className="ml-2 text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg font-black uppercase">Active</span>
                                )}
                              </div>
                              <div className="w-px h-6 bg-gray-100" />
                              <div>
                                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Global Total</p>
                                <span className="text-sm font-black text-gray-900">
                                  {item.quantity + item.fieldQuantity}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-[10px] font-bold text-gray-400">
                            {formatTimestamp(item.lastUpdated, 'date')}
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
                <Globe className="w-4 h-4 text-blue-600" />
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
                        <p className="text-[10px] text-blue-600 font-black uppercase">{r.disasterZone}</p>
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
              <TrendingUp className="w-5 h-5 text-blue-600" />
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
                <Activity className="w-5 h-5 text-red-600" />
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Operational Intelligence</h3>
              </div>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {/* Combine Logs and Alerts */}
              {[
                ...alerts.map(a => ({ ...a, type: 'alert' })),
                ...logs.map(l => ({ ...l, type: 'log' }))
              ]
              .sort((a: any, b: any) => {
                const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : (ts ? new Date(ts).getTime() : 0);
                return getTime(b.timestamp) - getTime(a.timestamp);
              })
              .slice(0, 15)
              .map((item: any) => (
                <div key={item.id} className={`p-4 rounded-2xl border-l-4 ${
                  item.type === 'alert' 
                    ? item.severity === 'critical' ? 'bg-red-50 border-red-600' : 'bg-blue-50 border-blue-600'
                    : item.details?.type === 'arrival' ? 'bg-green-50 border-green-600' : 'bg-blue-50 border-blue-600'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      item.type === 'alert' 
                        ? item.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        : item.details?.type === 'arrival' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.type === 'alert' ? `ALERT: ${item.severity}` : `REPORT: ${item.type.toUpperCase()}`}
                    </span>
                    <span className="text-[8px] text-gray-400 font-bold">{formatTimestamp(item.timestamp, 'time')}</span>
                  </div>
                  <h4 className="text-[11px] font-bold text-gray-900 mb-1 leading-tight">
                    {item.type === 'alert' ? item.title : item.message}
                  </h4>
                  <p className="text-[9px] text-blue-600 font-black uppercase leading-none">
                    {item.type === 'alert' ? item.disasterZone : item.resourceName}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <PackagePlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Global Requests</h3>
              </div>
              <button 
                onClick={() => setShowGlobalRequests(true)}
                className="text-[10px] font-black text-blue-600 uppercase hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {requests.filter(r => r.status === 'pending').slice(0, 5).map((request) => (
                <div key={request.id} className="p-4 rounded-3xl border border-gray-100 bg-gray-50/50 space-y-3 transition-all hover:border-blue-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-gray-900">{request.item}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-blue-600">Qty: {request.quantity}</span>
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
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Ground Proof</h3>
              </div>
              <button 
                onClick={() => setShowGroundProof(true)}
                className="text-[10px] font-black text-blue-600 uppercase hover:underline"
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
                  <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
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
                            request.priority === 'critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                          }`}>{request.priority}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateRequestStatus(request, 'approved')}
                        className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
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
                          <p className="text-[10px] text-gray-500 font-bold uppercase">{photo.uploadedBy} • {formatTimestamp(photo.timestamp, 'time')}</p>
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
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-blue-500" />
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
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
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
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase">Declare National Incident</h3>
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-1">Strategic Command Override</p>
                </div>
                <button onClick={() => setShowAddIncidentModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleAddIncident} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Operation Name</label>
                  <input 
                    required type="text" placeholder="e.g. Cyclone Relief 2024"
                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none"
                    value={newIncident.name}
                    onChange={(e) => setNewIncident({...newIncident, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Category</label>
                    <select 
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold outline-none uppercase"
                      value={newIncident.type}
                      onChange={(e) => setNewIncident({...newIncident, type: e.target.value as any})}
                    >
                      <option value="flood">Flood</option>
                      <option value="cyclone">Cyclone</option>
                      <option value="earthquake">Earthquake</option>
                      <option value="landslide">Landslide</option>
                      <option value="fire">Fire</option>
                      <option value="tsunami">Tsunami</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Severity</label>
                    <select 
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none"
                      value={newIncident.severity}
                      onChange={(e) => setNewIncident({...newIncident, severity: e.target.value as any})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  {activeTab === 'resources' ? <Shield className="w-5 h-5 text-blue-500" /> : <Package className="w-5 h-5 text-blue-500" />}
                  <h3 className="font-bold uppercase tracking-widest text-xs">{activeTab === 'resources' ? 'Strategic Asset Enrollment' : 'Logistics Entry'}</h3>
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newResource.disasterZone}
                        onChange={(e) => setNewResource({...newResource, disasterZone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Specific Affected Area</label>
                      <input 
                        required type="text" placeholder="e.g. Devprayag Junction"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <button type="submit" className={`w-full text-white py-4 rounded-2xl font-bold transition-all shadow-lg ${activeTab === 'resources' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
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
              <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
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
                          ? 'border-blue-600 bg-blue-50'
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
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showHistoryModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col"
            >
              <div className="p-8 bg-gray-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <History className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{resources.find(r => r.id === historyResourceId)?.name}</h3>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Operational Chronicle</p>
                  </div>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Stats Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Logs</p>
                    <p className="text-2xl font-black text-gray-900">
                      {logs.filter(l => l.resourceId === historyResourceId && l.type === 'status_change').length}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Signals</p>
                    <p className="text-2xl font-black text-gray-900">
                      {logs.filter(l => l.resourceId === historyResourceId).length}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Timeline</h4>
                  {logs.filter(l => l.resourceId === historyResourceId).length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-px before:bg-gray-100">
                      {logs
                        .filter(l => l.resourceId === historyResourceId)
                        .sort((a, b) => {
                          const timeA = typeof a.timestamp?.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp as any).getTime();
                          const timeB = typeof b.timestamp?.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp as any).getTime();
                          return timeB - timeA;
                        })
                        .map((log) => (
                        <div key={log.id} className="relative pl-10">
                          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${
                            log.type === 'status_change' ? 'bg-blue-500' :
                            log.type === 'arrival' ? 'bg-green-500' :
                            log.type === 'usage' ? 'bg-orange-500' : 'bg-gray-400'
                          }`}>
                            {log.type === 'status_change' ? <TrendingUp className="w-2 h-2 text-white" /> :
                             log.type === 'arrival' ? <MapPin className="w-2 h-2 text-white" /> :
                             <Activity className="w-2 h-2 text-white" />}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-gray-400 uppercase">{log.type.replace('_', ' ')}</span>
                              <span className="text-[10px] font-bold text-gray-400">{formatTimestamp(log.timestamp)}</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900">{log.message}</p>
                            {log.location && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg w-fit">
                                <MapPin className="w-2.5 h-2.5 text-gray-400" />
                                <span className="text-[9px] font-bold text-gray-500">{log.location.lat.toFixed(4)}, {log.location.lng.toFixed(4)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="w-8 h-8 text-gray-200" />
                      </div>
                      <p className="text-gray-400 font-bold">No historical data available for this resource.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
