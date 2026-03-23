const QrpayNfilterBridge = (() => {
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

  /**
   * 백엔드로부터 nFilter 공개키를 가져와 초기화하는 함수
   */
  const fetchAndInitKeypad = async () => {
    if (isOther()) {
      console.log('[QrpayNfilterBridge] Non-app environment detected. Skipping keypad initialization and using simulated data.');
      sessionStorage.setItem('nfilterKeypadRefId', 'test_ref_id');
      sessionStorage.setItem('nfilterPublicKey', 'test_public_key');
      return;
    }

    if (sessionStorage.getItem('nfilterPublicKey') && sessionStorage.getItem('nfilterKeypadRefId')) {
      console.log('[QrpayNfilterBridge] 세션에서 공개키와 키패드 참조 ID를 찾았습니다. 초기화 시작');
      QrpayNfilterBridge.initNfilterKeypad(sessionStorage.getItem('nfilterPublicKey'));
      return;
    }

    const API_URL = '/qrpay/external/nfilter/keypad/init';

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 백엔드 응답 구조에 따라 데이터 추출 (예: data.publicKey)
      const { publicKey, keypadRefId } = data;

      if (publicKey) {
        sessionStorage.setItem('nfilterKeypadRefId', keypadRefId);
        sessionStorage.setItem('nfilterPublicKey', publicKey);
        console.log('[QrpayNfilterBridge] 공개키 로드 성공 및 초기화 시작');
        QrpayNfilterBridge.initNfilterKeypad(publicKey);
      } else {
        console.error('[QrpayNfilterBridge] 응답에 공개키가 없습니다.');
      }
    } catch (error) {
      console.error('[QrpayNfilterBridge] 공개키를 가져오는데 실패했습니다:', error);
    }
  };

  const getKeypadRefId = () => {
    return sessionStorage.getItem('nfilterKeypadRefId');
  };

  // 라이브러리 로드 즉시 실행
  fetchAndInitKeypad();

  // 내부적으로 콜백을 보관할 객체
  const _callbackHandlers = {
    show: null,
    hide: null,
  };

  const _execute = ({ androidMethod, iosScheme, params, localCallback }) => {
    if (isAndroid()) {
      const values = Object.values(params || {}).filter((val) => val !== undefined && val !== null);
      console.log(...values);

      if (values.length > 0) {
        console.log(`Calling Android method: ${androidMethod} with params:`, values);
        window.android[androidMethod](...values);
      } else {
        console.log(`Calling Android method: ${androidMethod} with params:`, values);

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

  const initNfilterKeypad = (publicKey = 'MDIwGhMABBYCAXQCcgPD03i3Aapp4p46dZn2xUdDBBTgom5uUpwmpC0hhxWJi2jeT6jWEg==') => {
    _execute({
      androidMethod: 'nfilter',
      iosScheme: 'nfilter',
      params: { publicKey },
    });
  };

  /**
   *
   * @param {*} mode num | eng
   * @param {*} name fieldname
   * @param {*} len  글자 최대 길이
   * @param {*} desc title
   * @param {*} upYn 키패드 up/down 여부
   **/
  const showNFilterKeypad = (mode = 'num', name = 'qrpayKeypad', len, desc, upYn, callback) => {
    _callbackHandlers.show = callback;

    _execute({
      androidMethod: 'showNFilterKeypad',
      iosScheme: 'showNFilterKeypad',
      params: isIOS() ? { mode, name, len, desc, upYn } : { mode, name, len, desc },
    });
  };

  window.showNFilterKeypadCallBack = (encData, name, dummyData) => {
    console.log(`[QRPAY_BRIDGE] showNFilterKeypadCallBack called with encData: ${encData}, name: ${name}, dummyData: ${dummyData}`);
    if (typeof _callbackHandlers.show === 'function') {
      _callbackHandlers.show(encData, name, dummyData);
      // 일회성 콜백이라면 실행 후 초기화 (선택 사항)
      // _callbackHandlers.show = null;
    }
  };

  const hideNFilterKeypad = (callback) => {
    _execute({
      androidMethod: 'hideNFilterKeypad',
      iosScheme: 'hideNFilterKeypad',
      params: {},
      localCallback: callback,
    });
  };

  window.hideNFilterKeypadCallBack = () => {
    console.log('call : hideNFilterKeypadCallBack');
    if (typeof _callbackHandlers.hide === 'function') {
      _callbackHandlers.hide();
      // 일회성 콜백이라면 실행 후 초기화 (선택 사항)
      // _callbackHandlers.hide = null;
    }
  };
  window.closeNFilterKeypadCallBack = () => {
    console.log('call : closeNFilterKeypadCallBack');
  };
  // Public API
  return {
    getDeviceType,
    getKeypadRefId,
    showNFilterKeypad,
    hideNFilterKeypad,
  };
})();

// var loginType = '';
// nFilter CALLBACK (암호화값, 필드네임, 쓰레기값)
// function showNFilterKeypadCallBack(encData, name, dummyData) {
//   console.log(`[QRPAY_BRIDGE] showNFilterKeypadCallBack called with encData: ${encData}, name: ${name}, dummyData: ${dummyData}`);

//   if (window.location.href.indexOf('OauthLogin.api') == -1) {
//     var dumLength = dummyData.length;
//     if (name.indexOf('_RENEW_') == -1) {
//       $('#' + name.replace('_ENCRYPT', '')).css('background-image', "url('" + pwdImgArr2[dumLength].src + "')");
//     } else {
//       /* 이름에  _RENEW_가 있으면 신버전 UI 동작을 화면으로 넘김 */
//       if ($.isFunction(nFilterUiUpdate)) {
//         nFilterUiUpdate(name);
//       }
//     }
//   } else {
//     // simple login nfilter
//     if (loginType == '2') {
//       var dumLength = dummyData.length;
//       for (var i = 1; i <= 6; i++) {
//         if (dumLength > 0 && i <= dumLength) {
//           $('#' + name.replace('_ENCRYPT', '_' + i)).addClass('active');
//         } else {
//           $('#' + name.replace('_ENCRYPT', '_' + i)).removeClass('active');
//         }
//       }
//       if ($.isFunction(nFilterUiUpdate)) {
//         nFilterUiUpdate(name);
//       }
//     } else {
//       //신규 뱔견 특이 케이스  mainLogin%>
//       if ($.isFunction(nFilterUiUpdate)) {
//         nFilterUiUpdate(name);
//       }
//     }
//   }

//   if (dummyData.length == 6) {
//     hideNFilterKeypad();
//   }
// }

// hideNFilterKeypad 함수로 키보드를 닫았으면 폰에서 정상적으로 닫았다는 것을 알려 주는 함수
// function hideNFilterKeypadCallBack() {
//   // APP 에서 정상적으로 닫힌 경우
//   // 기본적으로 closeNFilterKeypadCallBack와 같은 동작을 수행하지만 스테이트 세팅값은 다름

//   console.log('call : hideNFilterKeypadCallBack');
//   try {
//     if (nFilterCloseState == 'CallHide') {
//       //닫힐떄 2번 불리는 현상이 있어서 중복 호출 방지용
//       if (window.location.href.indexOf('OauthLogin.api') > -1 && (typeof login).toUpperCase() == 'FUNCTION') {
//         setTimeout(function () {
//           login();
//         }, 100);
//       } else if (window.location.href.indexOf('MerInfoUpd.do') > -1) {
//         fnDone();
//       } else {
//         if ($.isFunction(nFilterClose)) {
//           nFilterClose();
//         }
//       }
//     }
//   } catch (e) {}
//   nFilterCloseState = 'DoneHide';
// }

// nFilter close CALLBACK
// function closeNFilterKeypadCallBack() {
//   console.log('call : closeNFilterKeypadCallBack');
//   try {
//     if (nFilterCloseState != 'DoneHide') {
//       //닫힐떄 2번 불리는 현상이 있어서 중복 호출 방지용
//       if (window.location.href.indexOf('OauthLogin.api') > -1 && (typeof login).toUpperCase() == 'FUNCTION') {
//         setTimeout(function () {
//           login();
//         }, 100);
//       } else if (window.location.href.indexOf('MerInfoUpd.do') > -1) {
//         fnDone();
//       } else {
//         if ($.isFunction(nFilterClose)) {
//           nFilterClose();
//         }
//       }
//     }
//   } catch (e) {}
//   nFilterCloseState = 'InitHide';
// }
