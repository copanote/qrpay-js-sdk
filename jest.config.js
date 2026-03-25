module.exports = {
  testEnvironment: 'jsdom',          // localStorage, fetch mock 지원
  setupFiles: ['./jest.setup.js'],   // PROFILE 전역 변수 주입
};
