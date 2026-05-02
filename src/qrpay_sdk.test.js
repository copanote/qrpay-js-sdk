import QRPAY_SDK from './qrpay_sdk';

// ─── fetch mock ─────────────────────────────────────────────────────────────

function makeMockResponse(overrides) {
  return {
    headers: { get: jest.fn().mockReturnValue(null) },
    json: () => Promise.resolve({}),
    ...overrides,
  };
}

function mockFetchOk(body, headers = {}) {
  global.fetch = jest.fn().mockResolvedValue(
    makeMockResponse({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      headers: { get: (key) => headers[key] ?? null },
    })
  );
}

function mockFetchError(status, body = {}) {
  global.fetch = jest.fn().mockResolvedValue(
    makeMockResponse({
      ok: false,
      status,
      statusText: 'Error',
      json: () => Promise.resolve(body),
    })
  );
}

function mockFetchNetworkError() {
  global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
}

// ─── 공통 setup ──────────────────────────────────────────────────────────────

let sdk;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
    expect(localStorage.getItem('QRPAY_refreshToken')).toBe('"refresh_xyz"');
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
    expect(sdk.getAccessToken().accessToken).toBe('old_access');
  });

  test('동시 호출 시 네트워크 요청은 1번만 발생', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    mockFetchOk({ accessToken: 'new_token', accessTokenExpiresIn: 9999999999999 });

    const [r1, r2] = await Promise.all([sdk.refresh(), sdk.refresh()]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────

describe('logout()', () => {
  test('refreshToken 없으면 ok:true 반환 (이미 로그아웃 상태)', async () => {
    const result = await sdk.logout();

    expect(result.ok).toBe(true);
  });

  test('성공 시 모든 토큰 삭제 및 ok:true 반환', async () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', '9999999999999');
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    mockFetchOk({});

    const result = await sdk.logout();

    expect(result.ok).toBe(true);
    expect(sdk.getAccessToken().accessToken).toBeNull();
    expect(localStorage.getItem('QRPAY_refreshToken')).toBeNull();
  });

  test('API 실패해도 토큰은 삭제됨', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');
    mockFetchError(500);

    await sdk.logout();

    expect(localStorage.getItem('QRPAY_refreshToken')).toBeNull();
  });
});

// ─── verifyAccessToken ───────────────────────────────────────────────────────

describe('verifyAccessToken()', () => {
  test('토큰 없으면 false', () => {
    expect(sdk.verifyAccessToken()).toBe(false);
  });

  test('만료된 토큰이면 false', () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', '1000');

    expect(sdk.verifyAccessToken()).toBe(false);
  });

  test('유효한 토큰이면 true', () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', String(Date.now() + 3600000));

    expect(sdk.verifyAccessToken()).toBe(true);
  });
});

// ─── getAccessToken ──────────────────────────────────────────────────────────

describe('getAccessToken()', () => {
  test('저장된 토큰 반환', () => {
    localStorage.setItem('QRPAY_accessToken', '"access_abc"');
    localStorage.setItem('QRPAY_accessTokenExpiresIn', '9999999999999');

    const { accessToken, accessTokenExpiresIn } = sdk.getAccessToken();
    expect(accessToken).toBe('access_abc');
    expect(accessTokenExpiresIn).toBe(9999999999999);
  });

  test('토큰 없으면 null 반환', () => {
    const { accessToken } = sdk.getAccessToken();
    expect(accessToken).toBeNull();
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

// ─── 401 자동 refresh ─────────────────────────────────────────────────────────

describe('401 자동 refresh', () => {
  test('401 → refresh 성공 → retry 성공 시 ok:true 반환', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');

    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeMockResponse({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) }))
      .mockResolvedValueOnce(makeMockResponse({ ok: true, status: 200, json: () => Promise.resolve({ accessToken: 'new_token', accessTokenExpiresIn: 9999999999999 }) }))
      .mockResolvedValueOnce(makeMockResponse({ ok: true, status: 200, json: () => Promise.resolve({ data: 'retried' }) }));

    const result = await sdk.fetchPostAsync('/some/api', {});

    expect(result.ok).toBe(true);
    expect(result.data).toBe('retried');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('401 → refresh 실패 → RE_AUTHENTICATE 반환', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');

    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeMockResponse({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) }))
      .mockResolvedValueOnce(makeMockResponse({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) }));

    const result = await sdk.fetchPostAsync('/some/api', {});

    expect(result.ok).toBe(false);
    expect(result.code).toBe('EQ401');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('401 → refreshToken 없으면 RE_AUTHENTICATE 반환 (네트워크 추가 호출 없음)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeMockResponse({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) }));

    const result = await sdk.fetchPostAsync('/some/api', {});

    expect(result.ok).toBe(false);
    expect(result.code).toBe('EQ401');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('AUTH_REFRESH 자체가 401이면 재시도 없음', async () => {
    localStorage.setItem('QRPAY_refreshToken', '"refresh_xyz"');

    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeMockResponse({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) }));

    const result = await sdk.fetchPostAsync('/qrpay/auth/refresh', {});

    expect(result.ok).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── X-Transaction-ID ────────────────────────────────────────────────────────

describe('X-Transaction-ID', () => {
  test('응답 헤더에 X-Transaction-ID 있으면 sessionStorage에 저장', async () => {
    mockFetchOk({}, { 'X-Transaction-ID': 'txn-001' });

    await sdk.fetchPostAsync('/some/api', {});

    expect(sessionStorage.getItem('X-Transaction-ID')).toBe('txn-001');
  });

  test('sessionStorage에 X-Transaction-ID 있으면 요청 헤더에 포함', async () => {
    sessionStorage.setItem('X-Transaction-ID', 'txn-existing');
    mockFetchOk({});

    await sdk.fetchPostAsync('/some/api', {});

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-Transaction-ID']).toBe('txn-existing');
  });

  test('sessionStorage에 X-Transaction-ID 없으면 요청 헤더에 포함 안 함', async () => {
    mockFetchOk({});

    await sdk.fetchPostAsync('/some/api', {});

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-Transaction-ID']).toBeUndefined();
  });
});
