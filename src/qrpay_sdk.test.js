import QRPAY_SDK from './qrpay_sdk';

// ─── fetch mock ─────────────────────────────────────────────────────────────

function mockFetchOk(body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status, body = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  });
}

function mockFetchNetworkError() {
  global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
}

// ─── 공통 setup ──────────────────────────────────────────────────────────────

let sdk;

beforeEach(() => {
  localStorage.clear();
  sdk = QRPAY_SDK();
});

afterEach(() => {
  jest.resetAllMocks();
});

// ─── authenticate ────────────────────────────────────────────────────────────

describe('authenticate()', () => {
  const deviceInfo = { deviceId: 'dev-1', deviceType: 'O', modelName: 'SM-G981N', osName: '13', appVersion: '1.2.3', pushToken: 'token' };

  test('성공 시 토큰을 localStorage에 저장하고 ok:true 반환', async () => {
    mockFetchOk({ accessToken: 'access_abc', accessTokenExpiresIn: 9999999999999, refreshToken: 'refresh_xyz' });

    const result = await sdk.authenticate('user01', 'enc_password', 'ref_id', deviceInfo);

    expect(result.ok).toBe(true);
    expect(result.accessToken).toBe('access_abc');
    expect(sdk.getAccessToken().accessToken).toBe('access_abc');
    expect(sdk.getRefreshToken()).toBe('refresh_xyz');
  });

  test('로그인 실패 시 토큰 저장 안 함', async () => {
    mockFetchError(401, { message: 'Invalid credentials' });

    const result = await sdk.authenticate('user01', 'wrong_pw', 'ref_id', deviceInfo);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(sdk.getAccessToken().accessToken).toBeNull();
  });

  test('네트워크 오류 시 FETCH_ERROR 반환', async () => {
    mockFetchNetworkError();

    const result = await sdk.authenticate('user01', 'enc_password', 'ref_id', deviceInfo);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(999);
    expect(result.code).toBe('EQ999');
  });

  test('deviceInfo 생략 시 기본값 {} 로 동작', async () => {
    mockFetchOk({ accessToken: 'a', accessTokenExpiresIn: 9999999999999, refreshToken: 'r' });

    const result = await sdk.authenticate('user01', 'enc_password', 'ref_id');
    expect(result.ok).toBe(true);
  });
});

// ─── refresh ─────────────────────────────────────────────────────────────────

describe('refresh()', () => {
  test('refreshToken 없으면 ok:false 반환 (네트워크 호출 없음)', async () => {
    global.fetch = jest.fn();

    const result = await sdk.refresh();

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('성공 시 accessToken 갱신', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    mockFetchOk({ accessToken: 'new_access', accessTokenExpiresIn: 9999999999999 });

    const result = await sdk.refresh();

    expect(result.ok).toBe(true);
    expect(sdk.getAccessToken().accessToken).toBe('new_access');
  });

  test('API 실패 시 토큰 갱신 안 함', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    localStorage.setItem('QRPAY_accessToken', '"old_access"');
    mockFetchError(401);

    const result = await sdk.refresh();

    expect(result.ok).toBe(false);
    expect(sdk.getAccessToken().accessToken).toBe('old_access'); // 기존 토큰 유지
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────

describe('logout()', () => {
  test('refreshToken 없으면 ok:false 반환', async () => {
    const result = await sdk.logout();

    expect(result.ok).toBe(false);
  });

  test('성공 시 모든 토큰 삭제 및 ok:true 반환', async () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', '9999999999999');
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    mockFetchOk({});

    const result = await sdk.logout();

    expect(result.ok).toBe(true);
    expect(sdk.getAccessToken().accessToken).toBeNull();
    expect(sdk.getRefreshToken()).toBeNull();
  });

  test('API 실패해도 토큰은 삭제됨', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    mockFetchError(500);

    await sdk.logout();

    expect(sdk.getRefreshToken()).toBeNull();
  });
});

// ─── verifyAccessToken ───────────────────────────────────────────────────────

describe('verifyAccessToken()', () => {
  test('토큰 없으면 false', () => {
    expect(sdk.verifyAccessToken()).toBe(false);
  });

  test('만료된 토큰이면 false', () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', '1000'); // 과거 시각

    expect(sdk.verifyAccessToken()).toBe(false);
  });

  test('유효한 토큰이면 true', () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', String(Date.now() + 3600000)); // 1시간 후

    expect(sdk.verifyAccessToken()).toBe(true);
  });
});

// ─── getAccessToken / getRefreshToken ────────────────────────────────────────

describe('getAccessToken() / getRefreshToken()', () => {
  test('저장된 토큰 반환', () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', '9999999999999');
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');

    const { accessToken, accessTokenExpiresIn } = sdk.getAccessToken();
    expect(accessToken).toBe('access_abc');
    expect(accessTokenExpiresIn).toBe(9999999999999);
    expect(sdk.getRefreshToken()).toBe('refresh_xyz');
  });

  test('토큰 없으면 null 반환', () => {
    const { accessToken } = sdk.getAccessToken();
    expect(accessToken).toBeNull();
    expect(sdk.getRefreshToken()).toBeNull();
  });
});

// ─── fetchPostAsync ───────────────────────────────────────────────────────────

describe('fetchPostAsync()', () => {
  test('성공 시 { ok: true, ...응답데이터 } 반환', async () => {
    mockFetchOk({ merchantName: '스타벅스' });

    const result = await sdk.fetchPostAsync('/qrpay/api/v1/merchant/change-name', { merNm: '스타벅스' });

    expect(result.ok).toBe(true);
    expect(result.merchantName).toBe('스타벅스');
  });

  test('저장된 토큰을 Authorization 헤더에 포함', async () => {
    localStorage.setItem('QRPAY_accessToken', '"my_token"');
    mockFetchOk({});

    await sdk.fetchPostAsync('/some/api', {});

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my_token');
  });

  test('토큰 없으면 Authorization 헤더 없음', async () => {
    mockFetchOk({});

    await sdk.fetchPostAsync('/some/api', {});

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  test('HTTP 오류 시 { ok: false, status, error } 반환', async () => {
    mockFetchError(400, { message: 'Bad Request' });

    const result = await sdk.fetchPostAsync('/some/api', {});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  test('네트워크 오류 시 FETCH_ERROR 반환', async () => {
    mockFetchNetworkError();

    const result = await sdk.fetchPostAsync('/some/api', {});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(999);
    expect(result.code).toBe('EQ999');
  });
});

// ─── fetchGetAsync ────────────────────────────────────────────────────────────

describe('fetchGetAsync()', () => {
  test('성공 시 { ok: true, ...응답데이터 } 반환', async () => {
    mockFetchOk({ info: 'data' });

    const result = await sdk.fetchGetAsync('/qrpay/api/v1/merchant/info');

    expect(result.ok).toBe(true);
    expect(result.info).toBe('data');
  });

  test('GET 요청에 body가 없음', async () => {
    mockFetchOk({});

    await sdk.fetchGetAsync('/some/api');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
  });

  test('네트워크 오류 시 FETCH_ERROR 반환', async () => {
    mockFetchNetworkError();

    const result = await sdk.fetchGetAsync('/some/api');

    expect(result.ok).toBe(false);
    expect(result.code).toBe('EQ999');
  });
});

// ─── fetchPostPromise / fetchGetPromise ───────────────────────────────────────

describe('fetchPostPromise()', () => {
  test('raw Response 반환', async () => {
    const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({ data: 1 }) };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const response = await sdk.fetchPostPromise('/some/api', { key: 'val' });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  test('네트워크 오류 시 FETCH_ERROR로 reject', async () => {
    mockFetchNetworkError();

    await expect(sdk.fetchPostPromise('/some/api', {})).rejects.toMatchObject({
      status: 999,
      code: 'EQ999',
    });
  });
});

describe('fetchGetPromise()', () => {
  test('raw Response 반환', async () => {
    const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({}) };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const response = await sdk.fetchGetPromise('/some/api');
    expect(response.ok).toBe(true);
  });

  test('네트워크 오류 시 FETCH_ERROR로 reject', async () => {
    mockFetchNetworkError();

    await expect(sdk.fetchGetPromise('/some/api')).rejects.toMatchObject({
      status: 999,
      code: 'EQ999',
    });
  });
});
