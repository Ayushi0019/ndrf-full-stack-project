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

// Default safety fallback data in case server is booting
const DEFAULT_DATA: MockData = {
  resources: [],
  users: [
    { uid: 'hq-123', name: 'HQ Commander', email: 'admin@ndrf.gov.in', role: 'hq_admin', createdAt: new Date().toISOString() as any },
    { uid: 'field-456', name: 'Field Lead Responder', email: 'member@ndrf.gov.in', role: 'field', createdAt: new Date().toISOString() as any }
  ],
  alerts: [],
  requests: [],
  inventory: [],
  photos: [],
  incidents: [],
  logs: []
};

// In-memory cache for synchronous React reads
let dbCache: MockData = { ...DEFAULT_DATA };
let isInitialSyncDone = false;

// Initialize cache from localStorage first to prevent blank screens
const loadFromStorage = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      dbCache = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse cached localStorage data:', e);
    }
  }
};
loadFromStorage();

// Restore toDate timestamp utility methods required by frontend code (e.g. sorts, formatters)
const restoreDates = (obj: any) => {
  if (!obj || typeof obj !== 'object') return;
  
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val && typeof val === 'object' && val.seconds) {
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

// JSON stringifier helper that preps any client toDate functions before sending over HTTP or storing
const prepareForStorage = (obj: any): any => {
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

// Synchronously returns current state to the caller (used heavily in React render pathways)
export const getMockDb = (): MockData => {
  const dbCopy = { ...dbCache };
  restoreDates(dbCopy);
  return dbCopy;
};

// Synchronously updates cache so UX remains instantly interactive, and queues a server sync background post.
export const updateMockDb = async (updates: Partial<MockData>) => {
  dbCache = { ...dbCache, ...updates };
  
  // Cache in localStorage
  const prepped = prepareForStorage(dbCache);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prepped));
  
  // Dispatch local change event for instant react update
  window.dispatchEvent(new Event('mock-db-update'));

  // Sync back to Express Backend Server
  try {
    const response = await fetch('/api/db/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prepped)
    });
    if (response.ok) {
      const resData = await response.json();
      if (resData.success) {
        // Successfully synchronized with system server!
      }
    }
  } catch (error) {
    console.warn('Backup write to server error (will retry on next event):', error);
  }
};

// Main background loop to fetch remote state from Express Backend Database
export const syncWithBackend = async () => {
  try {
    const response = await fetch('/api/db');
    if (response.ok) {
      const serverDb = await response.json();
      
      // Compare state to avoid unnecessary re-renders
      const serverString = JSON.stringify(serverDb);
      const cacheString = JSON.stringify(prepareForStorage(dbCache));
      
      if (serverString !== cacheString || !isInitialSyncDone) {
        dbCache = serverDb;
        localStorage.setItem(STORAGE_KEY, serverString);
        isInitialSyncDone = true;
        window.dispatchEvent(new Event('mock-db-update'));
      }
    }
  } catch (error) {
    console.error('Failed to sync with NDRF Portal express server:', error);
  }
};

// Begin Background Synchronization Task loop immediately
syncWithBackend();
setInterval(syncWithBackend, 3000);

export const mockServerTimestamp = () => ({ toDate: () => new Date() } as any);
