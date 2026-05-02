import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'hq_admin' | 'field';
  createdAt: Timestamp;
}

export interface Resource {
  id: string;
  name: string;
  type: 'team' | 'equipment' | 'vehicle' | 'personnel';
  status: 'active' | 'en_route' | 'on_standby' | 'maintenance';
  location: {
    lat: number;
    lng: number;
  };
  disasterZone?: string;
  affectedArea?: string;
  lastUpdated: Timestamp;
  assignedTo?: string;
  details?: string;
}

export interface EmergencyAlert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  disasterZone?: string;
  affectedArea?: string;
  timestamp: Timestamp;
  active: boolean;
}

export interface ResourceRequest {
  id: string;
  item: string;
  quantity: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled';
  disasterZone: string;
  affectedArea: string;
  requestedBy: string; // User Name
  requesterId: string; // User UID
  timestamp: Timestamp;
  location: {
    lat: number;
    lng: number;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'medical' | 'rescue' | 'shelter' | 'rations' | 'vehicles';
  quantity: number;
  unit: string;
  lastUpdated: Timestamp;
  minThreshold: number;
}

export interface IncidentPhoto {
  id: string;
  url: string;
  caption: string;
  uploadedBy: string;
  timestamp: Timestamp;
  location: {
    lat: number;
    lng: number;
  };
  disasterZone: string;
}

export interface DisasterIncident {
  id: string;
  name: string;
  epicenter: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'contained' | 'resolved';
  timestamp: Timestamp;
  affectedClusters: string[];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
