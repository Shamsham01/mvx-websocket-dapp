import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      const h = config.headers;
      if (h && typeof h.delete === 'function') {
        h.delete('Content-Type');
      } else if (h) {
        delete h['Content-Type'];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const retryAfter = error.response?.headers?.['retry-after'];
    if (status === 401) {
      const isLoginAttempt = error.config?.url?.includes('/auth/login');
      if (!isLoginAttempt) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    const payload = data && typeof data === 'object' && !Array.isArray(data)
      ? { ...data }
      : { error: 'Network error' };
    if (status) payload.status = status;
    if (retryAfter && payload.retryAfter == null) payload.retryAfter = retryAfter;
    if (!status && error.code) payload.code = payload.code || error.code;
    return Promise.reject(payload);
  }
);

export const authAPI = {
  login: (address, signature, message) =>
    api.post('/auth/login', { address, signature, message }),

  loginWithNativeAuth: (accessToken) =>
    api.post('/auth/login/native', { accessToken }, { timeout: 20000 }),

  logout: () =>
    api.post('/auth/logout'),

  getMe: () =>
    api.get('/auth/me'),

  getDashboardAnalytics: () =>
    api.get('/auth/dashboard-analytics'),
};

export const subscriptionAPI = {
  getAll: () => 
    api.get('/subscriptions'),
  
  getOne: (id) => 
    api.get(`/subscriptions/${id}`),
  
  create: (data) => 
    api.post('/subscriptions', data),
  
  update: (id, data) => 
    api.put(`/subscriptions/${id}`, data),
  
  delete: (id) => 
    api.delete(`/subscriptions/${id}`),
  
  toggle: (id, isActive) => 
    api.post(`/subscriptions/${id}/toggle`, { is_active: isActive }),
};

export const webhookAPI = {
  validate: (url) => 
    api.post('/webhooks/validate', { url }),
  
  getStats: (subscriptionId) => 
    api.get(`/webhooks/stats/${subscriptionId}`),
  
  test: (subscriptionId, testData) => 
    api.post(`/webhooks/test/${subscriptionId}`, { testData }),
  
  getDeliveries: (limit = 50, offset = 0) => 
    api.get(`/webhooks/deliveries?limit=${limit}&offset=${offset}`),
};

/** Make.com blueprint templates (multipart: use FormData). Admin-only on server. */
export const templateAPI = {
  create: (formData) => api.post('/templates', formData),
  update: (id, formData) => api.put(`/templates/${encodeURIComponent(id)}`, formData),
  delete: (id) => api.delete(`/templates/${encodeURIComponent(id)}`),
};

export const billingAPI = {
  getPrefs: () => api.get('/billing-prefs'),
  savePrefs: (feeToken) => api.put('/billing-prefs', { feeToken }),
};

export default api;