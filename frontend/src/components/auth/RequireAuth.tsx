import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getTokenSubject,
} from '../../core/auth/tokens';
import { clearStoredUser, getStoredUser } from '../../core/auth/user';
import { useAuthStore } from '../../stores/authStore';

type Status = 'checking' | 'authed' | 'guest';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<Status>(() => {
    const accessToken = getAccessToken();
    const storedUser = getStoredUser();
    if (!accessToken && !getRefreshToken()) return 'guest';
    const subject = accessToken ? getTokenSubject(accessToken) : null;
    if (accessToken && storedUser && (!subject || subject === storedUser.id)) {
      return 'authed';
    }
    return 'checking';
  });

  useEffect(() => {
    if (status !== 'checking') return;
    let cancelled = false;
    useAuthStore.getState().restore()
      .then(() => {
        if (!cancelled) setStatus('authed');
      })
      .catch(() => {
        clearTokens();
        clearStoredUser();
        useAuthStore.setState({ token: null, user: null });
        if (!cancelled) setStatus('guest');
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'checking') {
    return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>加载中…</div>;
  }
  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
