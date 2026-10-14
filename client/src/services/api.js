import axios from 'axios';

// Same-origin requests work for localhost and LAN/mobile development. Set VITE_API_URL
// only when the deployed API is hosted on a different origin.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use((config) => { const token = localStorage.getItem('farmer_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
export const errorMessage = (error) => error.response?.data?.message || (error.request ? 'Cannot reach the server. Check your connection and try again.' : 'Something went wrong. Please try again.');
export default api;
