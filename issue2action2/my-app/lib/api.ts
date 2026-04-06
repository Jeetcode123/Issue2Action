export type IssueStatus = 'reported' | 'email_sent' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface CreateIssuePayload {
  description: string;
  location_text: string;
  latitude: number;
  longitude: number;
  ward: string;
  type: string;
  image_url?: string;
  image_urls?: string[];
  user_id: string;
}

export interface CreatedIssue {
  id: string;
  ticket_id: string;
  status: IssueStatus;
  created_at: string;
}

export interface IssueWithTimeline extends CreatedIssue {
  type: string;
  description: string;
  location_text?: string;
  ward?: string;
  priority?: IssuePriority;
  image_urls?: string[];
  department?: string;
  upvotes?: number;
  timeline: {
    id: string;
    status: string;
    message: string;
    created_at: string;
  }[];
}

export interface PublicIssue {
  id: string;
  ticket_id?: string;
  description: string;
  location_text?: string;
  ward?: string;
  type?: string;
  status: IssueStatus;
  priority?: IssuePriority;
  created_at: string;
  upvotes: number;
  authority_notified?: boolean;
}

export interface UserIssue extends PublicIssue {
  userId: string;
}


const BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('i2a_token');
}

export async function fetcher<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    }
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
       localStorage.removeItem('i2a_token');
       localStorage.removeItem('i2a_user_id');
       // Don't auto reload right away, let the UI handle it or redirect, but clearing is safe
    }
  }
  if (!res.ok) {
    let errStr = "API error";
    try { const errJson = await res.json(); if (errJson.error) errStr = errJson.error; } catch(e) {}
    throw new Error(errStr);
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Fetch failed');
  return json.data;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<{ success: boolean, data: T, error: string | null }> {
  try {
    const token = getToken();
    const res = await fetch(BASE + path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      ...options
    });
    if (!res.ok) {
      try {
        const errJson = await res.json();
        return { success: false, data: null as any, error: errJson.error || "API error" };
      } catch (e) {
        throw new Error("API error");
      }
    }
    return await res.json();
  } catch (error: any) {
    return { success: false, data: null as any, error: error?.message || "Failed to fetch from API" };
  }
}

export async function createIssue(data: CreateIssuePayload): Promise<CreatedIssue> {
  const res = await apiFetch<CreatedIssue>('/api/issues/create', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.success) throw new Error(res.error || 'Failed to create issue');
  return res.data;
}

export async function getIssue(ticketId: string): Promise<IssueWithTimeline> {
  const res = await apiFetch<IssueWithTimeline>(`/api/issues/${ticketId}`);
  if (!res.success) throw new Error(res.error || 'Failed to fetch issue');
  return res.data;
}

export async function getPublicIssues(filters?: { ward?: string, type?: string, status?: string, time?: string }): Promise<PublicIssue[]> {
  const query = new URLSearchParams();
  if (filters?.ward) query.append('ward', filters.ward);
  if (filters?.type) query.append('type', filters.type);
  if (filters?.status) query.append('status', filters.status);
  if (filters?.time) query.append('time', filters.time);
  
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch<PublicIssue[]>(`/api/issues/public${queryString}`);
  if (!res.success) throw new Error(res.error || 'Failed to fetch public issues');
  return res.data;
}

export async function upvoteIssue(ticketId: string, userId: string): Promise<{ upvotes: number }> {
  const res = await apiFetch<{ upvotes: number }>(`/api/issues/${ticketId}/upvote`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.success) throw new Error(res.error || 'Failed to upvote issue');
  return res.data;
}

export async function updateIssueStatus(ticketId: string, status: string, message: string): Promise<void> {
  const res = await apiFetch<void>(`/api/issues/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, message })
  });
  if (!res.success) throw new Error(res.error || 'Failed to update status');
  return res.data;
}

export async function getUserIssues(userId: string): Promise<UserIssue[]> {
  const res = await apiFetch<UserIssue[]>(`/api/users/${userId}/issues`);
  if (!res.success) throw new Error(res.error || 'Failed to fetch user issues');
  return res.data;
}

export async function sendSupportMessage(name: string, email: string, message: string): Promise<void> {
  const res = await apiFetch<void>('/api/support/message', {
    method: 'POST',
    body: JSON.stringify({ name, email, message })
  });
  if (!res.success) throw new Error(res.error || 'Failed to send support message');
  return res.data;
}

export async function loginUser(email: string, password: string): Promise<{ token: string, userId: string }> {
  const res = await apiFetch<{ token: string, userId: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (!res.success) throw new Error(res.error || 'Failed to login');
  return res.data;
}

export async function registerUser(firstName: string, lastName: string, email: string, cityWard: string, password: string): Promise<{ token: string | null, userId: string }> {
  const res = await apiFetch<{ token: string | null, userId: string }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, cityWard, password })
  });
  if (!res.success) throw new Error(res.error || 'Failed to register');
  return res.data;
}

export async function logoutUser(): Promise<void> {
  await apiFetch<void>('/api/auth/logout', { method: 'POST' });
}

export async function replyToIssue(ticketId: string, message: string, userId: string): Promise<void> {
  const res = await apiFetch<void>(`/api/issues/${ticketId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message, user_id: userId })
  });
  if (!res.success) throw new Error(res.error || 'Failed to reply');
}

export interface AppNotification {
  id: string;
  issue_id: string;
  type: string;
  title: string;
  channel: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export async function getUserNotifications(userId: string): Promise<AppNotification[]> {
  const res = await apiFetch<AppNotification[]>(`/api/users/${userId}/notifications`);
  if (!res.success) throw new Error(res.error || 'Failed to fetch notifications');
  return res.data;
}

export async function markNotificationRead(userId: string, notifId: string): Promise<void> {
  await apiFetch<void>(`/api/users/${userId}/notifications/${notifId}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await apiFetch<void>(`/api/users/${userId}/notifications/read-all`, { method: 'POST' });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const res = await apiFetch<{ count: number }>(`/api/users/${userId}/notifications/unread-count`);
  if (!res.success) return 0;
  return res.data?.count || 0;
}

export interface Authority {
  id: string;
  name?: string;
  department: string;
  locality?: string;
  issue_type?: string;
  email: string;
  phone?: string;
  priority_level: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getAuthorities(): Promise<Authority[]> {
  const res = await apiFetch<Authority[]>('/api/admin/authorities');
  if (!res.success) throw new Error(res.error || 'Failed to fetch authorities');
  return res.data;
}

export async function createAuthority(data: Partial<Authority>): Promise<Authority> {
  const res = await apiFetch<Authority>('/api/admin/authorities', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.success) throw new Error(res.error || 'Failed to create authority');
  return res.data;
}

export async function updateAuthority(id: string, data: Partial<Authority>): Promise<Authority> {
  const res = await apiFetch<Authority>(`/api/admin/authorities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  if (!res.success) throw new Error(res.error || 'Failed to update authority');
  return res.data;
}

export async function deleteAuthority(id: string): Promise<void> {
  const res = await apiFetch<void>(`/api/admin/authorities/${id}`, {
    method: 'DELETE'
  });
  if (!res.success) throw new Error(res.error || 'Failed to delete authority');
}

