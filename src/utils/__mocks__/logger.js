/**
 * Manual mock for the Winston logger — prevents test output pollution.
 *
 * Jest automatically uses this mock because it lives in __mocks__/.
 * No per-test jest.mock() calls are needed when automocking is configured.
 */

/* eslint-env jest */

module.exports = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
};
