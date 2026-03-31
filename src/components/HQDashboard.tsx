import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Package, Truck, MapPin, Plus, 
  Search, Filter, Trash2, Edit3, Send,
  AlertTriangle, Shield, CheckCircle2, X,
  TrendingUp, Activity, Globe
} from 'lucide-react';
import { 
  collection, onSnapshot, query, orderBy, 
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
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

export const HQDashboard = ({ user }: { user: UserProfile }) => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<Resource['type'] | 'all'>('all');

  // Form states
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    name: '', type: 'team', status: 'on_standby', location: { lat: 28.6139, lng: 77.2090 }
  });
  const [newAlert, setNewAlert] = useState<Partial<EmergencyAlert>>({
    title: '', message: '', severity: 'medium'
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

    return () => {
      unsubResources();
      unsubAlerts();
    };
  }, []);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'resources'), {
        ...newResource,
        lastUpdated: serverTimestamp()
      });
      setShowAddModal(false);
      setNewResource({ name: '', type: 'team', status: 'on_standby', location: { lat: 28.6139, lng: 77.2090 } });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'resources');
    }
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
      setNewAlert({ title: '', message: '', severity: 'medium' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'alerts');
    }
  };

  const deleteResource = async (id: string) => {
    if (!confirm('Are you sure you want to remove this resource?')) return;
    try {
      await deleteDoc(doc(db, 'resources', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${id}`);
    }
  };

  const filteredResources = resources.filter(r => 
    (filterType === 'all' || r.type === filterType) &&
    (r.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Resources</p>
            <p className="text-2xl font-black text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Units</p>
            <p className="text-2xl font-black text-gray-900">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En Route</p>
            <p className="text-2xl font-black text-gray-900">{stats.enRoute}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">On Standby</p>
            <p className="text-2xl font-black text-gray-900">{stats.standby}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Management */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-gray-900">Resource Inventory</h3>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Resource
                </button>
                <button 
                  onClick={() => setShowAlertModal(true)}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition-all"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Send Alert
                </button>
              </div>
            </div>

            <div className="p-6 border-b border-gray-50 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search resources..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select 
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                  <option value="all">All Types</option>
                  <option value="team">Rescue Teams</option>
                  <option value="equipment">Equipment</option>
                  <option value="vehicle">Vehicles</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Resource</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Last Updated</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredResources.map((resource) => (
                    <tr key={resource.id} className="hover:bg-gray-50 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            resource.type === 'team' ? 'bg-orange-100 text-orange-600' :
                            resource.type === 'vehicle' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {resource.type === 'team' ? <Users className="w-4 h-4" /> :
                             resource.type === 'vehicle' ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                          </div>
                          <span className="font-bold text-gray-900 text-sm">{resource.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{resource.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            resource.status === 'active' ? 'bg-green-500' : 
                            resource.status === 'en_route' ? 'bg-blue-500' : 'bg-yellow-500'
                          }`} />
                          <span className="text-xs font-bold text-gray-700 uppercase">{resource.status.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-400">{resource.lastUpdated?.toDate().toLocaleString() || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteResource(resource.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Map View */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-[500px] relative">
            <div className="absolute top-4 left-4 z-[40] bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold text-gray-900 uppercase tracking-widest">Global Deployment Map</span>
              </div>
            </div>
            <MapContainer center={[28.6139, 77.2090]} zoom={5} className="h-full w-full z-10">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {resources.map((r) => (
                <Marker key={r.id} position={[r.location.lat, r.location.lng]}>
                  <Popup>
                    <div className="p-2">
                      <p className="font-bold text-gray-900">{r.name}</p>
                      <p className="text-[10px] uppercase font-bold text-orange-600 mb-2">{r.status}</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          r.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-[10px] text-gray-500">Live Location Tracking</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Right Column: Analytics & Alerts */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-gray-900">Deployment Analytics</h3>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f9fafb' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-gray-900">Recent Alerts</h3>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last 24h</span>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-2xl border-l-4 ${
                  alert.severity === 'critical' ? 'bg-red-50 border-red-600' :
                  alert.severity === 'high' ? 'bg-orange-50 border-orange-600' : 'bg-blue-50 border-blue-600'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold">{alert.timestamp?.toDate().toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 mb-1">{alert.title}</h4>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
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
                  <Plus className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold">Register New Resource</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddResource} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Resource Name</label>
                  <input 
                    required type="text" placeholder="e.g. NDRF Team 07"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newResource.name}
                    onChange={(e) => setNewResource({...newResource, name: e.target.value})}
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
                <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200">
                  Register Resource
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
              <form onSubmit={handleSendAlert} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Alert Title</label>
                  <input 
                    required type="text" placeholder="e.g. Flash Flood Warning"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={newAlert.title}
                    onChange={(e) => setNewAlert({...newAlert, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Severity Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high', 'critical'].map((s) => (
                      <button
                        key={s} type="button"
                        onClick={() => setNewAlert({...newAlert, severity: s as any})}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border-2 transition-all ${
                          newAlert.severity === s 
                            ? 'bg-red-600 border-red-600 text-white' 
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
      </AnimatePresence>
    </div>
  );
};
