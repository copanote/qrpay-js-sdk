import Context from './context';
import QRPAY_STORAGE from './qrpay_storage';

// ─── 상수 ──────────────────────────────────────────────────────────────────

const AUTH_APIS = {
  AUTH_LOGIN: '/qrpay/auth/login',
  AUTH_REFRESH: '/qrpay/auth/refresh',
  AUTH_LOGOUT: '/qrpay/auth/logout',
};

const PAGES_APIS = {
  PAGES_LOGIN: '/qrpay/pages/login',
  PAGES_MAIN: '/qrpay/pages/home/mpmqr',
  PAGES_NOTICE: '/qrpay/pages/settings/notice',
  PAGES_GUIDE: '/qrpay/pages/settings/guide',
  PAGES_TERMS_SERVICE: '/qrpay/pages/settings/terms-service',
  PAGES_TERMS_SERVICE_TERMS: '/pages/settings/terms-service/terms',
  PAGES_TERMS_SERVICE_PERMISSIONS: '/qrpay/pages/settings/terms-service/permissions',
  PAGES_TERMS_SERVICE_CANCEL: '/qrpay/pages/settings/terms-service/cancel',
};

const REST_APIS = {
  MERCHANT: {
    INFO: '/qrpay/api/v1/merchant/info',
    EMPLOYEES: '/qrpay/api/v1/merchant/employees',
    ADD_EMPLOYEES: '/qrpay/api/v1/merchant/add-employee',
    MPMQR: '/qrpay/api/v1/merchant/mpmqr',
    CHANGE_NAME: '/qrpay/api/v1/merchant/change-name',
    CHANGE_TIP: '/qrpay/api/v1/merchant/change-tip',
    CHANGE_VAT: '/qrpay/api/v1/merchant/change-vat',
  },
  MEMBER: {},
  QR_KIT: {},
};

const QRPAY_CODE = {
  RE_ATHENTICATE: {
    ok: false,
    status: 401,
    code: 'EQ401',
    message: 'Authentication Required.',
  },
  FETCH_ERROR: {
    ok: false,
    status: 999,
    code: 'EQ999',
    message: 'Fetch Promise Rejected(Network error, CORS, etc.)',
  },
  API_ERROR: {
    ok: false,
    status: 500,
    code: 'EQ500',
    message: 'application error',
  },
};

// ─── SDK 팩토리 ────────────────────────────────────────────────────────────

const QRPAY_SDK = () => {
  const context = Context();
  const qrpay_storage = QRPAY_STORAGE();
  const { loggable } = context;

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

  const refresh = async () => {
    const refreshToken = qrpay_storage.find('refreshToken');
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
  };

  const logout = async () => {
    const refreshToken = qrpay_storage.find('refreshToken');
    if (!refreshToken) {
      return { ok: false, error: 'No refresh token available' };
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

  async function _fetch(method, url, data, accessToken = getAccessToken().accessToken) {
    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        ...(data !== undefined && { body: JSON.stringify(data) }),
      });

      if (response.ok) {
        const json = await response.json();
        return { ok: true, ...json };
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

  function fetchPostPromise(url, data, accessToken = undefined) {
    if (accessToken === undefined) accessToken = getAccessToken().accessToken;

    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(data),
    }).catch((error) => {
      console.error('Fetch error:', error);
      return Promise.reject({ ...QRPAY_CODE.FETCH_ERROR, error });
    });
  }

  function fetchGetPromise(url, accessToken = undefined) {
    if (accessToken === undefined) accessToken = getAccessToken().accessToken;

    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    return fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeader },
    }).catch((error) => {
      console.error('Fetch error:', error);
      return Promise.reject({ ...QRPAY_CODE.FETCH_ERROR, error });
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    getAccessToken,
    getRefreshToken,
    verifyAccessToken,
    authenticate,
    refresh,
    logout,
    fetchPostAsync,
    fetchGetAsync,
    fetchPostPromise,
    fetchGetPromise,
    QRPAY_CODE,
    AUTH_APIS,
    PAGES_APIS,
    REST_APIS,
  };
};

export default QRPAY_SDK;
