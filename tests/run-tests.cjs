// Simple test runner for comprehensive site tests
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  test(name, testFn) {
    this.tests.push({ name, testFn });
  }
  
  describe(name, fn) {
    console.log(`\n📋 ${name}`);
    fn();
  }
  
  async run() {
    console.log('🧪 Running Comprehensive Site Tests\n');
    
    for (const { name, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`   ✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`   ❌ ${name}`);
        console.log(`      ${error.message}`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      console.log('🎉 Site is ready for deployment!');
    }
  }
  
  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      toBeGreaterThanOrEqual: (expected) => {
        if (actual < expected) {
          throw new Error(`Expected ${actual} to be >= ${expected}`);
        }
      },
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      toContain: (expected) => {
        if (!actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
      },
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected falsy value, got ${actual}`);
        }
      }
    };
  }
}

// Create test runner instance
const runner = new TestRunner();

// Import tests
require('./site-comprehensive.test.cjs')(runner);

// Run tests
runner.run().catch(console.error);
