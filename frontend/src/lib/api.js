const rawUrl = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE = rawUrl ? `${rawUrl}/api` : '/api';

async function request(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('awb_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('awb_token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const register = (email, password, full_name) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name }) });

export const getMe = () => request('/auth/me');

// Businesses
export const getBusinesses = () => request('/businesses');
export const getBusiness = (id) => request(`/businesses/${id}`);
export const createBusiness = (data) =>
  request('/businesses', { method: 'POST', body: JSON.stringify(data) });
export const updateBusiness = (id, data) =>
  request(`/businesses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBusiness = (id) =>
  request(`/businesses/${id}`, { method: 'DELETE' });
export const connectWhatsApp = (id, phone_number) =>
  request(`/businesses/${id}/connect-whatsapp`, { method: 'POST', body: JSON.stringify({ phone_number }) });
export const disconnectWhatsApp = (id) =>
  request(`/businesses/${id}/disconnect-whatsapp`, { method: 'POST' });

// Messages
export const getMessages = (businessId, limit = 50) =>
  request(`/messages/${businessId}?limit=${limit}`);
export const getCustomerMessages = (businessId, phone) =>
  request(`/messages/${businessId}/customer/${phone}`);

// Subscriptions
export const getSubscription = (businessId) => request(`/subscriptions/${businessId}`);
export const upgradeSubscription = (businessId) =>
  request(`/subscriptions/${businessId}/upgrade`, { method: 'POST' });
export const cancelSubscription = (businessId) =>
  request(`/subscriptions/${businessId}/cancel`, { method: 'POST' });
