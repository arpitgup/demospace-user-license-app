module.exports = {
  preset: "jest-preset-angular",
  setupFilesAfterEnv: [],
  transform: {
    "^.+\\.(ts|js|html)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.spec.json",
        stringifyContentPathRegex: "\\.html$",
      },
    ],
  },
  moduleFileExtensions: ["ts", "html", "js", "json", "mjs"],
  roots: ["<rootDir>/src/"],
  moduleNameMapper: {
    "@app/(.*)": "<rootDir>/src/app/$1",
    "@assets/(.*)": "<rootDir>/src/assets/$1",
    "@core/(.*)": "<rootDir>/src/app/core/$1",
    "@env/(.*)": "<rootDir>/src/environments/$1",
  },
  coverageDirectory: "coverage",
  collectCoverage: true,
  coverageReporters: ["html", "lcov", "text"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.spec.ts",
    "!src/main.ts",
    "!src/polyfills.ts",
    "!src/environments/*.ts",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/src/environments/",

    // File types and patterns
    "\\.module\\.ts$",
    "\\.mock\\.ts$",
    "\\.constants\\.ts$",
    "-routing\\.module\\.ts$",
    "main\\.ts$",
    "polyfills\\.ts$",
    "index\\.ts$",
    '\\.server\\.ts$',
    'server.ts',
  ],
};
