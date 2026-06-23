// src/types/index.ts

export type UserRole = 'citizen' | 'authority' | 'moderator';

export type Severity = 'Low' | 'Medium' | 'High';

export type ReportStatus =
  | 'NEW'
  | 'AWAITING_CLARIFICATION'
  | 'REJECTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_CONFIRMATION'
  | 'RESOLVED'
  | 'REOPENED'
  | 'ESCALATED'
  | 'CLOSED'
  | 'APPEAL';

export type ClusterStatus = 'active' | 'resolved' | 'closed';

export type TrustCategory = 'HighTrust' | 'MediumTrust' | 'LowTrust' | 'Untrusted';

export interface Report {
  id: string;
  citizen_id: string;
  cluster_id: string | null;
  category: string;
  severity: Severity;
  status: ReportStatus;
  photo_url: string;
  after_photo_url: string | null;
  lat: number;
  lng: number;
  geo_accuracy_meters: number;
  description: string | null;
  classifier_confidence: number;
  trust_layer1: number;
  trust_layer2: number;
  trust_score: number;
  sla_deadline: Date | null;
  escalation_sent: boolean;
  dispute_window_closes_at: Date | null;
  resolution_attempt: number;
  pii_flag: boolean;
  pii_handled: boolean;
  moderator_id: string | null;
  locked_until: Date | null;
  appeal_text: string | null;
  photo_timestamp: Date | null;
  device_timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Cluster {
  id: string;
  category: string;
  severity: Severity;
  status: ClusterStatus;
  centroid_lat: number;
  centroid_lng: number;
  affected_count: number;
  affected_citizen_ids: string[];
  priority_score: number;
  trust_score: number;
  zone_id: string | null;
  sla_deadline: Date | null;
  escalation_sent: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  role: UserRole;
  display_name: string;
  email: string;
  verified_account: boolean;
  trust_score: number;
  trust_layer1: number;
  trust_layer2: number;
  total_points: number;
  fcm_token: string | null;
  zone_id: string | null;
  created_at: Date;
}
