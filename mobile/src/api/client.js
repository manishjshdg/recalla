import axios from 'axios';
import { Platform } from 'react-native';

/**
 * Platform-aware default API base URL.
 *
 * Android Emulator: 10.0.2.2 → reaches host machine localhost
 * iOS Simulator / Web: localhost
 * Physical device: MUST be set to your machine's LAN IP in Settings screen.
 *   e.g. http://192.168.1.42:8000
 *
 * Credentials (LLM API key, Hindsight key) are NEVER stored here.
 * They live in backend/.env only.
 */
const DEFAULT_URL = Platform.select({
  android: 'http://192.168.29.31:8000',
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
  timeout: 50000,   // 50s — Gemini can be slow on first call
  headers: {
    'Content-Type': 'application/json',
  },
});

// Clear, structured error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Network connection failed. Check that the backend server is running.';

    if (error.response?.data) {
      const data = error.response.data;
      if (data.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (data.detail?.message) {
          message = data.detail.message;
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (data.message) {
        message = data.message;
      }
    } else if (error.code === 'ECONNABORTED') {
      message = 'Request timed out. The AI agent is taking longer than expected.';
    } else if (error.message) {
      message = error.message;
    }

    const err = new Error(message);
    err.statusCode = error.response?.status;
    err.errorCode = error.response?.data?.detail?.error;
    return Promise.reject(err);
  }
);

// ── Health API ────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => apiClient.get('/health').then((r) => r.data),
};

// ── Incidents API ─────────────────────────────────────────────────────────────
export const incidentsApi = {
  list: (params = {}) => apiClient.get('/api/incidents', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/api/incidents/${id}`).then((r) => r.data),
  create: (data) => apiClient.post('/api/incidents', data).then((r) => r.data),
  updateStatus: (id, status, details = '') =>
    apiClient
      .patch(`/api/incidents/${id}/status`, null, { params: { status, details } })
      .then((r) => r.data),
  resolve: (id, data) =>
    apiClient.post(`/api/incidents/${id}/resolve`, data).then((r) => r.data),
  analyze: (id) =>
    apiClient.post(`/api/incidents/${id}/analyze`).then((r) => r.data),
  createPostMortem: (id, data) =>
    apiClient.post(`/api/incidents/${id}/postmortem`, data).then((r) => r.data),
};

// ── Conversational AI Agent API ───────────────────────────────────────────────
export const agentApi = {
  /**
   * Send a message to the conversational AI agent.
   * @param {string} message — user's natural-language message
   * @param {string|null} conversationId — null to start new conversation
   * @param {string|null} incidentId — optional linked incident
   * @returns {Promise<ChatResponse>}
   */
  chat: (message, conversationId = null, incidentId = null) =>
    apiClient
      .post('/api/agent/chat', {
        message,
        conversation_id: conversationId || undefined,
        incident_id: incidentId || undefined,
      })
      .then((r) => r.data),

  getHistory: (conversationId) =>
    apiClient.get(`/api/agent/chat/${conversationId}/history`).then((r) => r.data),

  clearConversation: (conversationId) =>
    apiClient.delete(`/api/agent/chat/${conversationId}`).then((r) => r.data),

  status: () => apiClient.get('/api/agent/status').then((r) => r.data),
};

// ── Memory API (Hindsight by Vectorize) ───────────────────────────────────────
export const memoryApi = {
  getStats: () => apiClient.get('/api/memory/stats').then((r) => r.data),
  search: (query) => apiClient.post('/api/memory/search', { query }).then((r) => r.data),
  retain: (content) => apiClient.post('/api/memory/retain', { content }).then((r) => r.data),
  reflect: (query) => apiClient.post('/api/memory/reflect', { query }).then((r) => r.data),
};

// ── Runbooks API ──────────────────────────────────────────────────────────────
export const runbooksApi = {
  list: () => apiClient.get('/api/runbooks').then((r) => r.data),
  get: (name) => apiClient.get(`/api/runbooks/${name}`).then((r) => r.data),
};

// ── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: () => apiClient.get('/api/analytics').then((r) => r.data),
};
