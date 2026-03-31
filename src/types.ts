import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'hq_admin' | 'field_member';
  createdAt: Timestamp;
}

export interface Resource {
  id: string;
  name: string;
  type: 'team' | 'equipment' | 'vehicle';
  status: 'active' | 'en_route' | 'on_standby' | 'maintenance';
  location: {
    lat: number;
    lng: number;
  };
  lastUpdated: Timestamp;
  assignedTo?: string;
  details?: string;
}

export interface EmergencyAlert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Timestamp;
  active: boolean;
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
