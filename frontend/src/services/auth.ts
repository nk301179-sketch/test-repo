import axios from 'axios';
import api, { API_BASE_URL } from './api';
import { storeTokens, getAccessToken, clearTokens } from './tokenStorage';
import { resolveBaseUrl } from './url';

export interface SigninData {
    email: string;
    password: string;
}

export interface SignupData {
    name: string;
    email: string;
    password: string;
    nicDocument?: File;
    passportDocument?: File;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    emailVerified?: boolean;
    accountType?: string;
}

export const signin = async (data: SigninData) => {
    const response = await api.post('/auth/login', data);
    storeTokens(response.data.accessToken, response.data.refreshToken);
    return response.data as AuthResponse;
};

export const signup = async (data: SignupData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('password', data.password);

    if (data.nicDocument) {
        formData.append('nicDocument', data.nicDocument);
    }

    if (data.passportDocument) {
        formData.append('passportDocument', data.passportDocument);
    }

    const response = await api.post('/auth/signup', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const logout = () => {
    clearTokens();
    const userMgmtBaseUrl = resolveBaseUrl(import.meta.env.VITE_USER_MGMT_BASE_URL);
    window.location.href = `${userMgmtBaseUrl}/signin`;
};

export const isAuthenticated = () => {
    return !!getAccessToken();
};

export const refreshWithToken = async (refreshToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    storeTokens(response.data.accessToken, response.data.refreshToken);
    return response.data.accessToken as string;
};

export const verifyEmail = async (token: string) => {
    return api.get('/auth/verify-email', { params: { token } });
};

export const resendVerification = async (email: string) => {
    return api.post('/auth/verify-email/resend', { email });
};

export const confirmPasswordReset = async (token: string) => {
    return api.post('/auth/reset-password/confirm', { token });
};

export const requestPasswordReset = async (email: string) => {
    return api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token: string, password: string) => {
    return api.post('/auth/reset-password', { token, password });
};

const OAUTH_REDIRECT_URI = import.meta.env.VITE_OAUTH_REDIRECT_URI || window.location.origin;

export const startGoogleLogin = () => {
    const url = `${API_BASE_URL}/oauth2/authorize/google?redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`;
    window.location.href = url;
};

export const updateAccountType = async (accountType: 'PERSONAL' | 'COMPANY') => {
    return api.post('/auth/account-type', { accountType });
};

export const completeProfile = async (data: {
    name: string;
    phoneNumber: string;
    deliveryAddress?: {
        street: string;
        city: string;
        stateOrProvince?: string;
        postalCode: string;
        country: string;
    };
    selectedRoles: string[];
}) => {
    return api.post('/user/complete-profile', data);
};

export const getPersonalAccount = async () => {
    return api.get('/user/personal-account');
};

export const updatePersonalAccount = async (data: {
    name: string;
    phoneNumber: string;
    deliveryAddress: {
        street: string;
        city: string;
        stateOrProvince?: string;
        postalCode: string;
        country: string;
    };
}) => {
    return api.put('/user/personal-account', data);
};

export const hasPendingRole = async (): Promise<boolean> => {
    try {
        const response = await api.get('/user/personal-account');
        const roles = response.data?.roles || [];
        return roles.includes('ROLE_PENDING');
    } catch {
        return false;
    }
};

export const hasPendingAccountType = async (): Promise<boolean> => {
    try {
        const response = await api.get('/user/personal-account');
        const accountType = response.data?.accountType;
        return !accountType || accountType === 'PENDING';
    } catch {
        return false;
    }
};

// Aliases for backward compatibility
export const login = async (email: string, password: string) => {
    return signin({ email, password });
};

export const register = async (name: string, email: string, password: string) => {
    return signup({ name, email, password });
};
