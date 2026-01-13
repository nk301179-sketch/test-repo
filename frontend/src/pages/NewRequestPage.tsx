import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createItemRequest, updateRequest, getRequestById, uploadRequestImages, type CreateItemRequestPayload, type ItemRequest, type CreateItemRequest } from '../services/requestService';
import { fetchItemDetails, fetchItemSuggestions, type ItemSuggestion } from '../services/itemEnrichmentService';
import {
    fetchCountries,
    fetchLocationSuggestions,
    type Country,
    type LocationSuggestion,
} from '../services/geoApi';
import api from '../services/api';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import './Requests.css';

// Upload Icon
const UploadIcon = () => (
    <svg className="image-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);


// Helper function to get country name by code
const getCountryName = (code: string, countries: Country[]): string => {
    return countries.find(c => c.countryCode === code)?.countryName || code;
};

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_CURRENCY = 'USD';

type FieldKey =
    | 'itemName'
    | 'itemDescription'
    | 'images'
    | 'quantity'
    | 'unitPrice'
    | 'estimatedWeightKg'
    | 'sourceCountries'
    | 'deliveryLocation'
    | 'deadline';

type FieldErrors = Partial<Record<FieldKey, string>>;

type ImageItem = {
    file: File | null;
    previewUrl: string;
    originalUrl?: string; // Original URL for existing images (before normalization) - used for submission
    uploadProgress?: number;
    uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
};

const FIELD_KEYS: FieldKey[] = [
    'itemName',
    'itemDescription',
    'images',
    'quantity',
    'unitPrice',
    'estimatedWeightKg',
    'sourceCountries',
    'deliveryLocation',
    'deadline',
];

const isFieldKey = (value: string): value is FieldKey => FIELD_KEYS.includes(value as FieldKey);

const toDateValue = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
};

const toDateTimeLocalValue = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Convert date-only string (YYYY-MM-DD) to end of day Date object
const dateStringToEndOfDay = (dateString: string): Date => {
    const date = new Date(dateString);
    date.setHours(23, 59, 59, 999);
    return date;
};

const toOffsetIsoString = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
};

const buildIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `req_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

// Helper function to normalize image URLs
const normalizeImageUrl = (url: string): string => {
    if (!url) return '';
    // If URL is already absolute (starts with http:// or https://), check if it contains Docker service hostnames
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // Check for Docker service hostnames that need to be converted to proxy paths
        if (url.includes('product-service:8081') || url.includes('product-service/')) {
            // Extract the path part and convert to proxy path
            try {
                const urlObj = new URL(url);
                const normalized = `/product-api${urlObj.pathname}`;
                return normalized;
            } catch (e) {
                // If URL parsing fails, try to extract path manually
                const match = url.match(/\/files\/items\/.*/);
                if (match) {
                    const normalized = `/product-api${match[0]}`;
                    return normalized;
                }
            }
        }
        if (url.includes('sendjob-service:8082') || url.includes('sendjob-service/')) {
            // Extract the path part and convert to proxy path
            try {
                const urlObj = new URL(url);
                const normalized = `/job-api${urlObj.pathname}`;
                return normalized;
            } catch (e) {
                // If URL parsing fails, try to extract path manually
                const match = url.match(/\/uploads\/.*/);
                if (match) {
                    const normalized = `/job-api${match[0]}`;
                    return normalized;
                }
            }
        }
        return url;
    }
    // If URL starts with /files/items/, it's from product-service, prepend /product-api
    if (url.startsWith('/files/items/')) {
        return `/product-api${url}`;
    }
    // If URL already has /product-api prefix, return as is
    if (url.startsWith('/product-api/')) {
        return url;
    }
    // If URL starts with /uploads/, it's from sendjob-service, prepend /job-api
    if (url.startsWith('/uploads/')) {
        return `/job-api${url}`;
    }
    // If URL starts with /, check if it already has /job-api prefix
    if (url.startsWith('/job-api/')) {
        return url;
    }
    if (url.startsWith('/')) {
        // Check if it looks like a product-service file path
        if (url.includes('/files/') || url.includes('/items/')) {
            return `/product-api${url}`;
        }
        // Otherwise assume it's from sendjob-service, prepend /job-api
        return `/job-api${url}`;
    }
    // Otherwise, assume it's a relative URL and prepend /product-api/files/items/
    return `/product-api/files/items/${url}`;
};

const NewRequestPage = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);
    const [loadingRequest, setLoadingRequest] = useState(isEditMode);
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState('');
    const [serverErrors, setServerErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const [imageItems, setImageItems] = useState<ImageItem[]>([]);
    const [imageWarning, setImageWarning] = useState('');
    const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [estimatedWeightKg, setEstimatedWeightKg] = useState('');
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [deadline, setDeadline] = useState('');
    const [fromCountries, setFromCountries] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState('');
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [selectedSuggestion, setSelectedSuggestion] = useState<ItemSuggestion | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [suggestedNoteVisible, setSuggestedNoteVisible] = useState(false);
    const [descriptionTouched, setDescriptionTouched] = useState(false);
    const [weightTouched, setWeightTouched] = useState(false);

    // Delivery location suggestions
    const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
    const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false);
    const [locationSuggestionsError, setLocationSuggestionsError] = useState('');
    const [activeLocationIndex, setActiveLocationIndex] = useState(-1);

    // Saved delivery address from user profile
    const [savedDeliveryAddress, setSavedDeliveryAddress] = useState<{
        street: string;
        city: string;
        stateOrProvince?: string;
        postalCode: string;
        country: string;
    } | null>(null);
    const [useSavedAddress, setUseSavedAddress] = useState(false);

    // Country selection state
    const [allCountries, setAllCountries] = useState<Country[]>([]);
    const [countrySearchQuery, setCountrySearchQuery] = useState('');
    const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [activeCountryIndex, setActiveCountryIndex] = useState(-1);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageItemsRef = useRef<ImageItem[]>([]);
    const suggestionsRequestId = useRef(0);
    const countryInputRef = useRef<HTMLInputElement>(null);
    const countryDropdownRef = useRef<HTMLDivElement>(null);
    const locationSuggestionsRequestId = useRef(0);

    const minDeadline = toDateValue(new Date(Date.now() + 60 * 1000));

    const clearServerError = (field: FieldKey) => {
        setServerErrors((prev) => {
            if (!prev[field]) {
                return prev;
            }
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handleFilesSelected = (files: File[]) => {
        if (!files.length) {
            return;
        }

        setImageWarning('');
        setSubmitError('');
        clearServerError('images');
        setTouched((prev) => ({ ...prev, images: true }));

        const warnings: string[] = [];
        const validFiles = files.filter((file) => {
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                warnings.push(`${file.name} is not a supported format.`);
                return false;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                warnings.push(`${file.name} exceeds 5MB.`);
                return false;
            }
            return true;
        });

        if (!validFiles.length) {
            if (warnings.length) {
                setImageWarning(warnings[0]);
            }
            return;
        }

        const remainingSlots = MAX_IMAGES - imageItems.length;
        if (remainingSlots <= 0) {
            setImageWarning('You can only upload up to 5 images.');
            return;
        }

        const acceptedFiles = validFiles.slice(0, remainingSlots);
        if (validFiles.length > remainingSlots) {
            warnings.push('Only the first 5 images were kept.');
        }

        const newItems: ImageItem[] = acceptedFiles.map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
            uploadProgress: 0,
            uploadStatus: 'pending' as const,
        }));
        setImageItems((prev) => [...prev, ...newItems]);

        if (warnings.length) {
            setImageWarning(warnings[0]);
        }
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = event.target;
        if (files) {
            handleFilesSelected(Array.from(files));
        }
        event.target.value = '';
    };

    const removeImage = (index: number) => {
        setImageItems((prev) => {
            const next = [...prev];
            const [removed] = next.splice(index, 1);
            if (removed && removed.previewUrl.startsWith('blob:')) {
                // Only revoke blob URLs (created from files), not regular URLs
                URL.revokeObjectURL(removed.previewUrl);
            }
            return next;
        });
        setSubmitError('');
        clearServerError('images');
    };

    const moveImage = (index: number, direction: -1 | 1) => {
        setImageItems((prev) => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= prev.length) {
                return prev;
            }
            const next = [...prev];
            const [moved] = next.splice(index, 1);
            next.splice(nextIndex, 0, moved);
            return next;
        });
    };

    const handleCountryAdd = (code: string) => {
        if (fromCountries.includes(code)) {
            return; // Country already added, prevent duplicates
        }
        setFromCountries((prev) => [...prev, code]);
        setCountrySearchQuery('');
        setShowCountryDropdown(false);
        setTouched((prev) => ({ ...prev, sourceCountries: true }));
        clearServerError('sourceCountries');
        setSubmitError('');
    };

    const handleCountryRemove = (code: string) => {
        setFromCountries((prev) => prev.filter((c) => c !== code));
        setTouched((prev) => ({ ...prev, sourceCountries: true }));
        clearServerError('sourceCountries');
        setSubmitError('');
    };

    // Format saved address as a string
    const formatSavedAddress = (address: {
        street: string;
        city: string;
        stateOrProvince?: string;
        postalCode: string;
        country: string;
    }, countries: Country[]): string => {
        const parts: string[] = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.stateOrProvince) parts.push(address.stateOrProvince);
        if (address.postalCode) parts.push(address.postalCode);
        if (address.country) {
            const countryName = getCountryName(address.country, countries);
            parts.push(countryName);
        }
        return parts.join(', ');
    };

    // Load countries and user profile on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const countries = await fetchCountries();
                setAllCountries(countries);

                // Load user profile to get saved delivery address
                try {
                    const userResponse = await api.get('/user/personal-account');
                    const address = userResponse.data?.deliveryAddress;
                    if (address && address.street && address.city && address.country) {
                        setSavedDeliveryAddress(address);
                    }
                } catch (error) {
                    // User might not have a saved address, that's okay
                    console.log('No saved delivery address found');
                }
            } catch (error) {
                console.error('Failed to load countries:', error);
            }
        };
        loadData();
    }, []);

    // Update delivery location when saved address is selected
    useEffect(() => {
        if (useSavedAddress && savedDeliveryAddress && allCountries.length > 0) {
            const formatted = formatSavedAddress(savedDeliveryAddress, allCountries);
            setDeliveryLocation(formatted);
            setTouched((prev) => ({ ...prev, deliveryLocation: true }));
            clearServerError('deliveryLocation');
        } else if (!useSavedAddress && savedDeliveryAddress) {
            // Clear location when unchecking saved address
            setDeliveryLocation('');
        }
    }, [useSavedAddress, savedDeliveryAddress, allCountries]);

    // Filter countries based on search query
    useEffect(() => {
        if (!countrySearchQuery.trim()) {
            setFilteredCountries([]);
            setShowCountryDropdown(false);
            return;
        }

        const query = countrySearchQuery.toLowerCase().trim();
        const filtered = allCountries.filter(
            (country) =>
                country.countryName.toLowerCase().includes(query) ||
                country.countryCode.toLowerCase().includes(query)
        ).filter((country) => !fromCountries.includes(country.countryCode));

        setFilteredCountries(filtered.slice(0, 10)); // Limit to 10 results
        setShowCountryDropdown(filtered.length > 0);
        setActiveCountryIndex(filtered.length > 0 ? 0 : -1);
    }, [countrySearchQuery, allCountries, fromCountries]);

    // Handle country input keyboard navigation
    const handleCountryInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showCountryDropdown || filteredCountries.length === 0) {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveCountryIndex((prev) => (prev + 1) % filteredCountries.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveCountryIndex((prev) => (prev - 1 + filteredCountries.length) % filteredCountries.length);
        } else if (event.key === 'Enter' && activeCountryIndex >= 0) {
            event.preventDefault();
            handleCountryAdd(filteredCountries[activeCountryIndex].countryCode);
        } else if (event.key === 'Escape') {
            setShowCountryDropdown(false);
            setCountrySearchQuery('');
        }
    };

    // Close country dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showCountryDropdown &&
                countryInputRef.current &&
                countryDropdownRef.current &&
                !countryInputRef.current.contains(event.target as Node) &&
                !countryDropdownRef.current.contains(event.target as Node)
            ) {
                setShowCountryDropdown(false);
            }
        };

        if (showCountryDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showCountryDropdown]);

    // Fetch delivery location suggestions (debounced)
    useEffect(() => {
        const trimmed = deliveryLocation.trim();

        if (trimmed.length < 3) {
            setLocationSuggestions([]);
            setLocationSuggestionsLoading(false);
            setLocationSuggestionsError('');
            setActiveLocationIndex(-1);
            return;
        }

        const currentRequestId = ++locationSuggestionsRequestId.current;
        setLocationSuggestionsLoading(true);
        setLocationSuggestionsError('');

        const timer = setTimeout(async () => {
            try {
                const results = await fetchLocationSuggestions(trimmed);
                if (locationSuggestionsRequestId.current !== currentRequestId) {
                    return;
                }
                setLocationSuggestions(results);
                setActiveLocationIndex(results.length > 0 ? 0 : -1);
            } catch (err) {
                if (locationSuggestionsRequestId.current !== currentRequestId) {
                    return;
                }
                setLocationSuggestions([]);
                setLocationSuggestionsError("Couldn't fetch locations. Please refine your search.");
            } finally {
                if (locationSuggestionsRequestId.current === currentRequestId) {
                    setLocationSuggestionsLoading(false);
                }
            }
        }, 400);

        return () => {
            clearTimeout(timer);
        };
    }, [deliveryLocation]);

    const handleLocationSelect = (suggestion: LocationSuggestion) => {
        setDeliveryLocation(suggestion.displayName);
        setLocationSuggestions([]);
        setLocationSuggestionsError('');
        setActiveLocationIndex(-1);
        setSubmitError('');
        clearServerError('deliveryLocation');
    };

    const handleDeliveryLocationKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!locationSuggestions.length) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveLocationIndex((prev) => (prev + 1) % locationSuggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveLocationIndex((prev) => (prev - 1 + locationSuggestions.length) % locationSuggestions.length);
        } else if (event.key === 'Enter' && activeLocationIndex >= 0) {
            event.preventDefault();
            handleLocationSelect(locationSuggestions[activeLocationIndex]);
        } else if (event.key === 'Escape') {
            setLocationSuggestions([]);
        }
    };

    const validateForm = (): FieldErrors => {
        const errors: FieldErrors = {};
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        const trimmedDelivery = deliveryLocation.trim();

        if (!trimmedName) {
            errors.itemName = 'Item name is required.';
        } else if (trimmedName.length > 120) {
            errors.itemName = 'Item name must be 120 characters or less.';
        }

        if (!trimmedDescription) {
            errors.itemDescription = 'Item description is required.';
        } else if (trimmedDescription.length > 2000) {
            errors.itemDescription = 'Item description must be 2000 characters or less.';
        }

        if (imageItems.length === 0) {
            errors.images = 'At least one image is required.';
        } else if (imageItems.length > MAX_IMAGES) {
            errors.images = 'You can upload up to 5 images.';
        } else {
            // Only validate file type and size for new files (not existing images)
            const newImageFiles = imageItems.filter((item) => item.file !== null);
            if (newImageFiles.some((item) => item.file && !ALLOWED_IMAGE_TYPES.includes(item.file.type))) {
                errors.images = 'Only JPG, PNG, or WEBP images are allowed.';
            } else if (newImageFiles.some((item) => item.file && item.file.size > MAX_IMAGE_SIZE)) {
                errors.images = 'Each image must be 5MB or smaller.';
            }
        }

        const quantityValue = Number(quantity);
        if (!quantity || Number.isNaN(quantityValue)) {
            errors.quantity = 'Quantity is required.';
        } else if (!Number.isInteger(quantityValue)) {
            errors.quantity = 'Quantity must be a whole number.';
        } else if (quantityValue <= 0 || quantityValue > 10000) {
            errors.quantity = 'Quantity must be between 1 and 10,000.';
        }

        const unitPriceValue = Number(unitPrice);
        if (!unitPrice || Number.isNaN(unitPriceValue)) {
            errors.unitPrice = 'Unit price is required.';
        } else if (unitPriceValue <= 0) {
            errors.unitPrice = 'Unit price must be greater than zero.';
        }

        const weightValue = Number(estimatedWeightKg);
        if (!estimatedWeightKg || Number.isNaN(weightValue)) {
            errors.estimatedWeightKg = 'Estimated weight is required.';
        } else if (weightValue <= 0 || weightValue > 1000) {
            errors.estimatedWeightKg = 'Weight must be between 0 and 1000 kg.';
        }

        if (fromCountries.length === 0) {
            errors.sourceCountries = 'Select at least one source country.';
        }

        if (!trimmedDelivery) {
            errors.deliveryLocation = 'Delivery location is required.';
        } else if (trimmedDelivery.length > 255) {
            errors.deliveryLocation = 'Delivery location must be 255 characters or less.';
        }

        if (!deadline) {
            errors.deadline = 'Deadline is required.';
        } else {
            const deadlineDate = dateStringToEndOfDay(deadline);
            if (Number.isNaN(deadlineDate.getTime())) {
                errors.deadline = 'Deadline must be a valid date.';
            } else if (deadlineDate.getTime() <= Date.now()) {
                errors.deadline = 'Deadline must be in the future.';
            }
        }

        return errors;
    };

    const validationErrors = validateForm();
    const isFormValid = Object.keys(validationErrors).length === 0;
    const showError = (field: FieldKey) => submitAttempted || touched[field];
    const getFieldError = (field: FieldKey) => serverErrors[field] || (showError(field) ? validationErrors[field] : undefined);

    const quantityValue = Number(quantity);
    const unitPriceValue = Number(unitPrice);
    const totalPrice = Number.isFinite(quantityValue) && Number.isFinite(unitPriceValue)
        ? quantityValue * unitPriceValue
        : 0;


    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitAttempted(true);
        setSubmitError('');
        setSubmitSuccess('');
        setServerErrors({});

        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            return;
        }

        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        const trimmedDelivery = deliveryLocation.trim();
        // Convert date-only string to end of day
        const deadlineDate = dateStringToEndOfDay(deadline);
        const formattedDeadline = toOffsetIsoString(deadlineDate);
        const nextIdempotencyKey = idempotencyKey || buildIdempotencyKey();

        if (!idempotencyKey) {
            setIdempotencyKey(nextIdempotencyKey);
        }

        const payload: CreateItemRequestPayload = {
            itemName: trimmedName,
            itemDescription: trimmedDescription,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            currency: DEFAULT_CURRENCY,
            estimatedWeightKg: Number(estimatedWeightKg),
            sourceCountries: fromCountries,
            deliveryLocation: trimmedDelivery,
            deadline: formattedDeadline,
        };

        // Reset upload status
        setImageItems((prev) => prev.map((item) => ({
            ...item,
            uploadProgress: 0,
            uploadStatus: 'pending' as const,
        })));

        setLoading(true);
        try {
            if (isEditMode && id) {
                // Edit mode - use updateRequest
                // For update, we need to send existing image URLs + any new files
                // First, upload any new image files
                const newImageFiles = imageItems.filter(item => item.file).map(item => item.file);
                let imageUrls: string[] = [];

                if (newImageFiles.length > 0) {
                    // Upload new images
                    const uploadedUrls = await uploadRequestImages(newImageFiles);
                    imageUrls = uploadedUrls;
                }

                // Include existing image URLs (those without files)
                // Use originalUrl if available (for existing images), otherwise use previewUrl
                const existingImageUrls = imageItems
                    .filter(item => !item.file && (item.originalUrl || item.previewUrl) && !item.previewUrl.startsWith('blob:'))
                    .map(item => item.originalUrl || item.previewUrl);
                
                const allImageUrls = [...existingImageUrls, ...imageUrls];

                // Validate that we have at least one image
                if (allImageUrls.length === 0) {
                    throw new Error('At least one image is required');
                }

                // Prepare update payload
                // For update, deadline should be just the date (YYYY-MM-DD) as backend expects LocalDate
                const updatePayload: CreateItemRequest = {
                    name: trimmedName,
                    description: trimmedDescription,
                    startingBid: Number(unitPrice),
                    quantity: Number(quantity),
                    estimatedWeightKg: Number(estimatedWeightKg),
                    fromCountries: fromCountries,
                    deliveryLocation: trimmedDelivery,
                    deadline: deadline, // Use date string directly (YYYY-MM-DD) for LocalDate
                    images: allImageUrls,
                };

                await updateRequest(id, updatePayload);
                setSubmitSuccess('Request updated successfully');
                
                // Navigate to requests page after 1.5 seconds
                setTimeout(() => {
                    navigate('/requests');
                }, 1500);
            } else {
                // Create mode - use createItemRequest
                // Update images to uploading status
                setImageItems((prev) => prev.map((item) => ({
                    ...item,
                    uploadStatus: 'uploading' as const,
                    uploadProgress: 0,
                })));

                // Simulate upload progress (since we can't track actual progress with current API)
                // In a real implementation, you'd use XMLHttpRequest with onprogress
                let progressValue = 0;
                const progressInterval = setInterval(() => {
                    progressValue = Math.min(progressValue + Math.random() * 15 + 5, 90);
                    setImageItems((prev) => prev.map((item) => {
                        if (item.uploadStatus === 'uploading') {
                            return {
                                ...item,
                                uploadProgress: progressValue,
                            };
                        }
                        return item;
                    }));
                }, 200);

                const imageFiles = imageItems
                    .map((item) => item.file)
                    .filter((file): file is File => file !== null);
                
                if (imageFiles.length === 0) {
                    throw new Error('At least one image file is required');
                }

                const response = await createItemRequest(
                    payload,
                    imageFiles,
                    nextIdempotencyKey
                );

                clearInterval(progressInterval);

                // Mark all images as completed
                setImageItems((prev) => prev.map((item) => ({
                    ...item,
                    uploadStatus: 'completed' as const,
                    uploadProgress: 100,
                })));

                // Clear success overlay after 2 seconds
                setTimeout(() => {
                    setImageItems((prev) => prev.map((item) => ({
                        ...item,
                        uploadStatus: 'pending' as const,
                    })));
                }, 2000);

                setSubmitSuccess(`Request created. ID: ${response.requestId}`);
                setIdempotencyKey(null);
                
                // Navigate to requests page after 1.5 seconds
                setTimeout(() => {
                    navigate('/requests');
                }, 1500);
            }
        } catch (err: any) {
            // Mark images as error
            setImageItems((prev) => prev.map((item) => ({
                ...item,
                uploadStatus: 'error' as const,
            })));

            const responseErrors = err?.response?.data?.errors;
            if (responseErrors) {
                const mappedErrors: FieldErrors = {};
                if (Array.isArray(responseErrors)) {
                    responseErrors.forEach((errorItem) => {
                        if (errorItem?.field && errorItem?.message) {
                            if (isFieldKey(errorItem.field)) {
                                mappedErrors[errorItem.field] = errorItem.message;
                            }
                        }
                    });
                } else if (typeof responseErrors === 'object') {
                    Object.entries(responseErrors).forEach(([field, message]) => {
                        if (typeof message === 'string' && isFieldKey(field)) {
                            mappedErrors[field] = message;
                        }
                    });
                }

                if (Object.keys(mappedErrors).length > 0) {
                    setServerErrors(mappedErrors);
                    setLoading(false);
                    return;
                }
            }
            setSubmitError(err?.response?.data?.message || err?.message || 'Failed to create request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedSuggestion || name.trim().length < 3) {
            setSuggestions([]);
            setSuggestionsLoading(false);
            if (name.trim().length < 3) {
                setSuggestionsError('');
            }
            return;
        }

        const currentRequestId = ++suggestionsRequestId.current;
        setSuggestionsLoading(true);
        setSuggestionsError('');

        const timer = setTimeout(async () => {
            try {
                const response = await fetchItemSuggestions(name.trim());
                if (suggestionsRequestId.current !== currentRequestId) {
                    return;
                }
                setSuggestions(response.slice(0, 8));
                setActiveSuggestionIndex(response.length > 0 ? 0 : -1);
            } catch (err) {
                if (suggestionsRequestId.current !== currentRequestId) {
                    return;
                }
                setSuggestions([]);
                setSuggestionsError("Couldn't fetch suggestions. Continue typing.");
            } finally {
                if (suggestionsRequestId.current === currentRequestId) {
                    setSuggestionsLoading(false);
                }
            }
        }, 400);

        return () => {
            clearTimeout(timer);
        };
    }, [name, selectedSuggestion]);

    const handleSuggestionSelect = async (suggestion: ItemSuggestion, forceOverride = false) => {
        setSelectedSuggestion(suggestion);
        setName(suggestion.title);
        setSuggestions([]);
        setSuggestionsError('');
        setActiveSuggestionIndex(-1);
        setSuggestedNoteVisible(true);

        setDetailsLoading(true);
        try {
            const details = await fetchItemDetails(suggestion.source, suggestion.id);

            if (details.description && (forceOverride || !descriptionTouched || description.trim() === '')) {
                setDescription(details.description);
                if (forceOverride) {
                    setDescriptionTouched(false);
                }
            }

            if (details.estimatedWeightKg != null) {
                if (forceOverride || (!weightTouched && estimatedWeightKg.trim() === '')) {
                    setEstimatedWeightKg(details.estimatedWeightKg.toString());
                    if (forceOverride) {
                        setWeightTouched(false);
                    }
                }
            }
        } catch (err) {
            setSuggestionsError("Couldn't fetch suggestions. Continue typing.");
        } finally {
            setDetailsLoading(false);
        }
    };

    const clearSelectedSuggestion = () => {
        setSelectedSuggestion(null);
        setSuggestedNoteVisible(false);
        setSuggestionsError('');
    };

    const handleItemNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!suggestions.length) {
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
            event.preventDefault();
            handleSuggestionSelect(suggestions[activeSuggestionIndex]);
        } else if (event.key === 'Escape') {
            setSuggestions([]);
        }
    };

    useEffect(() => {
        imageItemsRef.current = imageItems;
    }, [imageItems]);

    useEffect(() => {
        return () => {
            imageItemsRef.current.forEach((item) => {
                // Only revoke blob URLs (created from files), not regular URLs
                if (item.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            });
        };
    }, []);

    // Load request data when in edit mode
    useEffect(() => {
        if (!isEditMode || !id) return;

        const loadRequest = async () => {
            try {
                setLoadingRequest(true);
                setImageErrors(new Set()); // Clear any previous image errors
                const request = await getRequestById(id);
                
                // Pre-populate form fields
                setName(request.name || '');
                setDescription(request.description || '');
                setUnitPrice(request.startingBid?.toString() || '');
                setQuantity(request.quantity?.toString() || '1');
                setEstimatedWeightKg(request.estimatedWeightKg?.toString() || '');
                setDeliveryLocation(request.deliveryLocation || '');
                setFromCountries(request.fromCountries || []);
                
                // Set deadline - convert ISO string to date input format
                if (request.deadline) {
                    const deadlineDate = new Date(request.deadline);
                    setDeadline(toDateValue(deadlineDate));
                }

                // Handle existing images - convert URLs to display format
                if (request.images && request.images.length > 0) {
                    // For edit mode, we'll store the URLs as preview URLs
                    // When submitting, we'll need to handle both new files and existing URLs
                    // Always normalize URLs for display (Docker service names won't work in browser)
                    const existingImageItems: ImageItem[] = request.images.map((url) => {
                        const normalizedUrl = normalizeImageUrl(url);
                        console.log('Loading image in edit mode:', { original: url, normalized: normalizedUrl });
                        return {
                            file: null, // Mark as existing URL
                            previewUrl: normalizedUrl, // Use normalized URL for display
                            originalUrl: url, // Original URL for submission back to backend
                            uploadStatus: 'pending' as const, // Use 'pending' for existing images so overlays don't show
                            uploadProgress: 0,
                        };
                    });
                    setImageItems(existingImageItems);
                } else {
                    console.log('No images found in request');
                }
            } catch (error: any) {
                console.error('Error loading request:', error);
                setSubmitError(error?.response?.data?.message || 'Failed to load request. Please try again.');
                // Navigate back to requests page after a delay
                setTimeout(() => {
                    navigate('/requests');
                }, 2000);
            } finally {
                setLoadingRequest(false);
            }
        };

        loadRequest();
    }, [id, isEditMode, navigate]);

    return (
        <div className="new-request-page">
            <div className="new-request-card">
                <h1 className="new-request-title">{isEditMode ? 'Edit Item Request' : 'Create Item Request'}</h1>
                <p className="new-request-subtitle">{isEditMode ? 'Update the item details below.' : 'Share the item details and we will find a carrier.'}</p>
                
                {loadingRequest && (
                    <div style={{ marginBottom: '1.5rem', padding: '10px', textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                        <p>Loading request...</p>
                    </div>
                )}

                {submitError && (
                    <div className="auth-error" style={{ marginBottom: '1.5rem', color: 'red', padding: '10px', background: '#ffe6e6', borderRadius: '4px' }}>
                        <span>{submitError}</span>
                    </div>
                )}

                {submitSuccess && (
                    <div className="auth-success" style={{ marginBottom: '1.5rem', color: '#065f46', padding: '10px', background: '#d1fae5', borderRadius: '4px' }}>
                        <span>{submitSuccess}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ opacity: loadingRequest ? 0.5 : 1, pointerEvents: loadingRequest ? 'none' : 'auto' }}>
                    {/* Item Details */}
                    <div className="form-section">
                        <h3 className="form-section-title">Item Details</h3>

                        <div className="form-group">
                            <div className="form-label-row">
                                <label className="form-label">Images * (Max 5)</label>
                                <span className="image-counter">{imageItems.length} / {MAX_IMAGES}</span>
                            </div>
                            <div
                                className={`image-upload-area ${isDragging ? 'drag-active' : ''}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setIsDragging(false);
                                    handleFilesSelected(Array.from(event.dataTransfer.files));
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <UploadIcon />
                                <p className="image-upload-text">
                                    <strong>Click to upload</strong> or drag and drop images
                                </p>
                                <p className="image-upload-hint">JPG, PNG, or WEBP up to 5MB each</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    multiple
                                    onChange={handleImageChange}
                                    style={{ display: 'none' }}
                                />
                            </div>
                            {imageWarning && <div className="form-warning">{imageWarning}</div>}
                            {getFieldError('images') && <div className="form-error">{getFieldError('images')}</div>}
                            {imageItems.length > 0 && (
                                <PhotoProvider
                                    speed={() => 300}
                                    easing={(type) => (type === 2 ? 'cubic-bezier(0.36, 0, 0.66, -0.56)' : 'cubic-bezier(0.34, 1.56, 0.64, 1)')}
                                >
                                    <div className="image-preview-grid">
                                        {imageItems.map((item, idx) => {
                                            // previewUrl is already normalized for existing images in edit mode
                                            // For new images, previewUrl is a blob URL
                                            const imageUrl = item.previewUrl;
                                            
                                            return (
                                                <div key={`${item.previewUrl}-${idx}`} className="image-preview">
                                                    <div className="image-preview-wrapper">
                                                        {imageErrors.has(idx) ? (
                                                            <div className="image-error-placeholder" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '0.5rem' }}>
                                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                                    <polyline points="21 15 16 10 5 21"></polyline>
                                                                </svg>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Failed to load</span>
                                                            </div>
                                                        ) : imageUrl ? (
                                                            <PhotoView 
                                                                src={imageUrl}
                                                                key={`photo-${idx}-${imageUrl}`}
                                                            >
                                                                <img 
                                                                    src={imageUrl} 
                                                                    alt={`Preview ${idx + 1}`}
                                                                    onLoad={() => {
                                                                        console.log('Image loaded successfully:', imageUrl);
                                                                    }}
                                                                    onError={(e) => {
                                                                        console.error('Image failed to load:', imageUrl, 'Original URL:', item.originalUrl);
                                                                        // If image fails to load, try originalUrl if available (for existing images)
                                                                        if (item.originalUrl) {
                                                                            const fallbackUrl = normalizeImageUrl(item.originalUrl);
                                                                            console.log('Trying fallback URL:', fallbackUrl);
                                                                            if (fallbackUrl !== e.currentTarget.src) {
                                                                                e.currentTarget.src = fallbackUrl;
                                                                            } else {
                                                                                setImageErrors(prev => new Set(prev).add(idx));
                                                                            }
                                                                        } else {
                                                                            // Mark as error if image fails to load
                                                                            setImageErrors(prev => new Set(prev).add(idx));
                                                                        }
                                                                    }}
                                                                    loading="lazy"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                                />
                                                            </PhotoView>
                                                        ) : (
                                                            <div className="image-error-placeholder" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No image URL</span>
                                                            </div>
                                                        )}
                                                    {/* Only show upload status overlays for new files being uploaded, not for existing images */}
                                                    {item.file && item.uploadStatus === 'uploading' && (
                                                        <div className="image-upload-progress-overlay">
                                                            <div className="image-upload-progress-bar">
                                                                <div 
                                                                    className="image-upload-progress-fill" 
                                                                    style={{ width: `${Math.max(0, Math.min(100, item.uploadProgress || 0))}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="image-upload-progress-text">
                                                                {Math.round(Math.max(0, Math.min(100, item.uploadProgress || 0)))}%
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* Only show success overlay temporarily for newly uploaded files, not existing images */}
                                                    {item.file && item.uploadStatus === 'completed' && (
                                                        <div className="image-upload-success-overlay">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        </div>
                                                    )}
                                                    {item.file && item.uploadStatus === 'error' && (
                                                        <div className="image-upload-error-overlay">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="image-preview-controls">
                                                    <button
                                                        type="button"
                                                        className="image-preview-move"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            moveImage(idx, -1);
                                                        }}
                                                        disabled={idx === 0}
                                                        aria-label="Move image up"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="image-preview-move"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            moveImage(idx, 1);
                                                        }}
                                                        disabled={idx === imageItems.length - 1}
                                                        aria-label="Move image down"
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="image-preview-remove"
                                                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                                        aria-label="Remove image"
                                                        disabled={item.uploadStatus === 'uploading'}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </PhotoProvider>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Item Name *</label>
                            <div className="suggestion-input-wrapper">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setSubmitError('');
                                        clearServerError('itemName');
                                        if (selectedSuggestion) {
                                            clearSelectedSuggestion();
                                        }
                                    }}
                                    onBlur={() => setTouched((prev) => ({ ...prev, itemName: true }))}
                                    onKeyDown={handleItemNameKeyDown}
                                    className="form-input"
                                    placeholder="e.g., iPhone 15 Pro, Nike Air Max"
                                    required
                                    maxLength={120}
                                />
                                {selectedSuggestion && (
                                    <button
                                        type="button"
                                        className="suggestion-clear"
                                        onClick={clearSelectedSuggestion}
                                    >
                                        Clear
                                    </button>
                                )}
                                {(suggestionsLoading || suggestions.length > 0 || suggestionsError) && !selectedSuggestion && (
                                    <div className="suggestion-dropdown">
                                        {suggestionsLoading && (
                                            <div className="suggestion-loading">
                                                <span className="suggestion-spinner" />
                                                Searching...
                                            </div>
                                        )}
                                        {!suggestionsLoading && suggestionsError && (
                                            <div className="suggestion-error">{suggestionsError}</div>
                                        )}
                                        {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && name.trim().length >= 3 && (
                                            <div className="suggestion-empty">No suggestions yet.</div>
                                        )}
                                        {!suggestionsLoading && suggestions.length > 0 && (
                                            <ul className="suggestion-list">
                                                {suggestions.map((suggestion, index) => (
                                                    <li
                                                        key={`${suggestion.source}-${suggestion.id}`}
                                                        className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            handleSuggestionSelect(suggestion);
                                                        }}
                                                    >
                                                        <div className="suggestion-title">{suggestion.title}</div>
                                                        <div className="suggestion-meta">
                                                            <span className="suggestion-source">
                                                                {suggestion.source === 'wikipedia' ? 'Wikipedia' : 'DuckDuckGo'}
                                                            </span>
                                                            {suggestion.subtitle && <span className="suggestion-subtitle">{suggestion.subtitle}</span>}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                            {getFieldError('itemName') && <div className="form-error">{getFieldError('itemName')}</div>}
                            {suggestionsError && selectedSuggestion && (
                                <div className="suggestion-error-inline">{suggestionsError}</div>
                            )}
                        </div>

                        <div className="form-group full-width">
                            <label className="form-label">Item Description *</label>
                            <textarea
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value);
                                    setDescriptionTouched(true);
                                    setSubmitError('');
                                    clearServerError('itemDescription');
                                }}
                                onBlur={() => setTouched((prev) => ({ ...prev, itemDescription: true }))}
                                className="form-textarea"
                                placeholder="Describe the item in detail (color, size, model, etc.)..."
                                maxLength={2000}
                                required
                            />
                            <div className="suggestion-actions">
                                {suggestedNoteVisible && (
                                    <span className="suggestion-note">Suggested from web</span>
                                )}
                                <button
                                    type="button"
                                    className="suggestion-resuggest"
                                    onClick={() => selectedSuggestion && handleSuggestionSelect(selectedSuggestion, true)}
                                    disabled={!selectedSuggestion || detailsLoading}
                                >
                                    {detailsLoading ? 'Fetching...' : 'Re-suggest'}
                                </button>
                            </div>
                            {getFieldError('itemDescription') && <div className="form-error">{getFieldError('itemDescription')}</div>}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Estimated Weight (kg) *</label>
                                <input
                                    type="number"
                                    value={estimatedWeightKg}
                                    onChange={(e) => {
                                        setEstimatedWeightKg(e.target.value);
                                        setWeightTouched(true);
                                        setSubmitError('');
                                        clearServerError('estimatedWeightKg');
                                    }}
                                    onBlur={() => setTouched((prev) => ({ ...prev, estimatedWeightKg: true }))}
                                    className="form-input"
                                    placeholder="0.5"
                                    step="0.1"
                                    min="0.1"
                                    max="1000"
                                    required
                                />
                                {getFieldError('estimatedWeightKg') && <div className="form-error">{getFieldError('estimatedWeightKg')}</div>}
                            </div>
                        </div>
                    </div>

                    {/* Logistics */}
                    <div className="form-section">
                        <h3 className="form-section-title">Logistics</h3>

                        <div className="form-group full-width">
                            <label className="form-label">Source Countries *</label>
                            
                            {/* Selected countries display */}
                            {fromCountries.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    {fromCountries.map((code) => (
                                        <div
                                            key={code}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                border: '1px solid #4f46e5',
                                                backgroundColor: '#e0e7ff',
                                                color: '#4f46e5',
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            <span>{getCountryName(code, allCountries)}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleCountryRemove(code)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#4f46e5',
                                                    cursor: 'pointer',
                                                    padding: '0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    fontSize: '1rem',
                                                    lineHeight: '1'
                                                }}
                                                aria-label={`Remove ${getCountryName(code, allCountries)}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Country search input */}
                            <div style={{ position: 'relative' }}>
                                <input
                                    ref={countryInputRef}
                                    type="text"
                                    value={countrySearchQuery}
                                    onChange={(e) => {
                                        setCountrySearchQuery(e.target.value);
                                        setTouched((prev) => ({ ...prev, sourceCountries: true }));
                                        clearServerError('sourceCountries');
                                    }}
                                    onFocus={() => {
                                        if (countrySearchQuery.trim() && filteredCountries.length > 0) {
                                            setShowCountryDropdown(true);
                                        }
                                    }}
                                    onKeyDown={handleCountryInputKeyDown}
                                    onBlur={() => {
                                        // Dropdown closing is handled by click-outside handler
                                    }}
                                    className="form-input"
                                    placeholder="Search and add countries..."
                                    style={{ width: '100%' }}
                                />
                                
                                {/* Country dropdown */}
                                {showCountryDropdown && filteredCountries.length > 0 && (
                                    <div
                                        ref={countryDropdownRef}
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            zIndex: 1000,
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            marginTop: '4px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                    >
                                        {filteredCountries.map((country, index) => (
                                            <button
                                                key={country.countryCode}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevent input blur
                                                    handleCountryAdd(country.countryCode);
                                                }}
                                                onMouseEnter={() => setActiveCountryIndex(index)}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '8px 12px',
                                                    border: 'none',
                                                    backgroundColor: index === activeCountryIndex ? '#f3f4f6' : 'white',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    display: 'block'
                                                }}
                                            >
                                                {country.countryName} ({country.countryCode})
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {getFieldError('sourceCountries') && <div className="form-error">{getFieldError('sourceCountries')}</div>}
                            <small className="form-hint">
                                {fromCountries.length > 0 
                                    ? `Selected: ${fromCountries.map(c => getCountryName(c, allCountries)).join(', ')}`
                                    : 'Type to search and add countries'}
                            </small>
                        </div>

                        <div className="form-group full-width">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                                <label className="form-label" style={{ margin: 0 }}>Delivery Location *</label>
                                {savedDeliveryAddress && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={useSavedAddress}
                                            onChange={(e) => {
                                                setUseSavedAddress(e.target.checked);
                                                if (!e.target.checked) {
                                                    setDeliveryLocation('');
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span>Use my saved address</span>
                                    </label>
                                )}
                            </div>
                            <div className="suggestion-input-wrapper">
                                <input
                                    type="text"
                                    value={deliveryLocation}
                                    onChange={(e) => {
                                        if (!useSavedAddress) {
                                            setDeliveryLocation(e.target.value);
                                            setSubmitError('');
                                            clearServerError('deliveryLocation');
                                        }
                                    }}
                                    onBlur={() => setTouched((prev) => ({ ...prev, deliveryLocation: true }))}
                                    onKeyDown={handleDeliveryLocationKeyDown}
                                    className="form-input"
                                    placeholder={useSavedAddress ? "Using saved address" : "City, Country (e.g., Colombo, Sri Lanka)"}
                                    maxLength={255}
                                    required
                                    disabled={useSavedAddress}
                                    style={useSavedAddress ? { backgroundColor: 'rgba(15, 23, 42, 0.03)', cursor: 'not-allowed' } : {}}
                                />

                                {(locationSuggestionsLoading || locationSuggestions.length > 0 || locationSuggestionsError) && (
                                    <div className="suggestion-dropdown">
                                        {locationSuggestionsLoading && (
                                            <div className="suggestion-loading">
                                                <span className="suggestion-spinner" />
                                                Searching locations...
                                            </div>
                                        )}
                                        {!locationSuggestionsLoading && locationSuggestionsError && (
                                            <div className="suggestion-error">{locationSuggestionsError}</div>
                                        )}
                                        {!locationSuggestionsLoading &&
                                            !locationSuggestionsError &&
                                            locationSuggestions.length === 0 &&
                                            deliveryLocation.trim().length >= 3 && (
                                                <div className="suggestion-empty">No locations found.</div>
                                            )}
                                        {!locationSuggestionsLoading && locationSuggestions.length > 0 && (
                                            <ul className="suggestion-list">
                                                {locationSuggestions.map((suggestion, index) => (
                                                    <li
                                                        key={suggestion.id}
                                                        className={`suggestion-item ${index === activeLocationIndex ? 'active' : ''}`}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            handleLocationSelect(suggestion);
                                                        }}
                                                    >
                                                        <div className="suggestion-title">{suggestion.displayName}</div>
                                                        {(suggestion.city || suggestion.country) && (
                                                            <div className="suggestion-meta">
                                                                {suggestion.city && <span className="suggestion-subtitle">{suggestion.city}</span>}
                                                                {suggestion.country && (
                                                                    <span className="suggestion-source">{suggestion.country}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                            {getFieldError('deliveryLocation') && <div className="form-error">{getFieldError('deliveryLocation')}</div>}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Deadline *</label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={(e) => {
                                    setDeadline(e.target.value);
                                    setSubmitError('');
                                    clearServerError('deadline');
                                }}
                                onBlur={() => setTouched((prev) => ({ ...prev, deadline: true }))}
                                className="form-input"
                                required
                                min={minDeadline}
                            />
                            {getFieldError('deadline') && <div className="form-error">{getFieldError('deadline')}</div>}
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="form-section">
                        <h3 className="form-section-title">Pricing</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Quantity *</label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => {
                                        setQuantity(e.target.value);
                                        setSubmitError('');
                                        clearServerError('quantity');
                                    }}
                                    onBlur={() => setTouched((prev) => ({ ...prev, quantity: true }))}
                                    className="form-input"
                                    min="1"
                                    max="10000"
                                    step="1"
                                    required
                                />
                                {getFieldError('quantity') && <div className="form-error">{getFieldError('quantity')}</div>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Unit Price ({DEFAULT_CURRENCY}) *</label>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={(e) => {
                                        setUnitPrice(e.target.value);
                                        setSubmitError('');
                                        clearServerError('unitPrice');
                                    }}
                                    onBlur={() => setTouched((prev) => ({ ...prev, unitPrice: true }))}
                                    className="form-input"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0.01"
                                    required
                                />
                                {getFieldError('unitPrice') && <div className="form-error">{getFieldError('unitPrice')}</div>}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Total Price (Estimated)</label>
                            <input
                                type="text"
                                value={`${DEFAULT_CURRENCY} ${totalPrice.toFixed(2)}`}
                                className="form-input form-input-readonly"
                                readOnly
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/requests')}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !isFormValid}
                        >
                            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Request' : 'Create Request')}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default NewRequestPage;
