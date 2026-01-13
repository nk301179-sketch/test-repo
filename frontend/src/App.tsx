import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home.tsx';
import RequestsPage from './pages/RequestsPage.tsx';
import NewRequestPage from './pages/NewRequestPage.tsx';
import { isAuthenticated, hasPendingRole, hasPendingAccountType } from './services/auth.ts';
import { clearTokens, storeTokens } from './services/tokenStorage.ts';
import api from './services/api.ts';
import { resolveBaseUrl } from './services/url.ts';
import { buildUserMgmtUrl } from './services/userMgmt.ts';

const COMPANY_APP_BASE_URL = resolveBaseUrl(import.meta.env.VITE_COMPANY_APP_BASE_URL);

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [needsAccountType, setNeedsAccountType] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const params = new URLSearchParams(location.search);
  const error = params.get('error');
  const token = params.get('token');
  const refreshToken = params.get('refreshToken');

  useEffect(() => {
    if (error) {
      // If backend redirected with an auth error, clear tokens and bounce to user-management sign-in.
      clearTokens();
      window.location.replace(buildUserMgmtUrl('/signin', window.location.href, { error }));
      return;
    }

    if (token) {
      storeTokens(token, refreshToken || undefined);
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete('token');
      cleaned.searchParams.delete('refreshToken');
      cleaned.searchParams.delete('error');
      window.history.replaceState({}, '', cleaned.toString());
      navigate(location.pathname + location.hash, { replace: true });
      return;
    }

    // Check account type / role and redirect to the right frontend.
    if (isAuthenticated()) {
      Promise.all([
        api.get('/user/personal-account').then((res) => res.data?.accountType as string | undefined).catch(() => undefined),
        hasPendingAccountType(),
        hasPendingRole(),
      ])
        .then(([accountType, accountTypePending, rolePending]) => {
          setNeedsAccountType(accountTypePending);
          setNeedsProfileCompletion(rolePending);
          setChecking(false);

          if (String(accountType || '').toUpperCase() === 'COMPANY') {
            const url = new URL(COMPANY_APP_BASE_URL);
            url.searchParams.set('returnTo', window.location.href);
            window.location.replace(url.toString());
            return;
          }

          // Account type selection takes priority
          if (accountTypePending) {
            window.location.replace(buildUserMgmtUrl('/account-type-selection', window.location.href));
          } else if (rolePending && location.pathname !== '/') {
            // Allow PENDING role users to access home page for browsing
            // Only redirect to profile completion for other routes
            window.location.replace(buildUserMgmtUrl('/complete-profile', window.location.href));
          }
        })
        .catch(() => {
          setChecking(false);
        });
    } else {
      setChecking(false);
    }
  }, [location, navigate]);

  // If we're mid token handoff, wait for the effect above to persist tokens + clean the URL.
  if (token || error) {
    return null;
  }

  if (!isAuthenticated()) {
    window.location.replace(buildUserMgmtUrl('/signin', window.location.href));
    return null;
  }

  if (checking) {
    return null; // or a loading spinner
  }

  // Account type selection takes priority over profile completion
  if (needsAccountType) {
    window.location.replace(buildUserMgmtUrl('/account-type-selection', window.location.href));
    return null;
  }

  // Allow PENDING role users to access home page for browsing
  // Only redirect to profile completion for other routes
  if (needsProfileCompletion && location.pathname !== '/') {
    window.location.replace(buildUserMgmtUrl('/complete-profile', window.location.href));
    return null;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute>
              <RequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/new"
          element={
            <ProtectedRoute>
              <NewRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/edit/:id"
          element={
            <ProtectedRoute>
              <NewRequestPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
