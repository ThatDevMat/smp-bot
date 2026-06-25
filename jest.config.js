/**
 * Jest configuration.
 *
 * - Environment: node (no jsdom needed)
 * - Coverage thresholds: 80% across all categories
 * - Excluded from coverage: entry-point files that only wire up deps
 * - Setup file provides shared test factories and utilities
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  clearMocks: true,
  moduleNameMapper: {
    '^(\\.\\./)+utils/logger$': '<rootDir>/src/utils/__mocks__/logger.js',
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/events/**',
    '!src/config.js',
    '!src/webhooks/discordsrv.js',
    '!deploy-commands.js',
  ],
  coverageDirectory: 'coverage/',
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
