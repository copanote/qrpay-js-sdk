const childProcess = require('child_process');

module.exports = function banner() {
  const commit = childProcess.execSync('git rev-parse --short HEAD'); //커밋 해쉬
  const user = childProcess.execSync('git config user.name'); //빌드 유저 정보
  const date = new Date().toLocaleString();

  return `commitVersion: ${commit}` + `Build Date: ${date}\n` + `Author: ${user}`;
};
