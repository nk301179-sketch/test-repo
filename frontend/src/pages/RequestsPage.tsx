import { useState, useEffect } from 'react';
import { getMyRequests, cancelRequest, type ItemRequest } from '../services/requestService';
import { clearTokens } from '../services/tokenStorage';
import { hasPendingRole } from '../services/auth';
import api from '../services/api';
import { buildUserMgmtUrl } from '../services/userMgmt';
import { resolveBaseUrl } from '../services/url';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import './Requests.css';
import './HomePage.css';

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

// Location Pin Icon
const LocationIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
    </svg>
);

// Close Icon
const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'AU', name: 'Australia' },
    { code: 'CN', name: 'China' },
    { code: 'IN', name: 'India' },
    { code: 'BR', name: 'Brazil' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'SG', name: 'Singapore' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' }
];

const getCountryName = (code: string): string => {
    return COUNTRIES.find(c => c.code === code)?.name || code;
};

const RequestsPage = () => {
    const [requests, setRequests] = useState<ItemRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('NEWEST');
    const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(null);
    const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

    // Navigation state
    const [userData, setUserData] = useState<{ name?: string; email?: string }>({});
    const [showDropdown, setShowDropdown] = useState(false);
    const [hasPending, setHasPending] = useState(false);

    useEffect(() => {
        fetchRequests();
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const response = await api.get('/user/personal-account');
            setUserData(response.data);
            const isPending = await hasPendingRole();
            setHasPending(isPending);
        } catch (err) {
            console.error('Failed to load user data:', err);
        }
    };

    const handleLogout = () => {
        clearTokens();
        window.location.replace(buildUserMgmtUrl('/signin', window.location.href));
    };

    const getUserInitials = () => {
        if (userData.name) {
            return userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (userData.email) {
            return userData.email[0].toUpperCase();
        }
        return 'U';
    };

    const fetchRequests = async () => {
        try {
            const data = await getMyRequests();
            setRequests(data);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: string) => {
        try {
            if (confirm('Are you sure you want to cancel this request?')) {
                await cancelRequest(id);
                fetchRequests();
                setSelectedRequest(null);
            }
        } catch (error) {
            console.error('Error cancelling request:', error);
            alert('Failed to cancel request');
        }
    };


    const getStatusClass = (status: string) => {
        const statusMap: Record<string, string> = {
            'POSTED': 'posted',
            'ACCEPTED': 'accepted',
            'IN_TRANSIT': 'in-transit',
            'DELIVERED': 'delivered',
            'CANCELLED': 'cancelled',
        };
        return statusMap[status] || 'draft';
    };

    const filteredRequests = requests.filter(req => {
        if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return req.name.toLowerCase().includes(query) ||
                req.deliveryLocation.toLowerCase().includes(query);
        }
        return true;
    }).sort((a: ItemRequest, b: ItemRequest) => {
        if (sortOption === 'NEWEST') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (sortOption === 'OLDEST') {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortOption === 'DEADLINE') {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        } else if (sortOption === 'PRICE_HIGH') {
            return b.totalPrice - a.totalPrice;
        }
        return 0;
    });

    return (
        <div className="homepage-container">
            {/* Animated Background */}
            <div className="homepage-background">
                <div className="homepage-shape homepage-shape-1"></div>
                <div className="homepage-shape homepage-shape-2"></div>
                <div className="homepage-shape homepage-shape-3"></div>
            </div>

            {/* Navigation Header */}
            <nav className="homepage-nav">
                <div className="nav-content">
                    {/* Logo */}
                    <a href="/" className="nav-logo">
                        <svg className="nav-logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="24" cy="16" r="8" stroke="white" strokeWidth="3" fill="none" />
                            <circle cx="16" cy="28" r="8" stroke="white" strokeWidth="3" fill="none" />
                            <circle cx="32" cy="28" r="8" stroke="white" strokeWidth="3" fill="none" />
                            <circle cx="24" cy="16" r="3" fill="white" />
                            <circle cx="16" cy="28" r="3" fill="white" />
                            <circle cx="32" cy="28" r="3" fill="white" />
                        </svg>
                        <span className="nav-logo-text">CarryNgo</span>
                    </a>

                    {/* Navigation Links */}
                    <div className="nav-links">
                        <button className="nav-link" onClick={() => window.location.href = '/'}>
                            <svg className="nav-link-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Home</span>
                        </button>
                        <button className="nav-link">
                            <svg className="nav-link-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="16,8 20,8 23,11 23,16 16,16 16,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                                <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <span>Delivery</span>
                        </button>
                        <button className="nav-link active">
                            <svg className="nav-link-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Requests</span>
                        </button>

                        {hasPending && (
                            <button
                                className="nav-link nav-link-complete-profile"
                                onClick={() => window.location.replace(buildUserMgmtUrl('/complete-profile', window.location.href))}
                            >
                                <svg className="nav-link-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <span>Complete Profile</span>
                                <span className="nav-link-badge">!</span>
                            </button>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="nav-user">
                        <button
                            className="nav-link primary-button"
                            onClick={() => window.location.href = '/requests/new'}
                            style={{ background: 'var(--gradient-brand)', border: 'none', color: 'white', fontWeight: 700 }}
                        >
                            <svg className="nav-link-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>New</span>
                        </button>
                        <button
                            className="nav-user-button"
                            onClick={() => setShowDropdown(!showDropdown)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        >
                            <div className="nav-user-avatar">
                                {getUserInitials()}
                            </div>
                            <span>{userData.name?.split(' ')[0] || 'User'}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        <div className={`nav-user-dropdown ${showDropdown ? 'visible' : ''}`}>
                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    setShowDropdown(false);
                                    window.location.replace(buildUserMgmtUrl('/complete-profile', window.location.href));
                                }}
                            >
                                <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Profile
                            </button>
                            <button className="dropdown-item danger" onClick={handleLogout}>
                                <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points="16,17 21,12 16,7" strokeLinecap="round" strokeLinejoin="round" />
                                    <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Page Content */}
            <div className="requests-page">
                {/* Header */}
                <div className="requests-header">
                    <h1 className="requests-title">My Requests</h1>
                    <div className="requests-filters">
                        <input
                            type="text"
                            placeholder="Search requests..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="requests-search"
                        />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="requests-select"
                        >
                            <option value="ALL">All Status</option>
                            <option value="POSTED">Posted</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="IN_TRANSIT">In Transit</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="requests-select"
                        >
                            <option value="NEWEST">Newest</option>
                            <option value="OLDEST">Oldest</option>
                            <option value="DEADLINE">Deadline</option>
                            <option value="PRICE_HIGH">Highest Price</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="requests-loading">
                        <div className="spinner"></div>
                        <p>Loading your requests...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="requests-empty">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" style={{ marginBottom: '1.5rem', opacity: 0.5 }}>
                            <path d="M21 8H3V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2zM21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
                            <path d="M10 12h4" strokeLinecap="round" />
                        </svg>
                        <h3>No requests found</h3>
                        <p>You haven't created any requests yet. Start by clicking the "+ New" button.</p>
                        <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => window.location.href = '/requests/new'}>
                            Create New Request
                        </button>
                    </div>
                ) : (
                    <div className="requests-grid">
                        {filteredRequests.map((req: ItemRequest) => (
                            <div key={req.id} className="request-card" onClick={() => setSelectedRequest(req)}>
                                <div className="request-card-header">
                                    <span className={`request-status ${getStatusClass(req.status)}`}>
                                        {req.status}
                                    </span>
                                    <span className="request-date">
                                        {new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                <h3 className="request-card-title">{req.name}</h3>
                                <div className="request-card-images">
                                    {req.images?.slice(0, 3).map((url: string, idx: number) => (
                                        <img key={idx} src={normalizeImageUrl(url)} alt="Item" className="request-card-image" loading="lazy" />
                                    ))}
                                    {(!req.images || req.images.length === 0) && (
                                        <div className="request-card-image-placeholder">No Image</div>
                                    )}
                                </div>
                                <div className="request-card-details">
                                    <span className="request-card-qty">Quantity: {req.quantity}</span>
                                    <span className="request-card-price">${req.totalPrice}</span>
                                </div>
                                <div className="request-card-location">
                                    <LocationIcon />
                                    <span>{req.deliveryLocation}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {selectedRequest && (
                    <div className="request-modal-overlay" onClick={() => setSelectedRequest(null)}>
                        <div className="request-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="request-modal-header">
                                <h2 className="request-modal-title">Request Details</h2>
                                <button className="request-modal-close" onClick={() => setSelectedRequest(null)}>
                                    <CloseIcon />
                                </button>
                            </div>
                            <div className="request-modal-body">
                                {/* Item Photos Section */}
                                <div className="request-modal-section">
                                    <div className="request-modal-section-header">
                                        <h4 className="request-modal-section-title">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                <polyline points="21 15 16 10 5 21"></polyline>
                                            </svg>
                                            Item Photos
                                        </h4>
                                        <span className="request-modal-section-hint">Click to view full size</span>
                                    </div>
                                    <PhotoProvider>
                                        <div className="request-modal-images">
                                            {selectedRequest.images && selectedRequest.images.length > 0 ? (
                                                selectedRequest.images.map((url: string, idx: number) => {
                                                    const normalizedUrl = normalizeImageUrl(url);
                                                    return (
                                                        <div key={idx} className="request-modal-image-wrapper">
                                                            {imageErrors.has(idx) ? (
                                                                <div className="request-modal-image-error">
                                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <circle cx="12" cy="12" r="10"></circle>
                                                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                                    </svg>
                                                                    <span>Failed to load</span>
                                                                </div>
                                                            ) : (
                                                                <PhotoView src={normalizedUrl}>
                                                                    <img
                                                                        src={normalizedUrl}
                                                                        alt={`Item photo ${idx + 1}`}
                                                                        className="request-modal-image"
                                                                        onError={() => {
                                                                            setImageErrors(prev => new Set(prev).add(idx));
                                                                        }}
                                                                        loading="lazy"
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                </PhotoView>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="request-modal-image-empty">
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                        <polyline points="21 15 16 10 5 21"></polyline>
                                                    </svg>
                                                    <span>No images available</span>
                                                </div>
                                            )}
                                        </div>
                                    </PhotoProvider>
                                </div>

                                {/* Description Section */}
                                <div className="request-modal-section">
                                    <div className="request-modal-section-header">
                                        <h4 className="request-modal-section-title">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                            Item Description
                                        </h4>
                                    </div>
                                    <div className="request-modal-description">
                                        <p>{selectedRequest.description || 'No description provided for this item.'}</p>
                                    </div>
                                </div>

                                {/* Specifications Section */}
                                <div className="request-modal-section">
                                    <div className="request-modal-section-header">
                                        <h4 className="request-modal-section-title">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                            </svg>
                                            Request Specifications
                                        </h4>
                                    </div>
                                    <div className="request-modal-info">
                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Item Name</span>
                                            </div>
                                            <span className="request-modal-info-value">{selectedRequest.name}</span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Request Status</span>
                                            </div>
                                            <span className={`request-status ${getStatusClass(selectedRequest.status)}`} style={{ alignSelf: 'flex-start' }}>
                                                {selectedRequest.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Quantity Needed</span>
                                            </div>
                                            <span className="request-modal-info-value">{selectedRequest.quantity} {selectedRequest.quantity === 1 ? 'unit' : 'units'}</span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Total Compensation</span>
                                            </div>
                                            <span className="request-modal-info-value price">${selectedRequest.totalPrice.toFixed(2)}</span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Starting Bid per Item</span>
                                            </div>
                                            <span className="request-modal-info-value">${selectedRequest.startingBid.toFixed(2)} per item</span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Estimated Weight</span>
                                            </div>
                                            <span className="request-modal-info-value">{selectedRequest.estimatedWeightKg} kg</span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Origin Countries</span>
                                            </div>
                                            <div className="request-modal-info-value">
                                                {selectedRequest.fromCountries && selectedRequest.fromCountries.length > 0 ? (
                                                    <div className="request-modal-countries">
                                                        {selectedRequest.fromCountries.map((country, idx) => (
                                                            <span key={idx} className="request-modal-country-badge">{getCountryName(country)}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--color-text-secondary)' }}>Any country</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Delivery Destination</span>
                                            </div>
                                            <span className="request-modal-info-value">
                                                <LocationIcon />
                                                {selectedRequest.deliveryLocation}
                                            </span>
                                        </div>

                                        <div className="request-modal-info-item">
                                            <div className="request-modal-info-label-wrapper">
                                                <span className="request-modal-info-label">Delivery Deadline</span>
                                            </div>
                                            <span className="request-modal-info-value">
                                                {new Date(selectedRequest.deadline).toLocaleDateString(undefined, {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="request-modal-footer">
                                {(selectedRequest.status === 'OPEN' || selectedRequest.status === 'POSTED') && (
                                    <>
                                        <button 
                                            className="btn btn-primary btn-full" 
                                            onClick={() => {
                                                setSelectedRequest(null);
                                                window.location.href = `/requests/edit/${selectedRequest.id}`;
                                            }}
                                            style={{ marginBottom: '0.75rem' }}
                                        >
                                            Edit Request
                                        </button>
                                    </>
                                )}
                                {(selectedRequest.status === 'OPEN' || selectedRequest.status === 'POSTED') && (
                                    <button className="btn btn-danger btn-full" onClick={() => handleCancel(selectedRequest.id)}>
                                        Cancel This Request
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default RequestsPage;
