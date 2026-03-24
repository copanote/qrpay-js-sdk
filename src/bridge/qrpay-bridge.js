const QrpayBridge = (() => {
  window.qrpay = window.qrpay || {};

  // ─── 플랫폼 감지 ───────────────────────────────────────────────────────────

  const DEVICE_TYPE = { ANDROID: 'android', IOS: 'ios', OTHER: 'other' };

  const currentDeviceType = (() => {
    const ua = navigator.userAgent;
    if (/Qrpay_Android/i.test(ua)) return DEVICE_TYPE.ANDROID;
    if (/Qrpay_iOS/i.test(ua)) return DEVICE_TYPE.IOS;
    return DEVICE_TYPE.OTHER;
  })();

  const isAndroid = () => currentDeviceType === DEVICE_TYPE.ANDROID;
  const isIOS = () => currentDeviceType === DEVICE_TYPE.IOS;
  const isOther = () => currentDeviceType === DEVICE_TYPE.OTHER;
  const getDeviceType = () => currentDeviceType;

  // ─── 네이티브 호출 디스패처 ────────────────────────────────────────────────

  const _execute = ({ androidMethod, iosScheme, params, localCallback }) => {
    if (isAndroid()) {
      const values = Object.values(params || {}).filter((val) => val !== undefined && val !== null);
      if (values.length > 0) {
        console.log(`Calling Android method: ${androidMethod} with params:`, values);
        window.android[androidMethod](...values);
      } else {
        console.log(`Calling Android method: ${androidMethod}`);
        window.android[androidMethod]();
      }
    } else if (isIOS()) {
      location.href = `appto://${iosScheme}?${new URLSearchParams(params).toString()}`;
    } else {
      localCallback && localCallback(params);
      console.warn(`Action android:"${androidMethod}" ios:"${iosScheme}" is not supported on this platform.`);
    }
  };

  // ─── 콜백 핸들러 ──────────────────────────────────────────────────────────

  const _callbackHandlers = { show: null, hide: null, trnsData: null };

  // ─── Device ────────────────────────────────────────────────────────────────

  const _generateRandomDeviceInfo = () => {
    const uuid = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        .replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        })
        .split('-')
        .slice(0, 5)
        .join('-');

    const models = ['samsung SM-G981N', 'samsung SM-S901N', 'apple iPhone14,2', 'google Pixel 7'];
    const osVersions = ['11', '12', '13', '14', '15'];
    const generateToken = (length) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-:';
      let result = '';
      for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };

    return {
      deviceType: 'O',
      modelName: models[Math.floor(Math.random() * models.length)],
      osName: osVersions[Math.floor(Math.random() * osVersions.length)],
      deviceId: uuid().substring(0, 36),
      appVersion: `1.2.${Math.floor(Math.random() * 10)}`,
      pushToken: `${generateToken(22)}:${generateToken(140)}`,
    };
  };

  /**
   * 기기 정보 반환 (동기)
   * - 페이지 로드 시 _prefetchDevice()가 자동 호출되므로
   *   유저 액션(버튼 클릭 등) 시점에는 대부분 캐시에 값이 존재
   * @returns {object} deviceInfo | {}
   */
  const getDevice = () => {
    const cached = sessionStorage.getItem('QRPAY_deviceInfo');
    return cached ? JSON.parse(cached) : {};
  };

  // native 콜백 — 앱이 기기 정보를 전달하면 sessionStorage에 저장
  window.setDevice = (deviceInfo) => {
    console.log(`[QRPAY_BRIDGE] Device info received:`, JSON.stringify(deviceInfo));
    sessionStorage.setItem('QRPAY_deviceInfo', JSON.stringify(deviceInfo));
  };

  const _prefetchDevice = () => {
    if (sessionStorage.getItem('QRPAY_deviceInfo')) return;

    if (isOther()) {
      const deviceInfo = _generateRandomDeviceInfo();
      console.log(`[QRPAY_BRIDGE] Simulated device info:`, deviceInfo);
      window.setDevice(deviceInfo);
    } else {
      _execute({ androidMethod: 'getDevice', iosScheme: 'getDevice', params: {} });
    }
  };

  // ─── QR ────────────────────────────────────────────────────────────────────

  /** @param {string} url */
  const qrShare = (url = 'pages/home/mpmqr/share/{qrRefd}') => {
    _execute({ androidMethod: 'qrShare', iosScheme: 'qrShare', params: { url } });
  };

  /**
   * QR 이미지를 앱에 저장
   * @param {string} qr base64로 인코딩된 QR 이미지 데이터
   * @param {string} merNm 가맹점명
   */
  const qrLoad = (qr, merNm) => {
    _execute({ androidMethod: 'qrLoad', iosScheme: 'qrLoad', params: { qr, merNm } });
  };

  /** 앱에 저장된 QR 이미지를 clear */
  const qrClear = () => {
    _execute({ androidMethod: 'qrClear', iosScheme: 'qrClear', params: {} });
  };

  // ─── 네이티브 화면 이동 ────────────────────────────────────────────────────

  /** 개인정보처리방침 페이지로 이동 */
  const goPlicyTreatment = () => {
    _execute({ androidMethod: 'goPolicyTreatment', iosScheme: 'goPolicyTreatment', params: {} });
  };

  /** 데칼코드 화면으로 이동 */
  const getDecalCode = () => {
    _execute({ androidMethod: 'getDecalCode', iosScheme: 'getDecalCode', params: {} });
  };

  window.setDecalCode = (data) => {
    console.log(`[QRPAY_BRIDGE] Received decal code:`, data);
  };

  /**
   * CPM QR결제 데이터 요청
   * @param {function} callback (trnsData: string) => void
   */
  const getTrnsData = (callback) => {
    _callbackHandlers.trnsData = callback;

    if (isOther()) {
      const local_test_TRNS_DATA = 'hQVDUFYwMWFaTwfUEAAAAUAQVxNiUSBgAFQQF9JgRgEBAAAAAAAPXzQBAmM2nyYIPIxIph6Y3o6fJwGAnxAUsQmgAAgAAAAAAAAAICYDGCAYVAGfNgIAB4ICAACfNwQQjzxs';
      console.log(`[QRPAY_BRIDGE] Simulated TRNS_DATA:`, local_test_TRNS_DATA);
      window.setTrnsData({ TRNS_DATA: local_test_TRNS_DATA });
      return;
    }
    _execute({ androidMethod: 'getTrnsData', iosScheme: 'getTrnsData', params: {} });
  };

  window.setTrnsData = (trnsData) => {
    console.log(`[QRPAY_BRIDGE] Received TRNS_DATA:`, trnsData);
    if (typeof _callbackHandlers.trnsData === 'function') {
      _callbackHandlers.trnsData(trnsData.TRNS_DATA);
    }
  };

  /** 외부 브라우저로 링크 열기 */
  const linkExtraBrowser = (url) => {
    _execute({ androidMethod: 'linkExtraBrowser', iosScheme: 'linkExtraBrowser', params: { url } });
  };

  // ─── NFilter 보안 키패드 ────────────────────────────────────────────────────

  const getKeypadRefId = () => sessionStorage.getItem('QRPAY_nfilterKeypadRefId');

  const initNfilterKeypad = (publicKey = 'MDIwGhMABBYCAXQCcgPD03i3Aapp4p46dZn2xUdDBBTgom5uUpwmpC0hhxWJi2jeT6jWEg==') => {
    _execute({ androidMethod: 'nfilter', iosScheme: 'nfilter', params: { publicKey } });
  };

  /**
   * 보안 키패드 표시
   * @param {string} mode num | eng
   * @param {string} name fieldname
   * @param {number} len 글자 최대 길이
   * @param {string} desc title
   * @param {string} upYn 키패드 up/down 여부
   * @param {function} callback (encData, name, dummyData) => void
   */
  const showNFilterKeypad = (mode = 'num', name = 'qrpayKeypad', len, desc, upYn, callback) => {
    _callbackHandlers.show = callback;
    _execute({
      androidMethod: 'showNFilterKeypad',
      iosScheme: 'showNFilterKeypad',
      params: isIOS() ? { mode, name, len, desc, upYn } : { mode, name, len, desc },
    });
  };

  /** @param {function} callback () => void */
  const hideNFilterKeypad = (callback) => {
    _callbackHandlers.hide = callback;
    _execute({ androidMethod: 'hideNFilterKeypad', iosScheme: 'hideNFilterKeypad', params: {} });
  };

  window.showNFilterKeypadCallBack = (encData, name, dummyData) => {
    console.log(`[QRPAY_BRIDGE] showNFilterKeypadCallBack — encData: ${encData}, name: ${name}, dummyData: ${dummyData}`);
    if (typeof _callbackHandlers.show === 'function') {
      _callbackHandlers.show(encData, name, dummyData);
    }
  };

  window.hideNFilterKeypadCallBack = () => {
    console.log('[QRPAY_BRIDGE] hideNFilterKeypadCallBack');
    if (typeof _callbackHandlers.hide === 'function') {
      _callbackHandlers.hide();
    }
  };

  window.closeNFilterKeypadCallBack = () => {
    console.log('[QRPAY_BRIDGE] closeNFilterKeypadCallBack');
  };

  const _fetchAndInitKeypad = async () => {
    if (isOther()) {
      console.log('[QRPAY_BRIDGE] Non-app environment. Using simulated keypad data.');
      sessionStorage.setItem('QRPAY_nfilterKeypadRefId', 'test_ref_id');
      sessionStorage.setItem('QRPAY_nfilterPublicKey', 'test_public_key');
      return;
    }

    if (sessionStorage.getItem('QRPAY_nfilterPublicKey') && sessionStorage.getItem('QRPAY_nfilterKeypadRefId')) {
      console.log('[QRPAY_BRIDGE] 세션에서 공개키와 키패드 참조 ID를 찾았습니다. 초기화 시작');
      initNfilterKeypad(sessionStorage.getItem('QRPAY_nfilterPublicKey'));
      return;
    }

    try {
      const response = await fetch('/qrpay/external/nfilter/keypad/init', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const { publicKey, keypadRefId } = await response.json();

      if (publicKey) {
        sessionStorage.setItem('QRPAY_nfilterKeypadRefId', keypadRefId);
        sessionStorage.setItem('QRPAY_nfilterPublicKey', publicKey);
        console.log('[QRPAY_BRIDGE] 공개키 로드 성공 및 초기화 시작');
        initNfilterKeypad(publicKey);
      } else {
        console.error('[QRPAY_BRIDGE] 응답에 공개키가 없습니다.');
      }
    } catch (error) {
      const keypadRefId = `QRPAY_LOCAL_${Date.now()}`;
      const publicKey = 'MDIwGhMABBYCAXQCcgPD03i3Aapp4p46dZn2xUdDBBTgom5uUpwmpC0hhxWJi2jeT6jWEg==';
      sessionStorage.setItem('QRPAY_nfilterKeypadRefId', keypadRefId);
      sessionStorage.setItem('QRPAY_nfilterPublicKey', publicKey);
      initNfilterKeypad(publicKey);
      console.error('[QRPAY_BRIDGE] 공개키를 가져오는데 실패했습니다:', error);
    }
  };

  // ─── 자동 초기화 ───────────────────────────────────────────────────────────
  _prefetchDevice();
  _fetchAndInitKeypad();

  // ─── Public API ────────────────────────────────────────────────────────────
  return {
    isAndroid,
    isIOS,
    isOther,
    getDeviceType,
    getDevice,
    qrShare,
    qrLoad,
    qrClear,
    goPlicyTreatment,
    getDecalCode,
    getTrnsData,
    linkExtraBrowser,
    getKeypadRefId,
    initNfilterKeypad,
    showNFilterKeypad,
    hideNFilterKeypad,
  };
})();
