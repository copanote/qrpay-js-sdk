import QRPAY_SDK from './qrpay_sdk';
import QRPAY_STORAGE from './qrpay_storage';
const qrpay_sdk = QRPAY_SDK();
const qrpay_Storage = QRPAY_STORAGE();

export { qrpay_sdk as qrpaySdk, qrpay_Storage as qrpayStorage };
