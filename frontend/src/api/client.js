import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const signup = (email, password, username) => 
  api.post('/auth/signup', { email, password, username });

export const login = (email, password) => 
  api.post('/auth/login', { email, password });

export const getCurrentUser = () => 
  api.get('/auth/me');

// Articles
export const getArticles = (limit = 20, offset = 0) => 
  api.get('/articles', { params: { limit, offset } });

export const getArticle = (id) => 
  api.get(`/articles/${id}`);

export const seedArticles = () => 
  api.post('/articles/seed');

// User
export const trackRead = (articleId, timeSpent = 0, scrollDepth = 0) => 
  api.post('/user/read', { articleId, timeSpent, scrollDepth });

export const getUserProfile = () => 
  api.get('/user/profile');

export const getReadingHistory = () => 
  api.get('/user/history');

export const getRecommendations = () => 
  api.get('/user/recommendations');

// Admin
export const getAdminUsers = () => 
  api.get('/admin/users');

export const getAdminUserDetail = (userId) => 
  api.get(`/admin/users/${userId}`);

export const getAdminStats = () => 
  api.get('/admin/stats');

export default api;
