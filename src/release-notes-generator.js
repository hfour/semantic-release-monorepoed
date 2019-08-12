const { URL, format } = require('url');
const { find, merge } = require('lodash');
const getStream = require('get-stream');
const intoStream = require('into-stream');
const parser = require('conventional-commits-parser').sync;
const writer = require('conventional-changelog-writer');
const filter = require('conventional-commits-filter');
const readPkgUp = require('read-pkg-up');
const debug = require('debug')('semantic-release:monorepoed:release-notes-generator');
const loadChangelogConfig = require('@semantic-release/release-notes-generator/lib/load-changelog-config');
const HOSTS_CONFIG = require('@semantic-release/release-notes-generator/lib/hosts-config');
const readPkg = require('read-pkg');

/**
 * Generate the changelog for all the commits in `options.commits`.
 *
 * @param {Object} pluginConfig The plugin configuration.
 * @param {String} pluginConfig.preset conventional-changelog preset ('angular', 'atom', 'codemirror', 'ember', 'eslint', 'express', 'jquery', 'jscs', 'jshint').
 * @param {String} pluginConfig.config Requierable npm package with a custom conventional-changelog preset
 * @param {Object} pluginConfig.parserOpts Additional `conventional-changelog-parser` options that will overwrite ones loaded by `preset` or `config`.
 * @param {Object} pluginConfig.writerOpts Additional `conventional-changelog-writer` options that will overwrite ones loaded by `preset` or `config`.
 * @param {Object} context The semantic-release context.
 * @param {Array<Object>} context.commits The commits to analyze.
 * @param {Object} context.lastRelease The last release with `gitHead` corresponding to the commit hash used to make the last release and `gitTag` corresponding to the git tag associated with `gitHead`.
 * @param {Object} context.nextRelease The next release with `gitHead` corresponding to the commit hash used to make the  release, the release `version` and `gitTag` corresponding to the git tag associated with `gitHead`.
 * @param {Object} context.options.repositoryUrl The git repository URL.
 *
 * @returns {String} The changelog for all the commits in `context.commits`.
 */
async function generateNotes(pluginConfig, context) {
  const { commits, lastRelease, nextRelease, options, cwd } = context;
  const repositoryUrl = options.repositoryUrl.replace(/\.git$/i, '');
  const { parserOpts, writerOpts } = await loadChangelogConfig(pluginConfig, context);

  const [match, auth, host, path] = /^(?!.+:\/\/)(?:(.*)@)?(.*?):(.*)$/.exec(repositoryUrl) || [];
  let { hostname, port, pathname, protocol } = new URL(
    match ? `ssh://${auth ? `${auth}@` : ''}${host}/${path}` : repositoryUrl,
  );
  protocol = protocol && /http[^s]/.test(protocol) ? 'http' : 'https';
  const [, owner, repository] = /^\/([^/]+)?\/?(.+)?$/.exec(pathname);

  const { issue, commit, referenceActions, issuePrefixes } =
    find(HOSTS_CONFIG, conf => conf.hostname === hostname) || HOSTS_CONFIG.default;
  const parsedCommits = filter(
    commits.map(rawCommit => ({
      ...rawCommit,
      ...parser(rawCommit.message, { referenceActions, issuePrefixes, ...parserOpts }),
    })),
  );
  const previousTag = lastRelease.gitTag || lastRelease.gitHead;
  const currentTag = nextRelease.gitTag || nextRelease.gitHead;
  const {
    host: hostConfig,
    linkCompare,
    linkReferences,
    commit: commitConfig,
    issue: issueConfig,
  } = pluginConfig;

  const { name } = await readPkg(); // this line is different from the original implementation

  const changelogContext = merge(
    {
      version: nextRelease.version,
      host: format({ protocol, hostname, port }),
      title: name, // this line is different from the original implementation
      owner,
      repository,
      previousTag,
      currentTag,
      linkCompare: currentTag && previousTag,
      issue,
      commit,
      packageData: ((await readPkgUp({ normalize: false, cwd })) || {}).package,
    },
    { host: hostConfig, linkCompare, linkReferences, commit: commitConfig, issue: issueConfig },
  );

  debug('version: %o', changelogContext.version);
  debug('host: %o', changelogContext.hostname);
  debug('title: %o', changelogContext.title); // this line is different from the original implementation
  debug('owner: %o', changelogContext.owner);
  debug('repository: %o', changelogContext.repository);
  debug('previousTag: %o', changelogContext.previousTag);
  debug('currentTag: %o', changelogContext.currentTag);
  debug('host: %o', changelogContext.host);
  debug('host: %o', changelogContext.host);
  debug('linkReferences: %o', changelogContext.linkReferences);
  debug('issue: %o', changelogContext.issue);
  debug('commit: %o', changelogContext.commit);

  return getStream(intoStream.object(parsedCommits).pipe(writer(changelogContext, writerOpts)));
}

module.exports = { generateNotes };