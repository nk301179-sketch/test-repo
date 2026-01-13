import { useEffect, useState } from 'react';
import api from '../services/api';
import { hasPendingRole } from '../services/auth';
import { resolveBaseUrl } from '../services/url';
import PersonalHomePage from './PersonalHomePage';
import ProfileIncompletePopup from '../components/ProfileIncompletePopup';

type AccountType = 'PERSONAL' | 'COMPANY' | 'PENDING' | null;

const USER_MGMT_BASE_URL = resolveBaseUrl(import.meta.env.VITE_USER_MGMT_BASE_URL);
const COMPANY_APP_BASE_URL = resolveBaseUrl(import.meta.env.VITE_COMPANY_APP_BASE_URL);

const Home = () => {
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const checkAccountType = async () => {
      try {
        const response = await api.get('/user/personal-account');
        const userAccountType = response.data?.accountType;
        // ProtectedRoute should handle redirects, but keep this as fallback
        if (!userAccountType || userAccountType === 'PENDING') {
          window.location.replace(`${USER_MGMT_BASE_URL}/account-type-selection?returnTo=${encodeURIComponent(window.location.href)}`);
          return;
        }
        if (String(userAccountType).toUpperCase() === 'COMPANY') {
          const url = new URL(COMPANY_APP_BASE_URL);
          url.searchParams.set('returnTo', window.location.href);
          window.location.replace(url.toString());
          return;
        }
        setAccountType(userAccountType);
        
        // Check if we should show popup
        const accountTypeJustCompleted = sessionStorage.getItem('accountTypeJustCompleted') === 'true';
        if (accountTypeJustCompleted) {
          const isPending = await hasPendingRole();
          if (isPending) {
            setShowPopup(true);
          }
          // Clear the flag
          sessionStorage.removeItem('accountTypeJustCompleted');
        }
      } catch (err) {
        // If unauthenticated, redirect to user-management sign in
        window.location.replace(`${USER_MGMT_BASE_URL}/signin?returnTo=${encodeURIComponent(window.location.href)}`);
      } finally {
        setLoading(false);
      }
    };

    checkAccountType();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gradient-brand-soft)'
      }}>
        <div className="glass-panel" style={{
          padding: '2rem',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="var(--color-primary)"
              strokeWidth="4"
              fill="none"
              strokeDasharray="50"
              strokeDashoffset="25"
            />
          </svg>
          <span style={{ color: 'hsl(220, 10%, 45%)', fontWeight: 600 }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Render PersonalHomePage for PERSONAL accounts
  if (accountType === 'PERSONAL') {
    return (
      <>
        <PersonalHomePage />
        {showPopup && <ProfileIncompletePopup onDismiss={() => setShowPopup(false)} />}
      </>
    );
  }

  // Company users should be redirected to the company frontend by the effect above.
  if (accountType === 'COMPANY') {
    return null;
  }

  // Fallback - should not reach here normally
  return null;
};

export default Home;
