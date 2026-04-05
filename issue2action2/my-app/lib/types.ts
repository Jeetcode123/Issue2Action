export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  ward?: string;
  city?: string;
  role: 'citizen' | 'authority' | 'admin';
  civic_score: number;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  issue_id: string;
  message: string;
  event_type: 'created' | 'verified' | 'assigned' | 'updated' | 'resolved';
  created_by: string;
  created_at: string;
}

export interface Issue {
  id: string;
  user_id: string;
  description: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  department: string;
  status: 'reported' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  location_text: string;
  latitude: number;
  longitude: number;
  ward: string;
  upvotes: number;
  ai_summary: string;
  ai_confidence: number;
  estimated_resolution: string;
  image_urls?: string[];
  is_duplicate: boolean;
  parent_issue_id?: string;
  created_at: string;
  updated_at: string;
  timeline?: TimelineEvent[];
}

export interface PublicIssue {
  id: string;
  type: string;
  priority: string;
  status: string;
  location_text: string;
  latitude: number;
  longitude: number;
  upvotes: number;
}

export interface ClassifiedIssue {
  type: string;
  priority: string;
  department: string;
  estimated_resolution: string;
  summary: string;
  confidence: number;
  urgency_reason: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
