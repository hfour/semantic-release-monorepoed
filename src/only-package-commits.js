const { identity, memoizeWith } = require('ramda');
const path = require('path');
const pLimit = require('p-limit');
const debug = require('debug')('semantic-release:monorepoed:get-commits');
const { getCommitFiles } = require('./git-utils');
const getPackagePath = require('./get-package-path');

const memoizedGetCommitFiles = memoizeWith(identity, getCommitFiles);

const withFiles = async commits => {
  const limit = pLimit(Number(process.env.SRM_MAX_THREADS) || 500);
  return Promise.all(
    commits.map(commit =>
      limit(async () => {
        const files = await memoizedGetCommitFiles(commit.hash);
        return { ...commit, files };
      }),
    ),
  );
};

module.exports = async commits => {
  const packagePath = await getPackagePath();
  debug('Filter commits by package path: "%s"', packagePath);
  const commitsWithFiles = await withFiles(commits);
  // Convert package root path into segments - one for each folder
  const packageSegments = packagePath.split(path.sep);

  return commitsWithFiles.filter(({ files, subject }) => {
    // Normalise paths and check if any changed files' path segments start
    // with that of the package root.
    const packageFile = files.find(file => {
      const fileSegments = path.normalize(file).split(path.sep);
      // Check the file is a *direct* descendent of the package folder (or the folder itself)
      return packageSegments.every((packageSegment, i) => packageSegment === fileSegments[i]);
    });

    if (packageFile) {
      debug('Including commit "%s" because it modified package file "%s".', subject, packageFile);
    }

    return !!packageFile;
  });
};
