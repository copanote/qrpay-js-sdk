# QR Pay JS SDK

QR Pay 인증 및 API 통신을 위한 의존성 없는 브라우저 전용 SDK입니다.
Webpack + Babel로 UMD 번들링되어 `<script>` 태그로 바로 사용할 수 있습니다.

---

## 목차

1. [프로젝트 구조](#1-프로젝트-구조)
2. [빌드](#2-빌드)
3. [테스트](#3-테스트)
4. [사용법](#4-사용법)
5. [브리지 파일](#5-브리지-파일)

---

## 1. 프로젝트 구조

```
qrpay_js_sdk/
├── src/
│   ├── index.js              # 번들 진입점 — qrpaySdk, qrpayStorage 인스턴스 생성 및 export
│   ├── qrpay_sdk.js          # 인증, 토큰 관리, HTTP 헬퍼
│   ├── qrpay_sdk.md          # SDK API 상세 문서
│   ├── qrpay_sdk.test.js     # Jest 단위 테스트
│   ├── qrpay_storage.js      # localStorage 추상화
│   ├── context.js            # 빌드 프로파일별 환경 설정
│   ├── banner.js             # 빌드 배너 생성 (git 커밋 해시, 작성자, 시각)
│   └── bridge/
│       ├── qrpay-bridge.js   # 네이티브 앱 브리지 (Android/iOS)
│       └── qrpay-bridge.md   # 브리지 API 문서
├── webpack.config.local.js
├── webpack.config.dev.js
├── webpack.config.prod.js
├── babel.config.js
├── jest.config.js
└── package.json
```

### 모듈 역할

| 파일 | 역할 |
|------|------|
| `qrpay_sdk.js` | 인증(로그인/refresh/로그아웃), 401 자동 갱신, HTTP 헬퍼 |
| `qrpay_storage.js` | `QRPAY_` prefix + JSON 직렬화 localStorage 래퍼 |
| `context.js` | 빌드 프로파일(`local` / `development` / `production`)별 설정 반환 |
| `bridge/qrpay-bridge.js` | 웹뷰 ↔ 네이티브 통신 브리지 (webpack 번들 외부) |

---

## 2. 빌드

```bash
# 의존성 설치
yarn install

# 전체 빌드 (clean → local → dev → prod)
yarn build

# 개별 빌드
yarn local   # dist/local/  — 개발용, HtmlWebpackPlugin 포함
yarn dev     # dist/dev/    — 소스맵 포함
yarn prod    # dist/prod/   — Terser 압축
yarn clean   # dist/ 삭제
```

### 빌드 출력

각 타겟은 UMD 형식으로 두 파일을 생성합니다.

```
dist/
├── local/
│   ├── qrpay_sdk.js
│   └── qrpay_sdk.min.js
├── dev/
│   ├── qrpay_sdk.js
│   └── qrpay_sdk.min.js
└── prod/
    ├── qrpay_sdk.js
    └── qrpay_sdk.min.js
```

### 빌드 프로파일

webpack `DefinePlugin`으로 `PROFILE` 상수가 주입되며, `context.js`에서 프로파일별 동작을 제어합니다.

| 프로파일 | 명령 | 콘솔 로그 |
|----------|------|-----------|
| `local` | `yarn local` | 활성화 |
| `development` | `yarn dev` | 활성화 |
| `production` | `yarn prod` | 비활성화 |

---

## 3. 테스트

```bash
yarn test           # 전체 실행
yarn test:watch     # watch 모드
```

- **환경:** Jest + jsdom (`jest-environment-jsdom`)
- **대상:** `src/qrpay_sdk.test.js` — `qrpay_sdk.js`의 모든 공개 API 커버
- **설정:** `jest.config.js`, `jest.setup.js`, `babel.config.js`

### 테스트 커버리지

| 영역 | 케이스 |
|------|--------|
| `authenticate()` | 성공/실패/네트워크 오류/deviceInfo 생략 |
| `refresh()` | 토큰 없음/성공/실패/동시 호출 race condition |
| `logout()` | 토큰 없음/성공/API 실패 |
| `verifyAccessToken()` | 토큰 없음/만료/유효 |
| `getAccessToken()` | 정상/없음 |
| `fetchPostAsync()` | 성공/토큰 헤더/오류/네트워크 오류 |
| `fetchGetAsync()` | 성공/body 없음/네트워크 오류 |
| 401 자동 refresh | refresh 성공 후 retry/refresh 실패/토큰 없음/refresh 엔드포인트 제외 |
| X-Transaction-ID | 응답 저장/요청 포함/없을 때 제외 |

---

## 4. 사용법

빌드된 파일을 `<script>` 태그로 로드하면 `window.qrpaySdk`, `window.qrpayStorage`가 즉시 사용 가능합니다.

```html
<script src="/dist/prod/qrpay_sdk.js"></script>
```

```js
// 로그인
const result = await qrpaySdk.authenticate('user01', encryptedPassword, keypadRefId, deviceInfo);

// API 호출 — 401 시 자동으로 토큰 갱신 후 재시도
const data = await qrpaySdk.fetchGetAsync('/qrpay/api/v1/merchant/info');

// 로그아웃
await qrpaySdk.logout();
```

API 상세 사용법은 **[`src/qrpay_sdk.md`](src/qrpay_sdk.md)** 를 참고하세요.

---

## 5. 브리지 파일

`src/bridge/` 의 파일은 webpack 번들에 포함되지 않으며, `<script>` 태그로 별도 로드합니다.

```html
<script src="/path/to/qrpay-bridge.js"></script>
```

- **`qrpay-bridge.js`** — Android/iOS 네이티브 앱과의 통신 처리 (UA 감지, 딥링크 등)

브리지 API 상세는 **[`src/bridge/qrpay-bridge.md`](src/bridge/qrpay-bridge.md)** 를 참고하세요.
