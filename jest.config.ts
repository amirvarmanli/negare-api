import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  roots: [
    '<rootDir>/apps/api/src',
    '<rootDir>/apps/api/test',
    '<rootDir>/apps/api/src/tests',
  ],
  testMatch: [
    '<rootDir>/apps/api/src/**/*.spec.ts',
    '<rootDir>/apps/api/test/**/*.spec.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/apps/api/src/$1',
    '^@test/(.*)$': '<rootDir>/apps/api/test/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '<rootDir>/apps/api/src/**/*.(t|j)s',
    '!<rootDir>/apps/api/src/**/*.spec.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    './apps/api/src/core/upload/**/*.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },
  testEnvironment: 'node',
  verbose: false,
};

export default config;
