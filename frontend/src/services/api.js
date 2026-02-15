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
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || { error: 'Network error' });
  }
);

export const authAPI = {
  login: (address, signature, message) => 
    api.post('/auth/login', { address, signature, message }),
  
  logout: () => 
    api.post('/auth/logout'),
  
  getMe: () => 
    api.get('/auth/me'),
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

export default api;