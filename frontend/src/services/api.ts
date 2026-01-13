import axios from 'axios';
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from './tokenStorage';
import { resolveBaseUrl } from './url';

export const API_BASE_URL = resolveBaseUrl(import.meta.env.VITE_API_BASE_URL);
const USER_MGMT_BASE_URL = resolveBaseUrl(import.meta.env.VITE_USER_MGMT_BASE_URL);

const createApi = (baseURL: string) => {
    const apiInstance = axios.create({
        baseURL,
    });

    apiInstance.interceptors.request.use(
        (config) => {
            const token = getAccessToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    apiInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                const currentRefreshToken = getRefreshToken();
                if (!currentRefreshToken) {
                    clearTokens();
                    window.location.href = `${USER_MGMT_BASE_URL}/signin?returnTo=${encodeURIComponent(window.location.href)}`;
                    return Promise.reject(error);
                }

                originalRequest._retry = true;
                try {
                    const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: currentRefreshToken });
                    storeTokens(refreshResponse.data.accessToken, refreshResponse.data.refreshToken);
                    const newAccessToken = refreshResponse.data.accessToken;
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return apiInstance(originalRequest);
                } catch (refreshErr) {
                    clearTokens();
                    window.location.href = `${USER_MGMT_BASE_URL}/signin?returnTo=${encodeURIComponent(window.location.href)}`;
                    return Promise.reject(refreshErr);
                }
            }
            return Promise.reject(error);
        }
    );

    return apiInstance;
};

const api = createApi(API_BASE_URL);
export const productApi = createApi('/product-api');
export const jobApi = createApi('/job-api');

export default api;
