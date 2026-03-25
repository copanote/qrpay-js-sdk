# QrpayBridge User Guide

웹뷰와 네이티브 앱(Android / iOS) 사이의 브릿지 모듈입니다.
기기 정보 조회, QR 조작, 화면 이동, NFilter 보안 키패드를 단일 인터페이스로 제공합니다.

---

## 목차

1. [설치 및 초기화](#1-설치-및-초기화)
2. [플랫폼 감지](#2-플랫폼-감지)
3. [기기 정보](#3-기기-정보)
4. [QR 조작](#4-qr-조작)
5. [화면 이동](#5-화면-이동)
6. [NFilter 보안 키패드](#6-nfilter-보안-키패드)
7. [로그인 통합 예시](#7-로그인-통합-예시)
8. [SessionStorage 키 목록](#8-sessionstorage-키-목록)
9. [환경별 동작](#9-환경별-동작)

---

## 1. 설치 및 초기화

### 스크립트 로드

```html
<!-- 두 파일은 독립적이므로 로드 순서는 무관합니다 -->
<script src="/path/to/qrpay-bridge.js"></script>
<script src="/path/to/qrpay_sdk.js"></script>
```

### 자동 초기화

스크립트가 로드되는 순간 아래 두 가지가 **자동으로** 실행됩니다.

| 동작 | 설명 |
|------|------|
| `_prefetchDevice()` | 네이티브 앱에 기기 정보를 요청하여 sessionStorage에 캐시 |
| `_fetchAndInitKeypad()` | 서버에서 nFilter 공개키를 받아 보안 키패드 초기화 |

별도의 초기화 코드 없이 페이지 로드 후 `QrpayBridge.xxx()` 형태로 바로 사용할 수 있습니다.

---

## 2. 플랫폼 감지

`navigator.userAgent`에 포함된 앱 전용 식별자로 플랫폼을 자동 판별합니다.

| UA 문자열 | 판별 결과 |
|-----------|-----------|
| `Qrpay_Android` 포함 | `'android'` |
| `Qrpay_iOS` 포함 | `'ios'` |
| 그 외 (PC, 일반 브라우저) | `'other'` |

### API

```js
QrpayBridge.isAndroid()    // boolean
QrpayBridge.isIOS()        // boolean
QrpayBridge.isOther()      // boolean — 앱 외 환경 (로컬 개발 포함)
QrpayBridge.getDeviceType() // 'android' | 'ios' | 'other'
```

### 예시

```js
if (QrpayBridge.isAndroid()) {
  console.log('Android 앱 내 웹뷰');
} else if (QrpayBridge.isIOS()) {
  console.log('iOS 앱 내 웹뷰');
} else {
  console.log('로컬 개발 환경');
}
```

---

## 3. 기기 정보

### getDevice()

sessionStorage에 캐시된 기기 정보를 동기적으로 반환합니다.
페이지 로드 시 자동으로 prefetch되므로 버튼 클릭 시점에는 대부분 값이 존재합니다.

```js
const deviceInfo = QrpayBridge.getDevice();
// {
//   deviceType: 'O',
//   modelName: 'samsung SM-G981N',
//   osName: '13',
//   deviceId: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
//   appVersion: '1.2.3',
//   pushToken: 'xxxx:xxxx...'
// }
```

> **주의:** 앱이 아직 `setDevice` 콜백을 호출하지 않은 시점이면 빈 객체 `{}` 가 반환됩니다.
> 로그인 등 중요한 동작 전에 값 여부를 확인하세요.

```js
const deviceInfo = QrpayBridge.getDevice();
if (!deviceInfo.deviceId) {
  alert('기기 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
  return;
}
```

### window.setDevice (네이티브 → 웹 콜백)

네이티브 앱이 기기 정보를 전달할 때 자동으로 호출됩니다. 직접 호출하지 않습니다.

---

## 4. QR 조작

### qrShare(url)

QR 공유 화면으로 이동합니다.

```js
QrpayBridge.qrShare('pages/home/mpmqr/share/ABC123');
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `url` | string | `'pages/home/mpmqr/share/{qrRefd}'` | 공유할 QR 페이지 경로 |

### qrLoad(qr, merNm)

base64 인코딩된 QR 이미지를 앱에 저장합니다.

```js
QrpayBridge.qrLoad('data:image/png;base64,iVBOR...', '스타벅스 강남점');
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `qr` | string | base64 인코딩된 QR 이미지 |
| `merNm` | string | 가맹점명 |

### qrClear()

앱에 저장된 QR 이미지를 삭제합니다.

```js
QrpayBridge.qrClear();
```

---

## 5. 화면 이동

### goPlicyTreatment()

개인정보처리방침 페이지로 이동합니다.

```js
QrpayBridge.goPlicyTreatment();
```

### getDecalCode(callback)

데칼코드 화면으로 이동합니다.
네이티브가 코드를 전달하면 `window.setDecalCode`가 호출됩니다.

```js
QrpayBridge.getDecalCode();

// 네이티브 콜백 (필요 시 재정의)
window.setDecalCode = (data) => {
  console.log('수신된 데칼코드:', data);
};
```

### getTrnsData(callback)

CPM QR 결제 데이터를 요청합니다.
네이티브가 데이터를 전달하면 callback이 실행됩니다.

```js
QrpayBridge.getTrnsData((trnsData) => {
  // trnsData: CPM QR 페이로드 문자열
  console.log('결제 데이터:', trnsData);
  onChangeState('state-cpmqrpayment');
});
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `callback` | `(trnsData: string) => void` | 결제 데이터 수신 시 호출 |

### linkExtraBrowser(url)

URL을 외부 브라우저로 엽니다.

```js
QrpayBridge.linkExtraBrowser('https://example.com/terms');
```

---

## 6. NFilter 보안 키패드

비밀번호 등 민감한 입력을 암호화하는 보안 키패드입니다.
스크립트 로드 시 서버에서 공개키를 자동으로 받아 초기화됩니다.

### 초기화 흐름

```
페이지 로드
  └─ _fetchAndInitKeypad() 자동 실행
       ├─ sessionStorage에 캐시된 공개키가 있으면 → initNfilterKeypad() 바로 호출
       └─ 없으면 → GET /qrpay/external/nfilter/keypad/init
            ├─ 성공: publicKey + keypadRefId 를 sessionStorage에 저장 후 initNfilterKeypad() 호출
            └─ 실패: 기본 공개키(하드코딩)로 fallback
```

### getKeypadRefId()

현재 세션의 키패드 참조 ID를 반환합니다.
로그인 시 서버로 전달해야 합니다.

```js
const keypadRefId = QrpayBridge.getKeypadRefId();
// 'abc123-ref-id' 또는 'QRPAY_LOCAL_1711234567890' (fallback)
```

### showNFilterKeypad(mode, name, len, desc, upYn, callback)

보안 키패드를 표시합니다.

```js
QrpayBridge.showNFilterKeypad(
  'num',          // mode: 'num'(숫자) | 'eng'(영문)
  'password',     // name: 필드명 (서버로 전달됨)
  6,              // len: 최대 입력 길이
  '비밀번호 입력', // desc: 키패드 상단 타이틀
  'Y',            // upYn: 키패드 올림 여부 ('Y' | 'N') — iOS 전용
  (encData, name, dummyData) => {
    // encData: 암호화된 입력값
    // name: 필드명 (showNFilterKeypad 호출 시 전달한 name)
    // dummyData: 더미 데이터
    console.log('암호화된 입력값:', encData);
    submitLogin(encData);
  }
);
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `mode` | `'num' \| 'eng'` | `'num'` | 키패드 입력 모드 |
| `name` | string | `'qrpayKeypad'` | 필드명 |
| `len` | number | — | 최대 입력 글자 수 |
| `desc` | string | — | 키패드 상단 타이틀 |
| `upYn` | `'Y' \| 'N'` | — | 키패드 올림 여부 (iOS 전용) |
| `callback` | function | — | 입력 완료 시 호출 |

### hideNFilterKeypad(callback)

보안 키패드를 닫습니다.

```js
QrpayBridge.hideNFilterKeypad(() => {
  console.log('키패드가 닫혔습니다.');
});
```

---

## 7. 로그인 통합 예시

`qrpay_sdk.js`와 `QrpayBridge`를 함께 사용하는 전형적인 로그인 흐름입니다.

```js
// 1. 비밀번호 입력 필드 클릭 시 보안 키패드 표시
document.getElementById('passwordField').addEventListener('click', () => {
  QrpayBridge.showNFilterKeypad('num', 'password', 6, '비밀번호 입력', 'Y', async (encData) => {

    // 2. 키패드 입력 완료 → 로그인 요청
    const keypadRefId = QrpayBridge.getKeypadRefId();
    const deviceInfo  = QrpayBridge.getDevice();

    const result = await qrpaySdk.authenticate(
      document.getElementById('userId').value,
      encData,       // 암호화된 비밀번호
      keypadRefId,   // nFilter 키패드 참조 ID
      deviceInfo     // 기기 정보
    );

    if (result.ok) {
      console.log('로그인 성공');
    } else {
      console.error('로그인 실패:', result.error);
    }
  });
});
```

---

## 8. SessionStorage 키 목록

브릿지가 내부적으로 사용하는 sessionStorage 키입니다. 직접 접근보다는 API를 통해 사용하세요.

| 키 | 저장 값 | 설명 |
|----|---------|------|
| `QRPAY_deviceInfo` | JSON string | 기기 정보 캐시 |
| `QRPAY_nfilterKeypadRefId` | string | nFilter 키패드 참조 ID |
| `QRPAY_nfilterPublicKey` | string | nFilter 공개키 캐시 |

---

## 9. 환경별 동작

`isOther()` 가 `true`인 환경(로컬 개발, 일반 브라우저)에서는 네이티브 호출 대신 모의 데이터로 동작합니다.

| 기능 | 앱 환경 | 로컬/브라우저 환경 |
|------|---------|-------------------|
| `getDevice()` | 네이티브 앱에서 실제 기기 정보 수신 | 랜덤 기기 정보 자동 생성 |
| `showNFilterKeypad()` | 실제 보안 키패드 표시 | `console.warn` 출력 |
| `getTrnsData()` | 네이티브에서 CPM QR 데이터 수신 | 하드코딩된 테스트 데이터 사용 |
| nFilter 초기화 | 서버 API 호출 후 공개키 수신 | `test_ref_id` / `test_public_key` 사용 |
