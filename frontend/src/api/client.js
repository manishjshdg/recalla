import axios from 'axios';
import { Platform } from 'react-native';

// Default host based on platform:
// - Android Emulator uses 10.0.2.2 to reach host machine localhost
// - iOS Simulator and Web use localhost
const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

let currentBaseUrl = DEFAULT_URL;

export const setApiBaseUrl = (url) => {
  currentBaseUrl = url.trim().replace(/\/+$/, '');
  apiClient.defaults.baseURL = currentBaseUrl;
};

export const getApiBaseUrl = () => currentBaseUrl;

export const apiClient = axios.create({
  baseURL: currentBaseUrl,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for clear mobile errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Network connection failed. Check backend server.';
    if (error.response?.data?.detail) {
      message = typeof error.response.data.detail === 'string'
        ? error.response.data.detail
        : JSON.stringify(error.response.data.detail);
    } else if (error.message) {
      message = error.message;
    }
    return Promise.reject(new Error(message));
  }
);

// Health API
export const healthApi = {
  check: () => apiClient.get('/health').then((r) => r.data),
};

// Incidents API
export const incidentsApi = {
  list: (params = {}) => apiClient.get('/api/incidents', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/api/incidents/${id}`).then((r) => r.data),
  create: (data) => apiClient.post('/api/incidents', data).then((r) => r.data),
  updateStatus: (id, status, details = '') =>
    apiClient.patch(`/api/incidents/${id}/status`, null, { params: { status, details } }).then((r) => r.data),
  resolve: (id, data) => apiClient.post(`/api/incidents/${id}/resolve`, data).then((r) => r.data),
  analyze: (id) => apiClient.post(`/api/incidents/${id}/analyze`).then((r) => r.data),
  createPostMortem: (id, data) => apiClient.post(`/api/incidents/${id}/postmortem`, data).then((r) => r.data),
};

// Memory API (Hindsight by Vectorize)
export const memoryApi = {
  getStats: () => apiClient.get('/api/memory/stats').then((r) => r.data),
  search: (query) => apiClient.post('/api/memory/search', { query }).then((r) => r.data),
  retain: (content) => apiClient.post('/api/memory/retain', { content }).then((r) => r.data),
  reflect: (query) => apiClient.post('/api/memory/reflect', { query }).then((r) => r.data),
};

// Runbooks API
export const runbooksApi = {
  list: () => apiClient.get('/api/runbooks').then((r) => r.data),
  get: (name) => apiClient.get(`/api/runbooks/${name}`).then((r) => r.data),
};

// Analytics API
export const analyticsApi = {
  get: () => apiClient.get('/api/analytics').then((r) => r.data),
};
