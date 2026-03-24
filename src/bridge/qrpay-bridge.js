const QrpayBridge = (() => {
  window.qrpay = window.qrpay || {};

  // 기기 타입 상수
  const DEVICE_TYPE = {
    ANDROID: 'android',
    IOS: 'ios',
    OTHER: 'other',
  };

  // 현재 기기 타입을 저장할 변수 - 로드 시 자동 판별
  let currentDeviceType = (() => {
    const ua = navigator.userAgent;

    // A. 우리 앱 전용 식별자 우선 체크
    if (/Qrpay_Android/i.test(ua)) return DEVICE_TYPE.ANDROID;
    if (/Qrpay_iOS/i.test(ua)) return DEVICE_TYPE.IOS;

    return DEVICE_TYPE.OTHER;
  })();

  /**
   * 현재 기기 타입 반환
   */
  const getDeviceType = () => {
    return currentDeviceType;
  };

  /**
   * 특정 플랫폼 여부 확인 헬퍼 함수들
   */
  const isAndroid = () => currentDeviceType === DEVICE_TYPE.ANDROID;
  const isIOS = () => currentDeviceType === DEVICE_TYPE.IOS;
  const isOther = () => currentDeviceType === DEVICE_TYPE.OTHER;

  const _execute = ({ androidMethod, iosScheme, params, localCallback }) => {
    if (isAndroid()) {
      const values = Object.values(params || {});

      if (values.length > 0) {
        window.android[androidMethod](...values);
      } else {
        // 인자가 없는 경우 안전하게 직접 호출
        window.android[androidMethod]();
      }
    } else if (isIOS()) {
      location.href = `appto://${iosScheme}?${new URLSearchParams(params).toString()}`;
    } else {
      localCallback && localCallback(...params);
      console.warn(`Action "${action}" is not supported on this platform.`);
    }
  };

  /**
   * 일반적인 페이지 이동 함수
   * @param {string} url - 이동할 목적지 주소
   * @param {object} params - 쿼리 스트링으로 변환할 데이터 (선택)
   * @param {function} preAction - 이동 직전 실행할 로직 (로딩바 등)
   */
  const _go = (url, params = {}, preAction) => {
    // 1. 전처리 (전달받은 함수가 있으면 실행, 없으면 기본 로딩바)
    if (typeof preAction === 'function') {
      preAction();
    } else if (window.$?._Fn?.progressbar) {
      $._Fn.progressbar(true, true, '');
    }

    // 2. 파라미터 조립 (객체를 쿼리 스트링으로 변환)
    const queryString = new URLSearchParams(params).toString();
    const finalUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;

    // 3. 로컬 테스트 및 실행 환경 분기
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal) {
      console.log(`%c[Navigation Test]`, 'color: #fff; background: #ff9500; padding: 2px 5px; border-radius: 3px;');
      console.log(`목적지: ${url}`);
      console.log(`데이터:`, params);
      console.log(`최종 URL: ${finalUrl}`);

      // 로컬에서 실제로 이동시키고 싶지 않다면 아래 주석 처리
      // return;
    }

    // 4. 페이지 이동 실행
    window.location.href = finalUrl;
  };

  const _generateRandomDeviceInfo = () => {
    // 1. 랜덤 UUID 생성 (DEVI_ID)
    const uuid = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        })
        .split('-')
        .slice(0, 5)
        .join('-'); // 예시와 유사한 길이 조정 가능
    };

    // 2. 랜덤 디바이스 모델명 (MODL_NM)
    const models = ['samsung SM-G981N', 'samsung SM-S901N', 'apple iPhone14,2', 'google Pixel 7'];
    const randomModel = models[Math.floor(Math.random() * models.length)];

    // 3. 랜덤 OS 버전 (MOBIL_OS_NM)
    const osVersions = ['11', '12', '13', '14', '15'];
    const randomOS = osVersions[Math.floor(Math.random() * osVersions.length)];

    // 4. 랜덤 토큰 생성 (DEVI_VAL - FCM Token Style)
    const generateToken = (length) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-:';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    return {
      deviceType: 'O', // Android 고정 (필요시 랜덤화)
      modelName: randomModel,
      osName: randomOS,
      deviceId: uuid().substring(0, 36), // 원본 길이와 비슷하게 조정
      appVersion: `1.2.${Math.floor(Math.random() * 10)}`,
      pushToken: `${generateToken(22)}:${generateToken(140)}`,
    };
  };

  /**
   *
   * @param {*} url
   */
  const qrShare = (url = 'pages/home/mpmqr/share/{qrRefd}') => {
    _execute({
      androidMethod: 'qrShare',
      iosScheme: 'qrShare',
      params: { url },
    });
  };

  /**
   * 앱에 저장
   * @param {*} qr base64로 인코딩된 QR 이미지 데이터
   * @param {*} merNm 가맹점명
   */
  const qrLoad = (qr, merNm) => {
    _execute({
      androidMethod: 'qrLoad',
      iosScheme: 'qrLoad',
      params: { qr, merNm },
    });
  };

  /**
   * 앱에 저장되어 있는 qr이미지를 clear시킴
   */
  const qrClear = () => {
    _execute({
      androidMethod: 'qrClear',
      iosScheme: 'qrClear',
      params: {},
    });
  };

  /**
   * 기기 정보 반환 (동기)
   * - sessionStorage에 캐시된 값이 있으면 반환, 없으면 빈 객체 반환
   * - 페이지 로드 시 _prefetchDevice()가 자동 호출되므로
   *   유저 액션(버튼 클릭 등) 시점에는 대부분 캐시에 값이 존재
   * @returns {object} deviceInfo | {}
   */
  const getDevice = () => {
    const cached = sessionStorage.getItem('deviceInfo');
    return cached ? JSON.parse(cached) : {};
  };

  // native 콜백 — 앱이 기기 정보를 전달하면 sessionStorage에 저장
  window.setDevice = (deviceInfo) => {
    console.log(`[QRPAY_BRIDGE] Device info received:`, JSON.stringify(deviceInfo));
    sessionStorage.setItem('deviceInfo', JSON.stringify(deviceInfo));
  };

  // 페이지 로드 시 native에 기기 정보 요청 (setDevice 콜백으로 sessionStorage에 저장됨)
  const _prefetchDevice = () => {
    if (sessionStorage.getItem('deviceInfo')) return; // 이미 캐시 있으면 스킵

    if (isOther()) {
      const deviceInfo = _generateRandomDeviceInfo();
      console.log(`[QRPAY_BRIDGE] Simulated device info:`, deviceInfo);
      window.setDevice(deviceInfo);
    } else {
      _execute({
        androidMethod: 'getDevice',
        iosScheme: 'getDevice',
        params: {},
      });
    }
  };

  _prefetchDevice();

  /**
   * 개인정보처리방침 페이지로 이동
   */

  const goPlicyTreatment = () => {
    _execute({
      androidMethod: 'goPolicyTreatment',
      iosScheme: 'goPolicyTreatment',
      params: {},
    });
  };

  /**
   * 데칼코드 화면으로 이동
   */
  const getDecalCode = () => {
    _execute({
      androidMethod: 'getDecalCode',
      iosScheme: 'getDecalCode',
      params: {},
    });
  };

  window.setDecalCode = (data) => {
    console.log(`[QRPAY_BRIDGE] Received decal code, navigating to decal page...`, data);
  };

  /**
   * CPM QR결제 화면으로 이동
   */
  const getTrnsData = () => {
    if (isOther()) {
      const local_test_TRNS_DATA = 'hQVDUFYwMWFaTwfUEAAAAUAQVxNiUSBgAFQQF9JgRgEBAAAAAAAPXzQBAmM2nyYIPIxIph6Y3o6fJwGAnxAUsQmgAAgAAAAAAAAAICYDGCAYVAGfNgIAB4ICAACfNwQQjzxs';
      console.log(`[QRPAY_BRIDGE] Simulated device info for non-app environment:`, local_test_TRNS_DATA);
      setTrnsData({ TRNS_DATA: local_test_TRNS_DATA });
      return;
    }

    _execute({
      androidMethod: 'getTrnsData',
      iosScheme: 'getTrnsData',
      params: {},
    });
  };

  window.setTrnsData = (trnsData) => {
    // _go('', { cpmQrPayload: trnsData.TRNS_DATA }, () => {
    //   console.log(`[QRPAY_BRIDGE] Received TRNS_DATA, navigating to payment page...`, trnsData);
    // });
    console.log(`[QRPAY_BRIDGE] Received TRNS_DATA, navigating to payment page...`, trnsData);

    window.cpmqrdata = trnsData.TRNS_DATA; // 전역 변수에 저장 (필요에 따라 네임스페이스 고려)

    if (typeof onChangeState === 'function') {
      onChangeState('state-cpmqrpayment');
    } else {
      console.error('onChangeState 함수를 찾을 수 없습니다.');
      _go('', { cpmQrPayload: trnsData.TRNS_DATA }, () => {
        console.log(`[QRPAY_BRIDGE] Received TRNS_DATA, navigating to payment page...`, trnsData);
      });
    }
  };

  const linkExtraBrowser = (url) => {
    _execute({
      androidMethod: 'linkExtraBrowser',
      iosScheme: 'linkExtraBrowser',
      params: { url },
    });
  };

  // Public API
  return {
    getDeviceType,
    qrShare,
    qrLoad,
    qrClear,
    getDevice,
    goPlicyTreatment,
    getDecalCode,
    getTrnsData,
    linkExtraBrowser,
  };
})();
