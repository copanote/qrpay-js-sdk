import Context from './context';
import QRPAY_STORAGE from './qrpay_storage';

const QRPAY_SDK = () => {
  const context = Context();
  const qrpay_storage = QRPAY_STORAGE();
  const { qrpayBaseUrl, loggable } = context;

  const getBaseUrl = () => {
    const hostname = window.location.hostname;
    console.log('Current Hostname:', hostname);
    console.log('qrpayBaseUrl :', qrpayBaseUrl);

    // 특정 조건(IP 접속)일 때만 URL 교체, 그 외엔 context 값 그대로 사용
    if (qrpayBaseUrl && qrpayBaseUrl.includes('isrnd3.bccard.com') && hostname === 'localhost') {
      return 'http://130.1.56.154:20101/qrpay';
    }
    console.log('Using Base URL:', qrpayBaseUrl);
    return qrpayBaseUrl;
  };

  // 결정된 최종 Base URL (고정값)
  const finalBaseUrl = getBaseUrl();

  // const createUrl = (path) => `${finalBaseUrl}${path}`;

  const createUrl = (path) => `${path}`;

  if (loggable) {
    console.log('qrpaySdk Context[' + '|' + context + ']');
  }

  const authenticate = async (username, password, { deviceId, deviceType, modelName, osName, appVersion, pushToken } = {}) => {
    console.log(username, password);
    const data = await fetchPostAsync(createUrl(AUTH_APIS.AUTH_LOGIN), {
      loginId: username,
      password: password,
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

    const data = await fetchPostAsync(createUrl(AUTH_APIS.AUTH_REFRESH), { refreshToken: refreshToken });

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

    const data = await fetchPostAsync(createUrl(AUTH_APIS.AUTH_LOGOUT), { refreshToken: refreshToken });
    if (!data.ok) {
      console.error('Logout failed:', data);
    }
    qrpay_storage.remove('accessToken');
    qrpay_storage.remove('accessTokenExpiresIn', accessTokenExpiresIn);
    qrpay_storage.remove('refreshToken');
    return true;
  };

  const getAccessToken = () => {
    return {
      accessToken: qrpay_storage.find('accessToken'),
      accessTokenExpiresIn: qrpay_storage.find('accessTokenExpiresIn'),
    };
  };

  const getRefreshToken = () => {
    return qrpay_storage.find('refreshToken');
  };

  const verifyAccessToken = () => {
    const { accessToken, accessTokenExpiresIn } = getAccessToken();
    if (!accessToken) {
      return false;
    }
    if (Date.now() >= accessTokenExpiresIn) {
      return false;
    }
    return true;
  };

  async function fetchPostAsync(url, data, accessToken = getAccessToken().accessToken) {
    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, ...data };
      }

      const errorBody = await response.json().catch(() => ({}));
      console.log('Http status:', response.status, response.statusText);
      console.log('Error body:', errorBody);
      return { ok: false, status: response.status, statusText: response.statusText, error: errorBody };
    } catch (error) {
      //Promise 자체가 rejected (network error, CORS 등)
      console.error('Fetch error:', error);
      return { ok: false, ...QRPAY_CODE.FETCH_ERROR, error: error };
    }
  }
  async function fetchGetAsync(url, accessToken = getAccessToken().accessToken) {
    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, ...data };
      }

      const errorBody = await response.json().catch(() => ({}));
      console.log('Http status:', response.status, response.statusText);
      console.log('Error body:', errorBody);
      return { ok: false, status: response.status, statusText: response.statusText, error: errorBody };
    } catch (error) {
      //Promise 자체가 rejected (network error, CORS 등)
      console.error('Fetch error:', error);
      return { ok: false, ...QRPAY_CODE.FETCH_ERROR, error: error };
    }
  }

  function fetchPostPromise(url, data, accessToken = undefined) {
    if (accessToken === undefined) accessToken = getAccessToken().accessToken;

    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    try {
      const response = fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      return new Promise((resolve, reject) => {
        reject({ ...QRPAY_CODE.FETCH_ERROR, error: error });
      });
    }
  }

  function fetchGetPromise(url, accessToken) {
    if (accessToken === undefined) accessToken = getAccessToken().accessToken;

    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    try {
      const response = fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
      });
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      return new Promise((resolve, reject) => {
        reject({ ...QRPAY_CODE.FETCH_ERROR, error: error });
      });
    }
  }

  const publicAPI = {
    getAccessToken: getAccessToken,
    getRefreshToken: getRefreshToken,
    verifyAccessToken: verifyAccessToken,
    authenticate: authenticate,
    refresh: refresh,
    logout: logout,
    fetchPostAsync: fetchPostAsync,
    fetchGetAsync: fetchGetAsync,
    fetchPostPromise: fetchPostPromise,
    fetchGetPromise: fetchGetPromise,
    QRPAY_CODE: QRPAY_CODE,
    AUTH_APIS: AUTH_APIS,
    PAGES_APIS: PAGES_APIS,
    REST_APIS: REST_APIS,
  };

  return publicAPI;
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

const AUTH_APIS = {
  AUTH_LOGIN: '/qrpay/auth/login',
  AUTH_REFRESH: '/qrpay/auth/refresh',
  AUTH_LOGOUT: '/qrpay/auth/logout',
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

export default QRPAY_SDK;
