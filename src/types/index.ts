// src/types/index.ts
import type { Timestamp } from 'firebase/firestore';

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
  | 'RESOLVED'
  | 'REOPENED'
  | 'ESCALATED'
  | 'CLOSED'
  | 'APPEAL'
  | 'ERROR';

export type ClusterStatus =
  | 'active'
  | 'assigned'
  | 'in_review'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'escalated';

export type TrustCategory = 'HighTrust' | 'MediumTrust' | 'LowTrust' | 'Untrusted';

export interface ResolutionValidation {
  fix_appears_genuine: boolean;
  confidence: number;
  reasoning: string;
}

export interface Report {
  id: string;
  citizen_id: string;
  cluster_id: string | null;
  authority_id: string | null;
  category: string;
  severity: Severity;
  status: ReportStatus;
  photo_url: string;
  after_photo_url: string | null;
  lat: number;
  lng: number;
  geo_accuracy_meters?: number;
  geo_accuracy_unknown?: boolean;
  description: string | null;
  clarification_question: string | null;
  clarification_answer: string | null;
  classifier_confidence: number;
  trust_layer1: number;
  trust_layer2: number;
  trust_score: number;
  sla_deadline: Timestamp | null;
  escalation_sent: boolean;
  escalation_email_failed?: boolean;
  resolution_attempt: number;
  resolution_validation: ResolutionValidation | null;
  pii_flag: boolean;
  pii_handled: boolean;
  moderator_id: string | null;
  locked_until: Timestamp | null;
  appeal_text: string | null;
  photo_timestamp: Timestamp | null;
  device_timestamp: Timestamp;
  error_message?: string | null;
  zone_id: string | null;
  affected_citizen_ids?: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
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
  authority_id: string | null;
  after_photo_url: string | null;
  sla_deadline: Timestamp | null;
  escalation_sent: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
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
  created_at: Timestamp;
}

export interface CitizenStats {
  total_xp: number;
  level: number;
  level_title: string;
  badges: string[];
  reports_submitted: number;
  reports_resolved: number;
  updated_at: Timestamp;
}

export interface XpHistoryEntry {
  id: string;
  amount: number;
  reason: string;
  report_id: string | null;
  cluster_id: string | null;
  created_at: Timestamp;
}

export const BADGE_DEFINITIONS = [
  { id: 'first_steps', name: 'First Steps', description: 'Submitted your first report', unlockHint: 'Submit your first report' },
  { id: 'problem_solver', name: 'Problem Solver', description: '5 of your reports have been resolved', unlockHint: 'Get 5 reports resolved' },
  { id: 'eagle_eye', name: 'Eagle Eye', description: '10 of your reports have been resolved', unlockHint: 'Get 10 reports resolved' },
  { id: 'streaker', name: 'Streaker', description: 'Submitted reports in 3 different weeks within the last 30 days', unlockHint: 'Submit reports in 3 different weeks within 30 days' },
  { id: 'zone_hero', name: 'Zone Hero', description: '5 resolved reports within the same zone', unlockHint: 'Get 5 reports resolved in the same zone' },
] as const;

export type FirestoreReport = Partial<Report> & { id?: string };
export type FirestoreCluster = Partial<Cluster> & { id?: string };
