const QRPAY_STORAGE = () => {
  const STORAGE_KEY_PREFIX = 'QRPAY_'; // 키 충돌방지 prefix
  const createKey = (key) => `${STORAGE_KEY_PREFIX}${key}`;

  const save = (key, value) => {
    const skey = createKey(key);
    try {
      localStorage.setItem(skey, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
    return false;
  };

  const find = (key) => {
    const skey = createKey(key);
    try {
      const item = localStorage.getItem(skey);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Error reading from localStorage', e);
    }
    return null;
  };

  const remove = (key) => {
    const skey = createKey(key);
    try {
      localStorage.removeItem(skey);
      return true;
    } catch (e) {
      console.error('Error removing from localStorage', e);
    }
    return false;
  };

  const clearAll = () => {
    try {
      localStorage.clear();
      // Object.keys(localStorage).forEach((key) => {
      //   if (key.startsWith(STORAGE_KEY_PREFIX)) {
      //     localStorage.removeItem(key);
      //   }
      // });
      return true;
    } catch (e) {
      console.error('Error clearing localStorage', e);
    }
    return false;
  };

  const publicAPI = {
    save: save,
    find: find,
    remove: remove,
    clearAll: clearAll,
  };

  return publicAPI;
};

export default QRPAY_STORAGE;
