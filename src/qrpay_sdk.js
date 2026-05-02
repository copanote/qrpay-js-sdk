import Context from './context';
import QRPAY_STORAGE from './qrpay_storage';

// ─── 상수 ──────────────────────────────────────────────────────────────────

const AUTH_APIS = Object.freeze({
  AUTH_LOGIN: '/qrpay/auth/login',
  AUTH_REFRESH: '/qrpay/auth/refresh',
  AUTH_LOGOUT: '/qrpay/auth/logout',
});

const TRANSACTION_ID_KEY = 'X-Transaction-ID';

const QRPAY_CODE = Object.freeze({
  RE_AUTHENTICATE: Object.freeze({ ok: false, status: 401, code: 'EQ401', message: 'Authentication Required.' }),
  FETCH_ERROR: Object.freeze({ ok: false, status: 999, code: 'EQ999', message: 'Fetch Promise Rejected(Network error, CORS, etc.)' }),
});

// ─── SDK 팩토리 ────────────────────────────────────────────────────────────

const QRPAY_SDK = () => {
  const context = Context();
  const qrpay_storage = QRPAY_STORAGE();
  const { loggable } = context;

  let _refreshPromise = null;

  // ─── 인증 ────────────────────────────────────────────────────────────────

  const authenticate = async (username, password, keypadRefId, { deviceId, deviceType, modelName, osName, appVersion, pushToken } = {}) => {
    const data = await fetchPostAsync(AUTH_APIS.AUTH_LOGIN, {
      loginId: username,
      password: password,
      keypadRefId: keypadRefId,
      deviceInfo: { deviceId, deviceType, modelName, osName, appVersion, pushToken },
    });

    if (loggable) {
      console.log('Authentication data:', data);
    }

    if (data.ok) {
      const { accessToken, accessTokenExpiresIn, refreshToken } = data;
      qrpay_storage.save('accessToken', accessToken);
      qrpay_storage.save('accessTokenExpiresIn', accessTokenExpiresIn);
      qrpay_storage.save('refreshToken', refreshToken);
    }

    return data;
  };

  const refresh = () => {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return { ok: false, status: 401, error: 'No refresh token available' };
      }

      const data = await fetchPostAsync(AUTH_APIS.AUTH_REFRESH, { refreshToken: refreshToken });

      if (loggable) {
        console.log('Refresh data:', data);
      }

      if (data.ok) {
        const { accessToken, accessTokenExpiresIn } = data;
        qrpay_storage.save('accessToken', accessToken);
        qrpay_storage.save('accessTokenExpiresIn', accessTokenExpiresIn);
      }

      return data;
    })().finally(() => {
      _refreshPromise = null;
    });

    return _refreshPromise;
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return { ok: true }; // 토큰이 없으면 이미 로그아웃된 상태로 간주
    }

    const data = await fetchPostAsync(AUTH_APIS.AUTH_LOGOUT, { refreshToken: refreshToken });
    if (!data.ok) {
      console.error('Logout failed:', data);
    }
    qrpay_storage.remove('accessToken');
    qrpay_storage.remove('accessTokenExpiresIn');
    qrpay_storage.remove('refreshToken');

    return { ok: true };
  };

  const getAccessToken = () => ({
    accessToken: qrpay_storage.find('accessToken'),
    accessTokenExpiresIn: qrpay_storage.find('accessTokenExpiresIn'),
  });

  const getRefreshToken = () => qrpay_storage.find('refreshToken');

  const verifyAccessToken = () => {
    const { accessToken, accessTokenExpiresIn } = getAccessToken();
    if (!accessToken) return false;
    if (Date.now() >= accessTokenExpiresIn) return false;
    return true;
  };

  // ─── HTTP 헬퍼 ───────────────────────────────────────────────────────────

  async function _fetchOnce(method, url, data, accessToken) {
    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const txId = sessionStorage.getItem(TRANSACTION_ID_KEY);
    const txHeader = txId ? { [TRANSACTION_ID_KEY]: txId } : {};

    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...txHeader,
      },
      ...(data !== undefined && { body: JSON.stringify(data) }),
    });

    const newTxId = response.headers.get(TRANSACTION_ID_KEY);
    if (newTxId) sessionStorage.setItem(TRANSACTION_ID_KEY, newTxId);

    return response;
  }

  async function _fetch(method, url, data, accessToken = getAccessToken().accessToken) {
    try {
      const response = await _fetchOnce(method, url, data, accessToken);

      if (response.ok) {
        const json = await response.json().catch(() => ({}));
        return { ok: true, ...json };
      }

      // refresh 엔드포인트 자체가 401이면 재시도 없이 반환
      if (response.status === 401 && !url.includes(AUTH_APIS.AUTH_REFRESH)) {
        const refreshResult = await refresh();
        if (refreshResult.ok) {
          const retryResponse = await _fetchOnce(method, url, data, getAccessToken().accessToken);
          if (retryResponse.ok) {
            const json = await retryResponse.json().catch(() => ({}));
            return { ok: true, ...json };
          }
          const errorBody = await retryResponse.json().catch(() => ({}));
          return { ok: false, status: retryResponse.status, statusText: retryResponse.statusText, error: errorBody };
        }
        return { ...QRPAY_CODE.RE_AUTHENTICATE };
      }

      const errorBody = await response.json().catch(() => ({}));
      console.error('Http status:', response.status, response.statusText);
      console.error('Error body:', errorBody);
      return { ok: false, status: response.status, statusText: response.statusText, error: errorBody };
    } catch (error) {
      console.error('Fetch error:', error);
      return { ok: false, ...QRPAY_CODE.FETCH_ERROR, error };
    }
  }

  const fetchPostAsync = (url, data, accessToken) => _fetch('POST', url, data, accessToken);
  const fetchGetAsync = (url, accessToken) => _fetch('GET', url, undefined, accessToken);

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    getAccessToken,
    verifyAccessToken,
    authenticate,
    refresh,
    logout,
    fetchPostAsync,
    fetchGetAsync,
    QRPAY_CODE,
  };
};

export default QRPAY_SDK;
