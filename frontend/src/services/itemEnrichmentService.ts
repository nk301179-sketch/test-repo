import { productApi } from './api';

export type ItemSuggestion = {
    id: string;
    source: 'wikipedia' | 'duckduckgo';
    title: string;
    subtitle?: string;
    url?: string;
};

export type ItemEnrichmentDetails = {
    title: string;
    description?: string;
    estimatedWeightKg?: number | null;
    source: 'wikipedia' | 'duckduckgo';
    url?: string;
};

export const fetchItemSuggestions = async (query: string): Promise<ItemSuggestion[]> => {
    const response = await productApi.get('/api/products/suggest', {
        params: { q: query },
    });
    return response.data;
};

export const fetchItemDetails = async (source: string, id: string): Promise<ItemEnrichmentDetails> => {
    const response = await productApi.get('/api/products/details', {
        params: { source, id },
    });
    return response.data;
};
