import { Resource, UserProfile, EmergencyAlert, ResourceRequest, InventoryItem, IncidentPhoto, DisasterIncident, OperationalLog } from '../types';

const STORAGE_KEY = 'ndrf_mock_db';

interface MockData {
  resources: Resource[];
  users: UserProfile[];
  alerts: EmergencyAlert[];
  requests: ResourceRequest[];
  inventory: InventoryItem[];
  photos: IncidentPhoto[];
  incidents: DisasterIncident[];
  logs: OperationalLog[];
}

const DEFAULT_DATA: MockData = {
  resources: [
    // Flood & Water Rescue Teams
    { id: 'fwr-1', name: 'Flood Rescue Team 1 (FRT-1)', type: 'team', status: 'active', location: { lat: 26.1158, lng: 91.7086 }, disasterZone: 'Guwahati Sector', lastUpdated: new Date().toISOString() as any },
    { id: 'fwr-2', name: 'Flood Rescue Team 2 (FRT-2)', type: 'team', status: 'on_standby', location: { lat: 25.5941, lng: 85.1376 }, lastUpdated: new Date().toISOString() as any },
    { id: 'fwr-3', name: 'Deep Water Rescue Unit 1', type: 'team', status: 'active', location: { lat: 10.8505, lng: 76.2711 }, disasterZone: 'Kerala Coast', lastUpdated: new Date().toISOString() as any },
    { id: 'fwr-4', name: 'Swift Water Rescue Squad', type: 'team', status: 'on_duty', location: { lat: 30.0869, lng: 78.2676 }, disasterZone: 'Rishikesh Valley', lastUpdated: new Date().toISOString() as any },

    // Search & Rescue (Earthquake / Collapse)
    { id: 'sar-1', name: 'Urban Search & Rescue Team 1 (USAR-1)', type: 'team', status: 'active', location: { lat: 28.6139, lng: 77.2090 }, disasterZone: 'Delhi NCR Response', lastUpdated: new Date().toISOString() as any },
    { id: 'sar-2', name: 'Collapsed Structure Rescue Team 2 (CSRT-2)', type: 'team', status: 'on_standby', location: { lat: 19.0760, lng: 72.8777 }, lastUpdated: new Date().toISOString() as any },
    { id: 'sar-3', name: 'Heavy Rescue Unit 1', type: 'vehicle', status: 'maintenance', location: { lat: 22.5726, lng: 88.3639 }, lastUpdated: new Date().toISOString() as any },
    { id: 'sar-4', name: 'Light Rescue Squad', type: 'team', status: 'on_duty', location: { lat: 13.0827, lng: 80.2707 }, lastUpdated: new Date().toISOString() as any },

    // Medical & Support
    { id: 'med-1', name: 'Medical Response Team 1 (MRT-1)', type: 'team', status: 'active', location: { lat: 12.9716, lng: 77.5946 }, disasterZone: 'Bangalore Sector', lastUpdated: new Date().toISOString() as any },
    { id: 'med-2', name: 'Emergency Medical Unit 2', type: 'team', status: 'on_duty', location: { lat: 17.3850, lng: 78.4867 }, lastUpdated: new Date().toISOString() as any },
    { id: 'med-3', name: 'Trauma Support Team', type: 'team', status: 'on_standby', location: { lat: 23.0225, lng: 72.5714 }, lastUpdated: new Date().toISOString() as any },
    { id: 'med-4', name: 'Field Medical Squad', type: 'team', status: 'on_standby', location: { lat: 21.1458, lng: 79.0882 }, lastUpdated: new Date().toISOString() as any },

    // Specialized Hazard Teams
    { id: 'haz-1', name: 'CBRN Response Team 1', type: 'team', status: 'active', location: { lat: 18.5204, lng: 73.8567 }, disasterZone: 'Pune Industrial Belt', lastUpdated: new Date().toISOString() as any },
    { id: 'haz-2', name: 'Hazardous Material Unit (HAZMAT-1)', type: 'team', status: 'on_duty', location: { lat: 19.2183, lng: 72.9781 }, lastUpdated: new Date().toISOString() as any },
    { id: 'haz-3', name: 'Decontamination Squad', type: 'team', status: 'on_standby', location: { lat: 28.4595, lng: 77.0266 }, lastUpdated: new Date().toISOString() as any },

    // Technical & Support Units
    { id: 'tech-1', name: 'Communication Support Unit 1', type: 'team', status: 'active', location: { lat: 28.6692, lng: 77.4538 }, disasterZone: 'Ghaziabad Hub', lastUpdated: new Date().toISOString() as any },
    { id: 'tech-2', name: 'Logistics & Supply Team', type: 'team', status: 'on_duty', location: { lat: 22.7196, lng: 75.8577 }, lastUpdated: new Date().toISOString() as any },
    { id: 'tech-3', name: 'Equipment Support Squad', type: 'team', status: 'on_standby', location: { lat: 26.8467, lng: 80.9462 }, lastUpdated: new Date().toISOString() as any },

    // Search Dogs / Special Ops
    { id: 'spec-1', name: 'K9 Search Team 1', type: 'team', status: 'active', location: { lat: 31.1471, lng: 75.3412 }, disasterZone: 'Punjab Frontier', lastUpdated: new Date().toISOString() as any },
    { id: 'spec-2', name: 'Canine Rescue Unit', type: 'team', status: 'on_standby', location: { lat: 30.3165, lng: 78.0322 }, lastUpdated: new Date().toISOString() as any },
    { id: 'spec-3', name: 'Deep Diving Team 1', type: 'team', status: 'active', location: { lat: 15.2993, lng: 74.1240 }, disasterZone: 'Goa Coastal Ops', lastUpdated: new Date().toISOString() as any },
    { id: 'spec-4', name: 'Underwater Search Squad', type: 'team', status: 'on_duty', location: { lat: 20.2376, lng: 86.5366 }, lastUpdated: new Date().toISOString() as any }
  ],
  users: [
    { uid: 'hq-123', name: 'HQ Commander', email: 'admin@ndrf.gov.in', role: 'hq_admin', createdAt: new Date().toISOString() as any },
    { uid: 'field-456', name: 'Field Lead Responder', email: 'member@ndrf.gov.in', role: 'field', createdAt: new Date().toISOString() as any }
  ],
  alerts: [
    { id: 'alt-1', title: 'Severe Cyclone Alert', message: 'Cyclonic storm expected to make landfall in 12 hours.', severity: 'high', disasterZone: 'Odisha Coast', timestamp: new Date().toISOString() as any, active: true },
    { id: 'alt-2', title: 'Landslide Risk', message: 'Heavy saturation in Soil B-4 indicates imminent risk.', severity: 'critical', disasterZone: 'Chamoli', timestamp: new Date().toISOString() as any, active: true }
  ],
  requests: [],
  inventory: [
    { id: 'inv-1', name: 'Rescue Boats', category: 'rescue' as any, quantity: 45, unit: 'units', lastUpdated: new Date().toISOString() as any, minThreshold: 10 },
    { id: 'inv-2', name: 'Medical Kits (Adv)', category: 'medical' as any, quantity: 200, unit: 'kits', lastUpdated: new Date().toISOString() as any, minThreshold: 50 }
  ],
  photos: [],
  incidents: [
    { id: 'inc-1', name: 'Chamoli Valley Ops', type: 'landslide', severity: 'high', epicenter: { lat: 30.7346, lng: 79.0669 }, radiusKm: 15, timestamp: new Date().toISOString() as any, status: 'active', affectedClusters: ['Joshimath', 'Niti Valley'] },
    { id: 'inc-2', name: 'Coastal Shield Ops', type: 'cyclone', severity: 'critical', epicenter: { lat: 20.2376, lng: 86.5366 }, radiusKm: 120, timestamp: new Date().toISOString() as any, status: 'active', affectedClusters: ['Paradip', 'Puri'] }
  ],
  logs: []
};

export const getMockDb = (): MockData => {
  const data = localStorage.getItem(STORAGE_KEY);
  let parsed: any;
  
  try {
    parsed = data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to parse mock DB', e);
    parsed = null;
  }

  // If no data or data is missing essential keys or resources are empty, reset to default
  if (!parsed || !parsed.resources || parsed.resources.length === 0 || !parsed.users) {
    const rawData = JSON.stringify(DEFAULT_DATA);
    localStorage.setItem(STORAGE_KEY, rawData);
    return DEFAULT_DATA;
  }
  
  // Ensure all keys from DEFAULT_DATA exist in parsed
  const db = { ...DEFAULT_DATA, ...parsed };
  
  // Recursively restore toDate method for anything that looks like a timestamp
  const restoreDates = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val && typeof val === 'object' && val.seconds) {
        // Handle Firestore-like object {seconds, nanoseconds}
        obj[key] = { toDate: () => new Date(val.seconds * 1000) };
      } else if (
        (key === 'timestamp' || key === 'lastUpdated' || key === 'createdAt' || key === 'updatedAt') && 
        (typeof val === 'string' || val instanceof Date)
      ) {
        const date = new Date(val);
        obj[key] = { toDate: () => isNaN(date.getTime()) ? new Date() : date };
      } else if (typeof val === 'object' && val !== null) {
        restoreDates(val);
      }
    });
  };

  restoreDates(db);
  return db;
};

export const updateMockDb = (updates: Partial<MockData>) => {
  const current = getMockDb();
  // Before saving, we need to convert the toDate wrappers into something JSON-friendly (ISO strings)
  const prepareForStorage = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = Array.isArray(obj) ? [...obj] : { ...obj };
    
    Object.keys(clone).forEach(key => {
      if (clone[key] && typeof clone[key] === 'object' && typeof clone[key].toDate === 'function') {
        clone[key] = clone[key].toDate().toISOString();
      } else if (typeof clone[key] === 'object' && clone[key] !== null) {
        clone[key] = prepareForStorage(clone[key]);
      }
    });
    return clone;
  };

  const updated = { ...current, ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prepareForStorage(updated)));
  window.dispatchEvent(new Event('mock-db-update'));
};

export const mockServerTimestamp = () => ({ toDate: () => new Date() } as any);
