# Jest 사용 가이드

이 프로젝트의 테스트 코드(`src/qrpay_sdk.test.js`)를 기준으로 설명합니다.

---

## 목차

1. [기본 구조](#1-기본-구조)
2. [Matcher — 값 검증](#2-matcher--값-검증)
3. [비동기 테스트](#3-비동기-테스트)
4. [Mock — 외부 의존성 대체](#4-mock--외부-의존성-대체)
5. [Setup / Teardown](#5-setup--teardown)
6. [실행 명령](#6-실행-명령)
7. [이 프로젝트 설정 구조](#7-이-프로젝트-설정-구조)

---

## 1. 기본 구조

### describe / test

```js
describe('그룹 이름', () => {
  test('테스트 이름', () => {
    // 검증 코드
    expect(1 + 1).toBe(2);
  });
});
```

- `describe` — 관련 테스트를 논리적으로 묶는 그룹
- `test` (또는 `it`) — 개별 테스트 케이스
- `expect` — 검증할 값을 감싸는 래퍼
- `toBe`, `toEqual` 등 — 실제 검증을 수행하는 **Matcher**

### 이 프로젝트 예시

```js
describe('authenticate()', () => {
  test('성공 시 토큰을 localStorage에 저장하고 ok:true 반환', async () => {
    mockFetchOk({ accessToken: 'access_abc', ... });

    const result = await sdk.authenticate('user01', 'enc_password', 'ref_id', deviceInfo);

    expect(result.ok).toBe(true);
    expect(result.accessToken).toBe('access_abc');
  });
});
```

---

## 2. Matcher — 값 검증

`expect(실제값).Matcher(기대값)` 형태로 사용합니다.

### 동등 비교

```js
expect(result.ok).toBe(true);           // 원시값 비교 (===)
expect(result).toEqual({ ok: true });   // 객체 깊은 비교 (구조가 같으면 통과)

expect(result.ok).not.toBe(false);      // .not 으로 반전
```

> `toBe`는 `===` 비교라 객체끼리 비교할 때 실패합니다. 객체는 `toEqual`을 사용하세요.

```js
expect({ a: 1 }).toBe({ a: 1 });     // ❌ 실패 (다른 참조)
expect({ a: 1 }).toEqual({ a: 1 }); // ✅ 통과 (값이 같음)
```

### null / undefined 검사

```js
expect(sdk.getAccessToken().accessToken).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();
```

### 포함 여부

```js
expect('hello world').toContain('world');
expect([1, 2, 3]).toContain(2);
expect(result).toMatchObject({ ok: false, status: 999 }); // 부분 일치
```

### 함수 호출 여부 (Mock 전용)

```js
expect(global.fetch).toHaveBeenCalled();
expect(global.fetch).not.toHaveBeenCalled();
expect(global.fetch).toHaveBeenCalledTimes(1);
expect(global.fetch).toHaveBeenCalledWith('/qrpay/auth/login', expect.any(Object));
```

### 예외 발생 여부

```js
expect(() => someFunction()).toThrow();
expect(() => someFunction()).toThrow('에러 메시지');
```

---

## 3. 비동기 테스트

Jest는 비동기 코드를 테스트하는 3가지 방법을 지원합니다.

### async / await (권장)

```js
test('비동기 테스트', async () => {
  const result = await sdk.authenticate('user01', 'pw', 'ref', {});
  expect(result.ok).toBe(true);
});
```

### Promise reject 검증

```js
test('네트워크 오류 시 reject', async () => {
  mockFetchNetworkError();

  // rejects.toMatchObject 로 reject된 값을 검증
  await expect(sdk.fetchPostPromise('/api', {})).rejects.toMatchObject({
    status: 999,
    code: 'EQ999',
  });
});
```

> `await`을 빼면 Jest가 비동기 완료를 기다리지 않아 테스트가 항상 통과됩니다. 반드시 `await`을 붙이세요.

### Promise 방식 (레거시)

```js
test('Promise 방식', () => {
  return sdk.refresh().then((result) => {
    expect(result.ok).toBe(false);
  });
});
```

---

## 4. Mock — 외부 의존성 대체

테스트 중 실제 네트워크 호출, 파일 시스템 접근 등을 **가짜 구현으로 대체**합니다.

### jest.fn() — 함수 Mock

```js
const mockFn = jest.fn();          // 아무것도 안 하는 빈 함수
const mockFn = jest.fn(() => 42);  // 42를 반환하는 함수

mockFn('hello');
expect(mockFn).toHaveBeenCalledWith('hello');
expect(mockFn).toHaveBeenCalledTimes(1);
```

### mockResolvedValue — Promise 성공 mock

```js
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ accessToken: 'abc' }),
});
```

`mockResolvedValue(val)` = `jest.fn().mockImplementation(() => Promise.resolve(val))`의 단축형

### mockRejectedValue — Promise 실패 mock

```js
global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
```

### 이 프로젝트에서의 fetch mock 패턴

```js
// 성공 응답
function mockFetchOk(body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

// HTTP 오류 응답 (4xx, 5xx)
function mockFetchError(status, body = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,          // response.ok = false
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  });
}

// 네트워크 자체 오류 (CORS, 연결 끊김 등)
function mockFetchNetworkError() {
  global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
}
```

> `response.ok = false` (HTTP 4xx/5xx) 와 `fetch` 자체가 reject (네트워크 오류) 는 다른 경우입니다.
> 두 케이스를 별도로 테스트하는 것이 중요합니다.

### mock 호출 인자 검증

```js
await sdk.fetchPostAsync('/some/api', {});

// fetch가 호출된 인자 꺼내기
const [url, options] = global.fetch.mock.calls[0];
expect(url).toBe('/some/api');
expect(options.method).toBe('POST');
expect(options.headers['Authorization']).toBe('Bearer my_token');
expect(options.body).toBe(JSON.stringify({}));
```

### jest.resetAllMocks() vs jest.clearAllMocks()

| 메서드 | mock 구현 초기화 | 호출 기록 초기화 |
|--------|-----------------|-----------------|
| `resetAllMocks()` | ✅ | ✅ |
| `clearAllMocks()` | ❌ | ✅ |
| `restoreAllMocks()` | ✅ (spyOn만) | ✅ |

```js
afterEach(() => {
  jest.resetAllMocks(); // 매 테스트 후 mock 상태 초기화
});
```

### jest.spyOn() — 기존 함수를 감시

```js
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
// 이후 console.error 호출이 실제로 출력되지 않고 감시됨

expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', expect.anything());
consoleSpy.mockRestore(); // 원래 구현으로 복원
```

---

## 5. Setup / Teardown

테스트 실행 전후에 공통 작업을 처리합니다.

```js
beforeAll(() => {
  // 전체 테스트 파일에서 딱 한 번 실행 (DB 연결 등)
});

afterAll(() => {
  // 전체 테스트 파일 완료 후 딱 한 번 실행 (DB 연결 해제 등)
});

beforeEach(() => {
  // 각 test() 실행 전마다 실행
  localStorage.clear();
  sdk = QRPAY_SDK();
});

afterEach(() => {
  // 각 test() 실행 후마다 실행
  jest.resetAllMocks();
});
```

### 이 프로젝트 패턴

```js
let sdk;

beforeEach(() => {
  localStorage.clear();    // 이전 테스트의 토큰 제거
  sdk = QRPAY_SDK();       // 매 테스트마다 새 인스턴스 생성
});

afterEach(() => {
  jest.resetAllMocks();    // fetch mock 초기화
});
```

> `sdk`를 `beforeEach`에서 매번 새로 생성하는 이유: 팩토리 함수 내부 상태(토큰 캐시 등)가 테스트 간 영향을 주지 않도록 격리합니다.

---

## 6. 실행 명령

```bash
# 전체 테스트 실행
yarn test

# 파일명 필터로 특정 파일만 실행
yarn test qrpay_sdk

# 감시 모드 (파일 저장 시 자동 재실행)
yarn test:watch

# 커버리지 리포트 출력
yarn test --coverage
```

### 커버리지 리포트

```bash
yarn test --coverage
```

```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
qrpay_sdk.js        |   94.87 |    83.33 |     100 |   94.87 |
qrpay_storage.js    |   72.72 |      100 |   66.66 |   72.72 |
--------------------|---------|----------|---------|---------|
```

- **Stmts**: 실행된 구문 비율
- **Branch**: 분기(if/else) 커버리지
- **Funcs**: 호출된 함수 비율
- **Lines**: 실행된 라인 비율

---

## 7. 이 프로젝트 설정 구조

```
qrpay_js_sdk/
├── babel.config.js       # Jest용 Babel 설정 (ES module → CommonJS 변환)
├── jest.config.js        # Jest 환경 설정
├── jest.setup.js         # 전역 변수 초기화 (PROFILE 주입)
└── src/
    └── qrpay_sdk.test.js # 테스트 파일
```

### babel.config.js

```js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
};
```

Jest는 Node.js에서 실행되므로 `targets: { node: 'current' }`로 설정합니다.
이 파일이 없으면 `import/export` 문법을 Jest가 이해하지 못합니다.

### jest.config.js

```js
module.exports = {
  testEnvironment: 'jsdom',        // localStorage, window 등 브라우저 API 사용 가능
  setupFiles: ['./jest.setup.js'], // 테스트 전 실행할 파일 지정
};
```

`testEnvironment: 'jsdom'` 이 없으면 `localStorage`가 존재하지 않아 스토리지 관련 테스트가 실패합니다.

### jest.setup.js

```js
global.PROFILE = 'development';
```

`context.js`의 switch문이 `PROFILE` 전역 변수를 참조합니다.
webpack 빌드 시에는 `DefinePlugin`이 주입하지만, Jest 환경에서는 이 파일에서 직접 정의합니다.
