import { jobApi } from './api';

export interface ItemRequest {
    id: string;
    requesterId: string;
    name: string;
    images: string[];
    description?: string;
    startingBid: number;
    quantity: number;
    totalPrice: number;
    estimatedWeightKg: number;
    enrichmentSource?: string;
    enrichmentUrl?: string;
    enrichmentTitle?: string;
    fromCountries: string[];
    deliveryLocation: string;
    deadline: string;
    status: 'OPEN' | 'POSTED' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
    createdAt: string;
}

export interface CreateItemRequest {
    name: string;
    images: string[];
    description?: string;
    startingBid: number;
    quantity: number;
    estimatedWeightKg: number;
    enrichmentSource?: string;
    enrichmentUrl?: string;
    enrichmentTitle?: string;
    fromCountries: string[];
    deliveryLocation: string;
    deadline: string;
}

export interface CreateItemRequestPayload {
    itemName: string;
    itemDescription: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    estimatedWeightKg: number;
    sourceCountries: string[];
    deliveryLocation: string;
    deadline: string;
}

export interface CreateItemRequestResponse {
    requestId: string;
    status: 'OPEN' | 'CLOSED' | 'CANCELLED' | string;
    itemId: string;
    totalPrice: number;
    createdAt: string;
}

export const uploadRequestImages = async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });

    // Note: The backend endpoint is in sendjob-service.
    // If api.ts uses a gateway or specific base URL, we might need to adjust.
    // Assuming VITE_SENDJOB_SERVICE_URL or similar is handled by proxy or full URL needed.
    // However, existing api.ts likely points to some base. Let's assume it works or we fix it.
    // Actually, sendjob-service is on 8082. api.ts likely points to 8080 (UserMgmt) or has logic.
    // Peer2Peer frontend usually talks to Product(8081) and SendJob(8082).
    // Let's check api.ts to see how it handles different services.
    // If it uses a single base, we might need to specify service URL if not gatewayed.
    // For now, I'll use `api.post` and rely on existing config or user prompt "Use existing auth/session mechanism".

    const response = await jobApi.post('/api/uploads/request-images', formData);
    return response.data.urls;
};

export const createItemRequest = async (
    payload: CreateItemRequestPayload,
    images: File[],
    idempotencyKey: string
): Promise<CreateItemRequestResponse> => {
    // Validate payload before sending
    if (!payload.itemName || !payload.itemDescription || !payload.currency || 
        !payload.deliveryLocation || !payload.deadline || 
        payload.quantity == null || payload.unitPrice == null || 
        payload.estimatedWeightKg == null || 
        !Array.isArray(payload.sourceCountries) || payload.sourceCountries.length === 0) {
        throw new Error('Invalid payload: missing required fields');
    }

    // Validate images
    if (!images || images.length === 0) {
        throw new Error('At least one image is required');
    }
    if (images.length > 5) {
        throw new Error('Maximum 5 images allowed');
    }
    const invalidFiles = images.filter(file => !(file instanceof File));
    if (invalidFiles.length > 0) {
        throw new Error('All images must be valid File objects');
    }

    const formData = new FormData();
    const jsonString = JSON.stringify(payload);
    const dataBlob = new Blob([jsonString], { type: 'application/json' });
    // Create a File from the Blob to ensure Content-Type is preserved in multipart
    const dataFile = new File([dataBlob], 'data.json', { type: 'application/json' });
    formData.append('data', dataFile);
    
    images.forEach((file) => {
        formData.append('images', file);
    });

    const response = await jobApi.post('/api/item-requests', formData, {
        headers: {
            'Idempotency-Key': idempotencyKey,
        },
    });
    return response.data;
};

export const createRequest = async (data: CreateItemRequest): Promise<ItemRequest> => {
    const response = await jobApi.post('/api/requests', data);
    return response.data;
};

export const getMyRequests = async (): Promise<ItemRequest[]> => {
    const response = await jobApi.get('/api/requests/my');
    return response.data;
};

export const getRequestById = async (id: string): Promise<ItemRequest> => {
    const response = await jobApi.get(`/api/requests/${id}`);
    return response.data;
};

export const updateRequest = async (id: string, data: CreateItemRequest): Promise<ItemRequest> => {
    const response = await jobApi.put(`/api/requests/${id}`, data);
    return response.data;
};

export const cancelRequest = async (id: string): Promise<void> => {
    await jobApi.delete(`/api/requests/${id}`);
};
