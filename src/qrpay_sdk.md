# qrpaySdk User Guide

QR Pay 인증 및 API 통신을 위한 브라우저 SDK입니다.
Webpack으로 UMD 번들링되어 `window.qrpaySdk` / `window.qrpayStorage` 전역 변수로 제공됩니다.

---

## 목차

1. [설치](#1-설치)
2. [빠른 시작](#2-빠른-시작)
3. [인증 API](#3-인증-api)
4. [HTTP 헬퍼](#4-http-헬퍼)
5. [스토리지](#5-스토리지-qrpaystorage)
6. [에러 처리](#6-에러-처리)
7. [API 상수](#7-api-상수)
8. [localStorage 키 목록](#8-localstorage-키-목록)
9. [빌드 프로파일](#9-빌드-프로파일)

---

## 1. 설치

### 스크립트 로드

```html
<script src="/path/to/qrpay_sdk.js"></script>
```

### 전역 변수

| 변수 | 설명 |
|------|------|
| `window.qrpaySdk` | 인증 및 HTTP 헬퍼 인스턴스 |
| `window.qrpayStorage` | localStorage 추상화 인스턴스 |

스크립트 로드 즉시 두 인스턴스가 생성됩니다. 별도의 초기화 호출은 필요하지 않습니다.

---

## 2. 빠른 시작

로그인 → 인증된 API 호출 → 로그아웃의 전체 흐름입니다.

```js
// 1. 로그인
const loginResult = await qrpaySdk.authenticate('user01', encryptedPassword, keypadRefId, deviceInfo);

if (!loginResult.ok) {
  console.error('로그인 실패:', loginResult.error);
  return;
}

// 2. 토큰 유효성 확인
if (!qrpaySdk.verifyAccessToken()) {
  await qrpaySdk.refresh(); // 만료 시 갱신
}

// 3. 인증이 필요한 API 호출
const result = await qrpaySdk.fetchGetAsync(qrpaySdk.REST_APIS.MERCHANT.INFO);
if (result.ok) {
  console.log('가맹점 정보:', result);
}

// 4. 로그아웃
await qrpaySdk.logout();
```

---

## 3. 인증 API

### authenticate(username, password, keypadRefId, deviceInfo)

로그인 후 토큰을 localStorage에 자동 저장합니다.

```js
const result = await qrpaySdk.authenticate(
  'user01',           // username
  encryptedPassword,  // 암호화된 비밀번호
  keypadRefId,        // 키패드 참조 ID
  {
    deviceId: '...',
    deviceType: 'O',
    modelName: 'samsung SM-G981N',
    osName: '13',
    appVersion: '1.2.3',
    pushToken: '...',
  }
);

// 성공
// { ok: true, accessToken: '...', accessTokenExpiresIn: 1774368015148, refreshToken: '...' }

// 실패
// { ok: false, status: 401, statusText: 'Unauthorized', error: { ... } }
```

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `username` | string | Y | 로그인 ID |
| `password` | string | Y | nFilter로 암호화된 비밀번호 |
| `keypadRefId` | string | Y | nFilter 키패드 참조 ID |
| `deviceInfo` | object | N | 기기 정보 (기본값 `{}`) |

성공 시 `QRPAY_accessToken`, `QRPAY_accessTokenExpiresIn`, `QRPAY_refreshToken` 을 localStorage에 저장합니다.

---

### refresh()

저장된 refreshToken으로 accessToken을 갱신합니다.

```js
const result = await qrpaySdk.refresh();

if (result.ok) {
  console.log('토큰 갱신 성공');
} else {
  // refreshToken 만료 → 재로그인 필요
  window.location.href = qrpaySdk.PAGES_APIS.PAGES_LOGIN;
}
```

- refreshToken이 없으면 `{ ok: false, status: 401, error: 'No refresh token available' }` 반환
- 성공 시 `QRPAY_accessToken`, `QRPAY_accessTokenExpiresIn` 갱신

---

### logout()

서버에 로그아웃을 요청하고 localStorage의 모든 토큰을 삭제합니다.

```js
await qrpaySdk.logout();
window.location.href = qrpaySdk.PAGES_APIS.PAGES_LOGIN;
```

> API 응답 성공 여부와 관계없이 **항상 `true`를 반환**하며 토큰은 즉시 삭제됩니다.

---

### verifyAccessToken()

현재 저장된 accessToken의 유효성을 동기적으로 확인합니다.

```js
if (!qrpaySdk.verifyAccessToken()) {
  const refreshResult = await qrpaySdk.refresh();
  if (!refreshResult.ok) {
    // 재로그인 필요
  }
}
```

| 반환값 | 조건 |
|--------|------|
| `false` | accessToken 없음 |
| `false` | 토큰 만료 (`Date.now() >= accessTokenExpiresIn`) |
| `true` | 토큰 유효 |

---

### getAccessToken()

현재 저장된 accessToken과 만료시각을 반환합니다.

```js
const { accessToken, accessTokenExpiresIn } = qrpaySdk.getAccessToken();
```

**반환:** `{ accessToken: string | null, accessTokenExpiresIn: number | null }`

---

### getRefreshToken()

현재 저장된 refreshToken을 반환합니다.

```js
const refreshToken = qrpaySdk.getRefreshToken(); // string | null
```

---

## 4. HTTP 헬퍼

모든 메서드는 현재 저장된 accessToken을 `Authorization: Bearer {token}` 헤더에 자동으로 추가합니다.
토큰이 없으면 헤더 없이 요청합니다.

### async / await 방식 (권장)

#### fetchPostAsync(url, data, accessToken?)

```js
const result = await qrpaySdk.fetchPostAsync(
  qrpaySdk.REST_APIS.MERCHANT.CHANGE_NAME,
  { merNm: '새 가맹점명' }
);

if (result.ok) {
  console.log('성공:', result);
} else {
  console.error(`[${result.status}] ${result.error}`);
}
```

#### fetchGetAsync(url, accessToken?)

```js
const result = await qrpaySdk.fetchGetAsync(qrpaySdk.REST_APIS.MERCHANT.INFO);

if (result.ok) {
  console.log('가맹점 정보:', result);
}
```

**응답 형식:**

| 케이스 | 반환값 |
|--------|--------|
| HTTP 2xx | `{ ok: true, ...서버응답JSON }` |
| HTTP 오류 | `{ ok: false, status, statusText, error }` |
| 네트워크/CORS 오류 | `{ ok: false, status: 999, code: 'EQ999', message: '...', error }` |

---

### Promise 방식

서드파티 라이브러리 등 Promise 체이닝이 필요한 경우 사용합니다.
**raw `Response` 객체를 반환**하므로 직접 `.json()` 파싱이 필요합니다.

#### fetchPostPromise(url, data, accessToken?)

```js
qrpaySdk.fetchPostPromise('/qrpay/api/v1/merchant/mpmqr', { amount: 10000 })
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((err) => console.error(err));
```

#### fetchGetPromise(url, accessToken?)

```js
qrpaySdk.fetchGetPromise('/qrpay/api/v1/merchant/employees')
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((err) => console.error(err));
```

> `fetchPostAsync` / `fetchGetAsync` 와 달리 응답을 `{ ok, ...data }` 형태로 가공하지 않습니다.

---

### accessToken 수동 지정

특정 토큰으로 요청해야 할 때 세 번째 인자로 전달합니다.

```js
// 자동 (저장된 토큰 사용)
await qrpaySdk.fetchGetAsync('/qrpay/api/v1/merchant/info');

// 수동 (특정 토큰 지정)
await qrpaySdk.fetchGetAsync('/qrpay/api/v1/merchant/info', 'custom_token');

// 토큰 없이 요청
await qrpaySdk.fetchGetAsync('/qrpay/api/v1/merchant/info', null);
```

---

## 5. 스토리지 (qrpayStorage)

localStorage를 `QRPAY_` prefix + JSON 직렬화로 추상화합니다.
SDK 내부 토큰 저장에도 동일하게 사용됩니다.

```js
// 저장
qrpayStorage.save('userSettings', { theme: 'dark', lang: 'ko' });
// → localStorage['QRPAY_userSettings'] = '{"theme":"dark","lang":"ko"}'

// 조회
const settings = qrpayStorage.find('userSettings');
// → { theme: 'dark', lang: 'ko' }

// 삭제
qrpayStorage.remove('userSettings');

// 전체 삭제 (localStorage 전체 초기화)
qrpayStorage.clearAll();
```

| 메서드 | 반환값 | 설명 |
|--------|--------|------|
| `save(key, value)` | `true` / `false` | 저장 성공 여부 |
| `find(key)` | `value` / `null` | 없거나 파싱 오류 시 `null` |
| `remove(key)` | `true` / `false` | 삭제 성공 여부 |
| `clearAll()` | `true` / `false` | **localStorage 전체** 삭제 |

> `clearAll()`은 `QRPAY_` 외 다른 키도 모두 삭제합니다. 주의해서 사용하세요.

---

## 6. 에러 처리

### 응답 패턴

모든 async 메서드는 예외를 throw하지 않고 `ok: false` 객체를 반환합니다.

```js
const result = await qrpaySdk.fetchPostAsync('/qrpay/api/v1/merchant/change-name', { merNm: '...' });

if (!result.ok) {
  switch (result.status) {
    case 401:
      // 토큰 만료 → 재발급 후 재시도
      await qrpaySdk.refresh();
      break;
    case 999:
      // 네트워크 오류 (CORS, 연결 끊김 등)
      alert('네트워크 오류가 발생했습니다.');
      break;
    default:
      console.error(`서버 오류 [${result.status}]:`, result.error);
  }
}
```

### QRPAY_CODE 상수

```js
qrpaySdk.QRPAY_CODE.RE_ATHENTICATE
// { ok: false, status: 401, code: 'EQ401', message: 'Authentication Required.' }

qrpaySdk.QRPAY_CODE.FETCH_ERROR
// { ok: false, status: 999, code: 'EQ999', message: 'Fetch Promise Rejected(Network error, CORS, etc.)' }

qrpaySdk.QRPAY_CODE.API_ERROR
// { ok: false, status: 500, code: 'EQ500', message: 'application error' }
```

### 401 자동 갱신 패턴

SDK는 401 응답 시 자동으로 토큰을 갱신하지 않습니다. 아래 패턴을 권장합니다.

```js
async function callWithRefresh(url) {
  let result = await qrpaySdk.fetchGetAsync(url);

  if (!result.ok && result.status === 401) {
    const refreshResult = await qrpaySdk.refresh();
    if (!refreshResult.ok) {
      window.location.href = qrpaySdk.PAGES_APIS.PAGES_LOGIN;
      return;
    }
    result = await qrpaySdk.fetchGetAsync(url); // 재시도
  }

  return result;
}
```

---

## 7. API 상수

### AUTH_APIS

```js
qrpaySdk.AUTH_APIS.AUTH_LOGIN        // '/qrpay/auth/login'
qrpaySdk.AUTH_APIS.AUTH_REFRESH      // '/qrpay/auth/refresh'
qrpaySdk.AUTH_APIS.AUTH_LOGOUT       // '/qrpay/auth/logout'
```

### PAGES_APIS

```js
qrpaySdk.PAGES_APIS.PAGES_LOGIN                    // '/qrpay/pages/login'
qrpaySdk.PAGES_APIS.PAGES_MAIN                     // '/qrpay/pages/home/mpmqr'
qrpaySdk.PAGES_APIS.PAGES_NOTICE                   // '/qrpay/pages/settings/notice'
qrpaySdk.PAGES_APIS.PAGES_GUIDE                    // '/qrpay/pages/settings/guide'
qrpaySdk.PAGES_APIS.PAGES_TERMS_SERVICE            // '/qrpay/pages/settings/terms-service'
qrpaySdk.PAGES_APIS.PAGES_TERMS_SERVICE_TERMS      // '/pages/settings/terms-service/terms'
qrpaySdk.PAGES_APIS.PAGES_TERMS_SERVICE_PERMISSIONS // '/qrpay/pages/settings/terms-service/permissions'
qrpaySdk.PAGES_APIS.PAGES_TERMS_SERVICE_CANCEL     // '/qrpay/pages/settings/terms-service/cancel'
```

### REST_APIS

```js
// 가맹점
qrpaySdk.REST_APIS.MERCHANT.INFO          // '/qrpay/api/v1/merchant/info'
qrpaySdk.REST_APIS.MERCHANT.EMPLOYEES     // '/qrpay/api/v1/merchant/employees'
qrpaySdk.REST_APIS.MERCHANT.ADD_EMPLOYEES // '/qrpay/api/v1/merchant/add-employee'
qrpaySdk.REST_APIS.MERCHANT.MPMQR         // '/qrpay/api/v1/merchant/mpmqr'
qrpaySdk.REST_APIS.MERCHANT.CHANGE_NAME   // '/qrpay/api/v1/merchant/change-name'
qrpaySdk.REST_APIS.MERCHANT.CHANGE_TIP    // '/qrpay/api/v1/merchant/change-tip'
qrpaySdk.REST_APIS.MERCHANT.CHANGE_VAT    // '/qrpay/api/v1/merchant/change-vat'
```

---

## 8. localStorage 키 목록

SDK가 내부적으로 사용하는 키입니다. 직접 접근보다 API를 통해 사용하세요.

| 키 | 타입 | 설명 |
|----|------|------|
| `QRPAY_accessToken` | string | API 호출용 Bearer 토큰 |
| `QRPAY_accessTokenExpiresIn` | number | 토큰 만료 시각 (epoch milliseconds) |
| `QRPAY_refreshToken` | string | 토큰 갱신용 refresh 토큰 |

---

## 9. 빌드 프로파일

webpack 빌드 시 `PROFILE` 환경 변수로 동작을 제어합니다.

| 프로파일 | 빌드 명령 | 출력 경로 | 콘솔 로그 |
|----------|-----------|-----------|-----------|
| `local` | `yarn local` | `dist/local/` | 활성화 |
| `development` | `yarn dev` | `dist/dev/` | 활성화 |
| `production` | `yarn prod` | `dist/prod/` | 비활성화 |

`loggable: true` 시 `authenticate()`, `refresh()` 의 응답이 콘솔에 출력됩니다.
`production` 빌드에서는 모든 SDK 내부 디버그 로그가 비활성화됩니다.
