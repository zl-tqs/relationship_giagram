import axios from 'axios';
import { getRefreshToken, setTokens } from '../core/auth/tokens';

const REFRESH_URL = '/api/v1/auth/refresh';

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

let inFlight: Promise<string> | null = null;

export function resetRefreshForTest() {
  inFlight = null;
}

export function refreshAccessToken(): Promise<string> {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');
  const { data } = await axios.post<RefreshResult>(REFRESH_URL, { refreshToken });
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}
