const { pathsToModuleNameMapper } = require('ts-jest/utils')
const { compilerOptions } = require('../tsconfig.json')

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../',
  }),
  setupFiles: ['jest-date-mock', './setup/clear-all-data.js'],
  setupFilesAfterEnv: ['jest-extended'],
  globalSetup: './setup/setup-test-schema.js',
  testTimeout: 10000,
}
