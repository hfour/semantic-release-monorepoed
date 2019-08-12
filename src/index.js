const mock = require('mock-require');

// mocking of the following file is neccessary to filter the commits which change only the package from where this file is run
mock('semantic-release/lib/get-commits', './get-commits');

// mocking of the following file is neccessary to add a package title in the Github release notes
mock('@semantic-release/release-notes-generator', './release-notes-generator');

// run the next semantic release binary
return require('semantic-release/bin/semantic-release');
