import { useState, useEffect } from 'react';
import { clearTokens } from '../services/tokenStorage';
import { hasPendingRole } from '../services/auth';
import api from '../services/api';
import { buildUserMgmtUrl } from '../services/userMgmt';
import './HomePage.css';

interface UserData {
    name?: string;
    email?: string;
    imageUrl?: string;
}

interface RecommendationItem {
    id: string;
    title: string;
    description: string;
    category: 'request' | 'delivery' | 'offer' | 'search' | 'trending';
    iconColor: 'purple' | 'pink' | 'blue' | 'orange' | 'green' | 'teal';
    badge?: string;
    badgeColor?: 'purple' | 'pink' | 'blue';
}

const PersonalHomePage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [userData, setUserData] = useState<UserData>({});
    const [showDropdown, setShowDropdown] = useState(false);
    const [hasPending, setHasPending] = useState(false);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const response = await api.get('/user/personal-account');
                setUserData(response.data);
                // Check if user has PENDING role
                const isPending = await hasPendingRole();
                setHasPending(isPending);
            } catch (err) {
                console.error('Failed to load user data:', err);
            }
        };

        loadUserData();
    }, []);

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

    // Sample recommendation items based on the wireframe
    const recommendations: RecommendationItem[] = [
        {
            id: '1',
            title: 'Similar to Previous Requests',
            description: 'Items matching your past shipping requests. Find what you need quickly.',
            category: 'request',
            iconColor: 'purple',
            badge: '5 items',
            badgeColor: 'purple',
        },
        {
            id: '2',
            title: 'Similar to Previous Deliveries',
            description: 'Based on items you have delivered before. Popular in your area.',
            category: 'delivery',
            iconColor: 'pink',
            badge: '3 items',
            badgeColor: 'pink',
        },
        {
            id: '3',
            title: 'Goods by Deliverer A',
            description: 'Published offers from trusted deliverers traveling your route.',
            category: 'offer',
            iconColor: 'blue',
            badge: 'New',
            badgeColor: 'blue',
        },
        {
            id: '4',
            title: 'Goods by Deliverer B',
            description: 'Fresh product advertisements from verified carriers near you.',
            category: 'offer',
            iconColor: 'teal',
            badge: '2 offers',
            badgeColor: 'blue',
        },
        {
            id: '5',
            title: 'Based on Search History',
            description: 'Personalized suggestions from your recent searches and interests.',
            category: 'search',
            iconColor: 'orange',
        },
        {
            id: '6',
            title: 'High-Demand Items',
            description: 'Trending items frequently requested by others in your area.',
            category: 'trending',
            iconColor: 'green',
            badge: 'Trending',
            badgeColor: 'purple',
        },
    ];

    const getCategoryIcon = (category: RecommendationItem['category'], colorClass: string) => {
        switch (category) {
            case 'request':
                return (
                    <svg className={`card-icon ${colorClass}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="3.27,6.96 12,12.01 20.73,6.96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'delivery':
                return (
                    <svg className={`card-icon ${colorClass}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="16,8 20,8 23,11 23,16 16,16 16,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                        <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                );
            case 'offer':
                return (
                    <svg className={`card-icon ${colorClass}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'search':
                return (
                    <svg className={`card-icon ${colorClass}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'trending':
                return (
                    <svg className={`card-icon ${colorClass}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="17,6 23,6 23,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            default:
                return null;
        }
    };

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
                        <button className="nav-link active">
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
                        <button
                            className="nav-link"
                            onClick={() => window.location.href = '/requests'}
                        >
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
                                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                            <span>{userData.name || 'User'}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                                <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                Profile
                            </button>
                            <button className="dropdown-item danger" onClick={handleLogout}>
                                <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="homepage-main">
                {/* Search Section */}
                <section className="search-section">
                    <div className="search-wrapper">
                        <div className="search-input-container">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search items, requests, or deliverers…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </section>

                {/* Recommendations Section */}
                <section className="recommendations-section">
                    <div className="section-header">
                        <div>
                            <h2 className="section-title">Recommendations</h2>
                            <p className="section-subtitle">Personalized suggestions based on your activity</p>
                        </div>
                    </div>

                    <div className="recommendations-grid">
                        {recommendations.map((item) => (
                            <div key={item.id} className="recommendation-card">
                                <div className={`card-icon-wrapper ${item.iconColor}`}>
                                    {getCategoryIcon(item.category, item.iconColor)}
                                </div>
                                <h3 className="card-title">{item.title}</h3>
                                <p className="card-description">{item.description}</p>
                                {(item.badge) && (
                                    <div className="card-meta">
                                        {item.badge && (
                                            <span className={`card-badge ${item.badgeColor || 'purple'}`}>
                                                <svg className="card-badge-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {item.badge}
                                            </span>
                                        )}
                                        <svg className="card-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <polyline points="12,5 19,12 12,19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default PersonalHomePage;
