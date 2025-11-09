# Test Suite

This directory contains comprehensive tests for the Julie Camus portfolio site.

## Running Tests

### Comprehensive Site Tests
```bash
npm run test:comprehensive
```

This runs all critical tests to ensure the site is ready for deployment:

1. **Manifest Files** - Verifies at least 15 folders have valid manifests with proper titles
2. **Preview Files** - Checks all 10 folders have preview files (no placeholders)
3. **Supabase Removal** - Ensures no Supabase references exist in the codebase
4. **Local Server** - Verifies the local dev server is running on port 8080
5. **Responsive Design** - Checks viewport meta tag is present

## Test Structure

- `run-tests.cjs` - Simple test runner
- `site-comprehensive.test.cjs` - Comprehensive site tests
- `README.md` - This file

## Adding New Tests

To add new tests:

1. Create a new test file in this directory with `.cjs` extension
2. Export a function that takes the runner instance
3. Use `runner.test()` for individual tests and `runner.describe()` for grouping
4. Import the test file in `run-tests.cjs`

Example:
```javascript
module.exports = (runner) => {
  runner.describe('New Feature Tests', () => {
    runner.test('Something works', () => {
      runner.expect(something).toBe(true);
    });
  });
};
```

## Continuous Integration

These tests should be run before any deployment to ensure:
- All tiles show proper titles on hover (desktop) or automatically (touch devices)
- Preview files are displayed, not placeholders
- No external dependencies (Supabase) are being used
- The site works on all device types
