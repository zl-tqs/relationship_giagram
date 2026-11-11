import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearTokens, getAccessToken, getRefreshToken } from '../../core/auth/tokens';
import { refreshAccessToken } from '../../api/authRefresh';

type Status = 'checking' | 'authed' | 'guest';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<Status>(() => {
    if (getAccessToken()) return 'authed';
    if (getRefreshToken()) return 'checking';
    return 'guest';
  });

  useEffect(() => {
    if (status !== 'checking') return;
    let cancelled = false;
    refreshAccessToken()
      .then(() => {
        if (!cancelled) setStatus('authed');
      })
      .catch(() => {
        clearTokens();
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
