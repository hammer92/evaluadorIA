module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'perf', 'ci', 'build', 'style',
    ]],
    'scope-enum': [1, 'always', [
      'web', 'functions', 'shared', 'auth', 'users', 'orgs', 'audit', 'reports',
      'templates', 'tooling', 'ci', 'docs', 'deps', 'aidlc',
    ]],
  },
};