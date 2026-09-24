// File: api.js
// Purpose: Shared Axios instance for every API call the Web app makes.

import axios from 'axios';
import { getStoredAuth, clearStoredAuth } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'X-Client-Type': 'Web'
    }
});

// Request interceptor: attaches "Authorization: Bearer <token>" to every outgoing request when a session exists. 
// Runs outside React, so it reads localStorage directly via authStorage.js rather than through useAuth().
apiClient.interceptors.request.use((config) => {
    const auth = getStoredAuth();
    if (auth?.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
});

// Response interceptor: a 401 means the token is missing, expired, or the account was deactivated. 
// Clear it and send the user back to the login page. A full redirect (not React Router navigation).
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            clearStoredAuth();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;