const pkgUp = require('pkg-up');
const path = require('path');
const { getRoot } = require('./git-utils');

module.exports = async () => {
  const packagePath = await pkgUp();
  const gitRoot = await getRoot();

  return path.relative(gitRoot, path.resolve(packagePath, '..'));
};
