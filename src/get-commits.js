const gitLogParser = require('git-log-parser');
const getStream = require('get-stream');
const debug = require('debug')('semantic-release:monorepoed:get-commits');

const readPkg = require('read-pkg');
const onlyPackageCommits = require('./only-package-commits');

/**
 * Retrieve the list of commits on the current branch since the commit sha associated with the last release, or all the commits of the current branch if there is no last released version.
 *
 * @param {Object} context semantic-release context.
 *
 * @return {Promise<Array<Object>>} The list of commits on the branch `branch` since the last release.
 */
module.exports = async ({ cwd, env, lastRelease: { gitHead }, logger }) => {
  console.log('fake');
  if (gitHead) {
    debug('Use gitHead: %s', gitHead);
  } else {
    logger.log('No previous release found, retrieving all commits');
  }

  Object.assign(gitLogParser.fields, {
    hash: 'H',
    message: 'B',
    gitTags: 'd',
    committerDate: { key: 'ci', type: Date },
  });
  const commits = (await getStream
    .array(
      gitLogParser.parse(
        { _: `${gitHead ? gitHead + '..' : ''}HEAD` },
        { cwd, env: { ...process.env, ...env } },
      ),
    )
    .then(commits => onlyPackageCommits(commits))) // this line is different from the original implementation
    .map(commit => {
      commit.message = commit.message.trim();
      commit.gitTags = commit.gitTags.trim();
      return commit;
    });

  const { name } = await readPkg();

  logger.log('Found %s commits for package %s since last release', commits.length, name);
  debug('Parsed commits: %o', commits);
  return commits;
};
