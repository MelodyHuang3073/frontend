module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/e2e/integration/**/*.spec.ts'],
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.js'], // Optional, for global timeouts or setup
};
