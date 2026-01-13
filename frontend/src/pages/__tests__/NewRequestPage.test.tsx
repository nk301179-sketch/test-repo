import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NewRequestPage from '../NewRequestPage';
import { fetchItemDetails, fetchItemSuggestions } from '../../services/itemEnrichmentService';

vi.mock('../../services/itemEnrichmentService', () => ({
    fetchItemSuggestions: vi.fn(),
    fetchItemDetails: vi.fn(),
}));

vi.mock('../../services/requestService', () => ({
    createItemRequest: vi.fn(),
}));

describe('NewRequestPage item enrichment', () => {
    const mockedFetchItemSuggestions = vi.mocked(fetchItemSuggestions);
    const mockedFetchItemDetails = vi.mocked(fetchItemDetails);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debounces suggestion requests', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        mockedFetchItemSuggestions.mockResolvedValue([]);

        render(
            <MemoryRouter>
                <NewRequestPage />
            </MemoryRouter>
        );

        const input = screen.getByPlaceholderText('e.g., iPhone 15 Pro, Nike Air Max');
        await user.type(input, 'iphone');

        expect(fetchItemSuggestions).not.toHaveBeenCalled();
        vi.advanceTimersByTime(399);
        expect(fetchItemSuggestions).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);

        await waitFor(() => expect(fetchItemSuggestions).toHaveBeenCalledTimes(1));
        vi.useRealTimers();
    });

    it('selecting suggestion fills description', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        mockedFetchItemSuggestions.mockResolvedValue([
            {
                id: 'wiki:Test Phone',
                source: 'wikipedia',
                title: 'Test Phone',
                subtitle: 'Smartphone',
                url: 'https://example.com',
            },
        ]);
        mockedFetchItemDetails.mockResolvedValue({
            title: 'Test Phone',
            description: 'Suggested description',
            estimatedWeightKg: 1.5,
            source: 'wikipedia',
            url: 'https://example.com',
        });

        render(
            <MemoryRouter>
                <NewRequestPage />
            </MemoryRouter>
        );

        const input = screen.getByPlaceholderText('e.g., iPhone 15 Pro, Nike Air Max');
        await user.type(input, 'test');
        vi.advanceTimersByTime(400);

        const suggestion = await screen.findByText('Test Phone');
        await user.click(suggestion);

        const description = await screen.findByPlaceholderText(
            'Describe the item in detail (color, size, model, etc.)...'
        );
        await waitFor(() => expect(description).toHaveValue('Suggested description'));
        vi.useRealTimers();
    });

    it('does not overwrite user-edited description without re-suggest', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        mockedFetchItemSuggestions.mockResolvedValueOnce([
            { id: 'wiki:Alpha', source: 'wikipedia', title: 'Alpha', subtitle: '', url: '' },
        ]);
        mockedFetchItemDetails.mockResolvedValueOnce({
            title: 'Alpha',
            description: 'Alpha description',
            estimatedWeightKg: null,
            source: 'wikipedia',
            url: '',
        });

        render(
            <MemoryRouter>
                <NewRequestPage />
            </MemoryRouter>
        );

        const input = screen.getByPlaceholderText('e.g., iPhone 15 Pro, Nike Air Max');
        await user.type(input, 'alpha');
        vi.advanceTimersByTime(400);

        const alphaSuggestion = await screen.findByText('Alpha');
        await user.click(alphaSuggestion);

        const description = await screen.findByPlaceholderText(
            'Describe the item in detail (color, size, model, etc.)...'
        );
        await waitFor(() => expect(description).toHaveValue('Alpha description'));
        await user.clear(description);
        await user.type(description, 'Custom description');

        mockedFetchItemSuggestions.mockResolvedValueOnce([
            { id: 'wiki:Beta', source: 'wikipedia', title: 'Beta', subtitle: '', url: '' },
        ]);
        mockedFetchItemDetails.mockResolvedValueOnce({
            title: 'Beta',
            description: 'Beta description',
            estimatedWeightKg: null,
            source: 'wikipedia',
            url: '',
        });

        await user.clear(input);
        await user.type(input, 'beta');
        vi.advanceTimersByTime(400);

        const betaSuggestion = await screen.findByText('Beta');
        await user.click(betaSuggestion);

        await waitFor(() => expect(description).toHaveValue('Custom description'));
        vi.useRealTimers();
    });

    it('keeps weight required even without suggestion', async () => {
        render(
            <MemoryRouter>
                <NewRequestPage />
            </MemoryRouter>
        );

        const weightInput = screen.getByPlaceholderText('0.5');
        expect(weightInput).toBeRequired();
    });
});
