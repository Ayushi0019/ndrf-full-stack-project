import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Clock, Shield, AlertTriangle, 
  Navigation, CheckCircle2, Info, Send,
  LayoutDashboard, Map as MapIcon, Bell, PackagePlus,
  Camera, Image as ImageIcon, X, Plus, Users, Waves, ChevronRight, Activity, Globe, Search
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UserProfile, Resource, EmergencyAlert, OperationType, ResourceRequest, IncidentPhoto, OperationalLog, DisasterIncident } from '../types';
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

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

export const FieldDashboard = ({ user }: { user: UserProfile }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'map' | 'alerts' | 'requests' | 'evidence'>('status');
  const [searchTerm, setSearchTerm] = useState('');
  const [myTeam, setMyTeam] = useState<Resource | null>(null);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [incidents, setIncidents] = useState<DisasterIncident[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const [inventory, setInventory] = useState<{name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [establishingCommand, setEstablishingCommand] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
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
    const fetchData = () => {
      const db = getMockDb();
      
      const team = db.resources.find(r => r.assignedTo === user.uid) || null;
      setMyTeam(team);
      
      setAllResources(db.resources);
      setAlerts(db.alerts.filter(a => a.active));
      setIncidents(db.incidents.filter(i => i.status === 'active'));
      setRequests(db.requests.filter(r => r.requesterId === user.uid));
      setInventory(db.inventory.map(i => ({ name: i.name })));
      
      if (team?.id) {
        setPhotos(db.photos.filter(p => p.resourceId === team.id));
      } else {
        setPhotos(db.photos);
      }
      
      setLoading(false);
    };

    fetchData();
    const handleUpdate = () => fetchData();
    window.addEventListener('mock-db-update', handleUpdate);
    return () => window.removeEventListener('mock-db-update', handleUpdate);
  }, [user.uid]);

  const filteredResources = (allResources || []).filter(r => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;
    return (
      r.name.toLowerCase().includes(searchLower) ||
      r.type.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const db = getMockDb();
    
    const payload: ResourceRequest = {
      id: `req-${Date.now()}`,
      item: newRequest.item,
      quantity: Number(newRequest.quantity),
      priority: newRequest.priority,
      status: 'pending',
      disasterZone: myTeam?.disasterZone || 'General Mission',
      affectedArea: myTeam?.affectedArea || 'Unknown Sector',
      requestedBy: user.name,
      requesterId: user.uid,
      resourceId: myTeam?.id || null,
      timestamp: mockServerTimestamp(),
      location: myTeam?.location || { lat: 20.5937, lng: 78.9629 }
    };
    
    updateMockDb({ requests: [payload, ...db.requests] });
    setShowRequestForm(false);
    setNewRequest({ item: '', quantity: 1, priority: 'medium' });
  };

  const handleUploadPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTeam) return;
    const db = getMockDb();

    const payload: IncidentPhoto = {
      id: `img-${Date.now()}`,
      ...newPhoto,
      uploadedBy: user.name,
      timestamp: mockServerTimestamp(),
      location: myTeam.location,
      disasterZone: myTeam.disasterZone || 'Active Mission',
      resourceId: myTeam.id
    };
    updateMockDb({ photos: [payload, ...db.photos] });
    setShowPhotoForm(false);
    setNewPhoto({ url: '', caption: '' });
  };

  const handleClaimUnit = (id: string) => {
    setEstablishingCommand(true);
    setSearchTerm('');
    setShowSelector(false);
    
    setTimeout(() => {
      const data = getMockDb();
      const targetResource = data.resources.find(r => r.id === id);
      if (!targetResource) {
        setEstablishingCommand(false);
        return;
      }

      const updated = data.resources.map(r => {
        if (r.id === id) return { ...r, assignedTo: user.uid, lastUpdated: mockServerTimestamp() };
        if (r.assignedTo === user.uid) return { ...r, assignedTo: undefined };
        return r;
      });

      updateMockDb({ resources: updated });
      setMyTeam({ ...targetResource, assignedTo: user.uid });
      
      setTimeout(() => {
        setEstablishingCommand(false);
        // Stay on status tab so user sees the active mission dashboard immediately
      }, 1500);
    }, 1200);
  };

  const handleUnassign = () => {
    if (!myTeam) return;
    const data = getMockDb();
    const updated = data.resources.map(r => 
      r.id === myTeam.id ? { ...r, assignedTo: undefined } : r
    );
    updateMockDb({ resources: updated });
    setMyTeam(null);
  };

  const updateStatus = (status: Resource['status']) => {
    if (!myTeam) return;
    
    setConfirmConfig({
      title: 'Update Operational Status?',
      message: `Directly notify National HQ of status transition to ${status.replace('_', ' ').toUpperCase()}?`,
      onConfirm: () => {
        const data = getMockDb();
        const updatedResources = data.resources.map(r => 
          r.id === myTeam.id ? { ...r, status, lastUpdated: mockServerTimestamp() } : r
        );
        
        const log: OperationalLog = {
          id: `log-${Date.now()}`,
          type: 'status_change',
          message: `${myTeam.name} updated status to ${status.replace('_', ' ')}`,
          resourceId: myTeam.id,
          resourceName: myTeam.name,
          timestamp: mockServerTimestamp(),
          location: myTeam.location,
          details: { previousStatus: myTeam.status, newStatus: status }
        };

        updateMockDb({ resources: updatedResources, logs: [log, ...data.logs] });
        setShowConfirm(false);
      }
    });
    setShowConfirm(true);
  };

  const handleConsumeItem = (itemKey: string) => {
    if (!myTeam || !myTeam.inventory) return;
    const data = getMockDb();
    const currentQty = (myTeam.inventory as any)[itemKey] || 0;
    const newQty = Math.max(0, currentQty - 1);
    
    const updatedResources = data.resources.map(r => 
      r.id === myTeam.id ? { 
        ...r, 
        inventory: { ...(r.inventory || {}), [itemKey]: newQty },
        lastUpdated: mockServerTimestamp() 
      } : r
    );

    // Log usage
    const log: OperationalLog = {
      id: `log-${Date.now()}`,
      type: 'usage',
      message: `${myTeam.name} reported usage of ${itemKey.replace(/_/g, ' ')}`,
      resourceId: myTeam.id,
      resourceName: myTeam.name,
      timestamp: mockServerTimestamp(),
      location: myTeam.location,
      details: { item: itemKey, previousQty: currentQty, newQty }
    };

    updateMockDb({ 
      resources: updatedResources,
      logs: [log, ...data.logs]
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Mobile Header Stats */}
      <div className="p-6 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Field Ops</h2>
          <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Local Instance
          </div>
        </div>

        {myTeam && (
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="absolute top-4 right-4">
              <button 
                onClick={handleUnassign}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white"
                title="Switch Operational Unit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 pr-6">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">
                  Tactical Lead
                </p>
                <h3 className="text-lg font-bold leading-tight">{myTeam.name}</h3>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase text-blue-400 tracking-tighter">
                    {myTeam.disasterZone || 'National Tier-1 Asset'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Operational Area</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span className="text-xs font-bold uppercase truncate">{myTeam.affectedArea || 'Global Theatre'}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    myTeam.status === 'active' ? 'bg-green-500' : 
                    myTeam.status === 'on_duty' ? 'bg-blue-500' : 
                    myTeam.status === 'near_disaster' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-xs font-bold uppercase">
                    {myTeam.status.replace('_', ' ')}
                  </span>
                </div>
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
              className="space-y-6 relative"
            >
              {establishingCommand && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 text-center"
                >
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      boxShadow: ["0 0 0px rgba(59, 130, 246, 0.5)", "0 0 40px rgba(59, 130, 246, 0.8)", "0 0 0px rgba(59, 130, 246, 0.5)"]
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-white mb-6"
                  >
                    <Shield className="w-12 h-12" />
                  </motion.div>
                  <motion.h2 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-2xl font-black text-white uppercase tracking-tighter"
                  >
                    {myTeam ? 'Verification Successful' : 'Establishing Command...'}
                  </motion.h2>
                  <p className="text-blue-400 font-bold uppercase tracking-widest text-xs mt-2">
                    {myTeam ? `System Online: ${myTeam.name}` : 'Syncing Tactical Metadata with HQ'}
                  </p>
                  
                  {myTeam && (
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="w-48 h-1 bg-blue-500 mt-8 rounded-full"
                    />
                  )}
                </motion.div>
              )}

              {!myTeam ? (
                <div className="space-y-8 py-4">
                  {/* HERO HEADER */}
                  <div className="relative p-10 bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Globe className="w-32 h-32 text-blue-400" />
                    </div>
                    <div className="relative z-10 text-center">
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/50">
                          <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">National Disaster Response Force</span>
                      </div>
                      <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-4">Tactical Activation <br/><span className="text-blue-500">Portal</span></h1>
                      <p className="text-slate-400 text-[10px] font-bold leading-relaxed max-w-xs mx-auto uppercase tracking-wider">
                        Authorized level-3 clearance required. Please select your assigned operational unit to initiate field reporting.
                      </p>
                    </div>
                  </div>

                  {/* SEARCHABLE DROPDOWN FEATURE */}
                  <div className="relative z-40 px-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-4">Authorized Registry Search</label>
                    
                    <div className="relative">
                      <div 
                        onClick={() => setShowSelector(!showSelector)}
                        className={`w-full p-6 bg-white border-2 rounded-[2rem] flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                          showSelector ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Search className="w-5 h-5 text-slate-400" />
                          <span className="text-sm font-black text-slate-600 uppercase tracking-tight">Select operational unit...</span>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${showSelector ? 'rotate-90' : ''}`} />
                      </div>

                      {showSelector && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-2xl overflow-hidden z-50 ring-1 ring-black/5"
                        >
                          <div className="p-4 border-b border-slate-50">
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                autoFocus
                                type="text"
                                placeholder="Start typing team name..."
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-0 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="max-h-[35vh] overflow-y-auto p-2 overscroll-contain">
                            {filteredResources.map(res => {
                              const isOccupied = !!res.assignedTo && res.assignedTo !== user.uid;
                              return (
                                <button
                                  key={res.id}
                                  onClick={() => !isOccupied && handleClaimUnit(res.id)}
                                  disabled={isOccupied}
                                  className={`w-full p-5 rounded-2xl flex items-center justify-between transition-all text-left mb-1 group ${
                                    isOccupied 
                                      ? 'bg-slate-50 opacity-40 cursor-not-allowed' 
                                      : 'hover:bg-blue-50 hover:pl-8 active:scale-[0.98]'
                                  }`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                                      isOccupied ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-400 group-hover:bg-blue-600 group-hover:text-white shadow-sm'
                                    }`}>
                                      {res.type === 'aircraft' ? <Navigation className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-slate-900 leading-none mb-1 uppercase tracking-tight">{res.name}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{isOccupied ? 'Unit Occupied' : res.type}</p>
                                    </div>
                                  </div>
                                  {!isOccupied && <CheckCircle2 className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* QUICK STATS */}
                  <div className="grid grid-cols-2 gap-4 px-2">
                    <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Assets</p>
                      <p className="text-2xl font-black text-blue-900">{allResources.length}</p>
                    </div>
                    <div className="p-6 bg-green-50 rounded-[2rem] border border-green-100">
                      <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-1">Available Units</p>
                      <p className="text-2xl font-black text-green-900">{allResources.filter(r => !r.assignedTo).length}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ACTIVE MISSION THEME HEADER */}
                  <div className="p-8 bg-blue-600 rounded-[3rem] text-white shadow-[0_20px_50px_rgba(37,99,235,0.3)] relative overflow-hidden">
                    <div className="absolute -bottom-10 -right-10 opacity-20">
                      <Shield className="w-48 h-48" />
                    </div>
                    <div className="flex items-start justify-between relative z-10">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full w-fit border border-white/30">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Active Operational Core</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase leading-[0.9]">{myTeam.name}</h2>
                        <div className="flex items-center gap-4 text-white/70">
                          <div className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-widest">
                            <MapPin className="w-3 h-3" />
                            {myTeam.disasterZone || 'Active Grid'}
                          </div>
                          <div className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-widest">
                            <Activity className="w-3 h-3 transition-transform" />
                            {myTeam.status.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={handleUnassign}
                        className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-red-500 hover:text-white text-white/70 flex items-center justify-center transition-all group"
                      >
                        <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 flex flex-col items-center gap-3 hover:border-blue-500 hover:shadow-lg transition-all group">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Waves className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-600">Unit Tasks</span>
                    </button>
                    <button className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 flex flex-col items-center gap-3 hover:border-blue-500 hover:shadow-lg transition-all group">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-600">Personnel</span>
                    </button>
                  </div>

                  {/* STATUS CONTROLS - RE-THEMED */}
                  <div className="space-y-3 pt-4">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-4">Command Logs & Status</p>
                    <div className="grid gap-2">
                       {[
                        { id: 'active', label: 'ENGAGED', icon: Shield, color: 'bg-green-600' },
                        { id: 'on_duty', label: 'ON DUTY', icon: Navigation, color: 'bg-blue-600' },
                        { id: 'near_disaster', label: 'AO REACHED', icon: MapPin, color: 'bg-orange-600' },
                        { id: 'on_standby', label: 'STANDBY', icon: Clock, color: 'bg-slate-700' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => updateStatus(opt.id as Resource['status'])}
                          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                            myTeam?.status === opt.id 
                              ? 'border-blue-600 bg-blue-50 shadow-sm' 
                              : 'border-slate-50 bg-white hover:border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${opt.color}`}>
                              <opt.icon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{opt.label}</span>
                          </div>
                          {myTeam?.status === opt.id && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-[65vh] rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative"
            >
              <MapContainer 
                center={myTeam?.location ? [myTeam.location.lat, myTeam.location.lng] : [20.5937, 78.9629]} 
                zoom={myTeam?.location ? 13 : 5} 
                className="h-full w-full z-10"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {myTeam && (
                  <Marker position={[myTeam.location.lat, myTeam.location.lng]}>
                    <Popup>
                      <div className="p-1">
                        <p className="font-bold text-gray-900">{myTeam.name}</p>
                        <p className="text-[9px] text-blue-600 font-black uppercase tracking-tighter mb-1">{myTeam.disasterZone}</p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                          <MapPin className="w-2 h-2" />
                          {myTeam.affectedArea}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {/* Show Incidents as circles/markers */}
                {incidents.map(inc => (
                  <Marker 
                    key={inc.id} 
                    position={[inc.epicenter.lat, inc.epicenter.lng]}
                    icon={L.divIcon({
                      className: 'bg-transparent',
                      html: `<div class="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 animate-pulse flex items-center justify-center">
                              <div class="w-2 h-2 bg-red-600 rounded-full"></div>
                            </div>`,
                      iconSize: [32, 32]
                    })}
                  >
                    <Popup>
                      <div className="p-1">
                        <p className="font-black text-red-600 uppercase text-[10px]">{inc.type}</p>
                        <p className="font-bold text-gray-900">{inc.name}</p>
                        <p className="text-[9px] text-gray-500 uppercase mt-1">Severity: {inc.severity}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Show all resources as small blips */}
                {allResources.filter(r => r.id !== myTeam?.id).map(res => (
                  <Marker 
                    key={res.id} 
                    position={[res.location.lat, res.location.lng]}
                    opacity={0.7}
                    icon={L.divIcon({
                      className: 'bg-transparent',
                      html: `<div class="w-4 h-4 rounded-full ${res.assignedTo ? 'bg-blue-600' : 'bg-slate-400'} border border-white"></div>`,
                      iconSize: [16, 16]
                    })}
                  >
                    <Popup>
                      <div className="p-1">
                        <p className="font-bold text-gray-800 text-xs">{res.name}</p>
                        <p className="text-[8px] uppercase font-black text-gray-400 mb-2">{res.type} • {res.status}</p>
                        {!res.assignedTo && (
                          <button 
                            onClick={() => handleClaimUnit(res.id)}
                            className="w-full py-1.5 bg-blue-600 text-white text-[8px] font-black uppercase rounded-lg shadow-sm"
                          >
                            Command Asset
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {myTeam?.location && <RecenterMap center={[myTeam.location.lat, myTeam.location.lng]} />}
              </MapContainer>

              {!myTeam && (
                <div className="absolute inset-x-0 bottom-0 z-30 p-6 pointer-events-none">
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-blue-100 shadow-2xl pointer-events-auto flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase">No Active Command</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Select unit to enable tactical reporting</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('status')}
                      className="px-5 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                    >
                      Assign Unit
                    </button>
                  </motion.div>
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
                    alert.severity === 'high' ? 'bg-blue-50 border-blue-600' : 'bg-slate-50 border-slate-600'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.severity === 'critical' ? 'text-red-600' : 'text-blue-600'
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
              {!myTeam ? (
                <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                  <PackagePlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Needs Reporting Locked</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter max-w-[200px] mx-auto">
                    You must command an asset to report logistical requirements to HQ
                  </p>
                  <button 
                    onClick={() => setActiveTab('status')}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                  >
                    Go to Asset Registry
                  </button>
                </div>
              ) : (
                <>
                  {myTeam.inventory && Object.keys(myTeam.inventory).length > 0 && (
                    <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Team Assets</h3>
                        <div className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-lg">IN-FIELD</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(myTeam.inventory).map(([item, qty]) => (
                          <div key={item} className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex flex-col gap-2 transition-all hover:border-blue-300">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-gray-900 uppercase truncate pr-1">{item.replace(/_/g, ' ')}</span>
                              <span className="text-sm font-black text-blue-600">{qty}</span>
                            </div>
                            <button 
                              onClick={() => handleConsumeItem(item)}
                              disabled={Number(qty) <= 0}
                              type="button"
                              className="w-full py-1.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg text-[8px] font-black uppercase transition-all disabled:opacity-30"
                            >
                              Report Usage (-1)
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Resource Requirements</h3>
                    <button 
                      onClick={() => setShowRequestForm(!showRequestForm)}
                      className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200"
                    >
                      {showRequestForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>

                  {showRequestForm && (
                    <form onSubmit={handleCreateRequest} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-xl space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Resource Needed</label>
                        <input 
                          required type="text" 
                          placeholder="Select or type item..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={newRequest.item}
                          onChange={(e) => setNewRequest({...newRequest, item: e.target.value})}
                          list="inventory-suggestions"
                        />
                        <datalist id="inventory-suggestions">
                          {inventory.map((item, idx) => (
                            <option key={idx} value={item.name} />
                          ))}
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
                              request.priority === 'critical' ? 'text-red-500' : 'text-blue-500'
                            }`} />
                            <span className="text-[9px] font-bold text-gray-500 uppercase">{request.priority}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-[9px] font-bold text-gray-500 uppercase">
                              {formatTimestamp(request.timestamp, 'time')}
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
                </>
              )}
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
              {!myTeam ? (
                <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                  <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Evidence Uploads Locked</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter max-w-[200px] mx-auto">
                    A tactical asset must be under your command to submit photo proofs to Command HQ
                  </p>
                  <button 
                    onClick={() => setActiveTab('status')}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                  >
                    Select Operational Asset
                  </button>
                </div>
              ) : (
                <>
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
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
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
                            {formatTimestamp(photo.timestamp, 'date')}
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
                </>
              )}
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
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-around items-center z-50">
        {[
          { id: 'map', icon: MapIcon, label: 'Ops' },
          { id: 'status', icon: Shield, label: 'Command' },
          { id: 'requests', icon: PackagePlus, label: 'Needs' },
          { id: 'evidence', icon: Camera, label: 'Proof' },
          { id: 'alerts', icon: Bell, label: 'Alerts', badge: alerts.length > 0 }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
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
