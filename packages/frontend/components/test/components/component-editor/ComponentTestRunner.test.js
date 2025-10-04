/**
 * ComponentTestRunner Tests - Phase 7.3
 *
 * Tests for component test execution and assertion validation
 */

import { ComponentTestRunner } from '../../../src/components/component-editor/src/testing/ComponentTestRunner.js';

// Mock ComponentLifecycle for testing
class MockComponentLifecycle {
  async mount(dsl, container, data) {
    // Simulate component rendering based on DSL
    if (dsl.includes('user.name')) {
      const h2 = document.createElement('h2');
      h2.className = 'name';
      h2.textContent = data.name || '';
      container.appendChild(h2);
    }

    if (dsl.includes('user.avatar')) {
      const img = document.createElement('img');
      img.className = 'avatar';
      img.src = data.avatar || '';
      container.appendChild(img);
    }

    if (dsl.includes('profile-card')) {
      const div = document.createElement('div');
      div.className = 'profile-card active';
      container.appendChild(div);
    }

    return {
      unmount: async () => {
        container.innerHTML = '';
      }
    };
  }
}

describe('ComponentTestRunner - Phase 7.3', () => {
  let runner;
  let lifecycle;

  beforeEach(() => {
    lifecycle = new MockComponentLifecycle();
    runner = new ComponentTestRunner(lifecycle);
  });

  describe('constructor', () => {
    test('should create runner with lifecycle', () => {
      expect(runner).toBeDefined();
      expect(runner.lifecycle).toBe(lifecycle);
    });

    test('should throw if lifecycle not provided', () => {
      expect(() => new ComponentTestRunner()).toThrow();
    });
  });

  describe('getPropertyValue()', () => {
    test('should get simple property value', () => {
      const element = document.createElement('div');
      element.textContent = 'Hello';

      const value = runner.getPropertyValue(element, 'textContent');
      expect(value).toBe('Hello');
    });

    test('should get nested property value', () => {
      const element = document.createElement('div');
      element.style.color = 'red';

      const value = runner.getPropertyValue(element, 'style.color');
      expect(value).toBe('red');
    });

    test('should get classList property', () => {
      const element = document.createElement('div');
      element.className = 'card active';

      const value = runner.getPropertyValue(element, 'classList');
      expect(value).toContain('card');
      expect(value).toContain('active');
    });

    test('should handle deeply nested properties', () => {
      const element = document.createElement('div');
      element.dataset.user = JSON.stringify({ name: 'Test' });

      const value = runner.getPropertyValue(element, 'dataset.user');
      expect(value).toBe('{"name":"Test"}');
    });
  });

  describe('compareValues()', () => {
    test('should compare with equals operator', () => {
      expect(runner.compareValues('hello', 'hello', 'equals')).toBe(true);
      expect(runner.compareValues('hello', 'world', 'equals')).toBe(false);
      expect(runner.compareValues(5, 5, 'equals')).toBe(true);
      expect(runner.compareValues(5, '5', 'equals')).toBe(false);
    });

    test('should compare with contains operator', () => {
      expect(runner.compareValues('hello world', 'world', 'contains')).toBe(true);
      expect(runner.compareValues('hello world', 'xyz', 'contains')).toBe(false);
    });

    test('should compare with matches operator', () => {
      expect(runner.compareValues('hello123', '\\d+', 'matches')).toBe(true);
      expect(runner.compareValues('hello', '\\d+', 'matches')).toBe(false);
      expect(runner.compareValues('test@email.com', '.+@.+\\..+', 'matches')).toBe(true);
    });

    test('should compare with greaterThan operator', () => {
      expect(runner.compareValues(10, 5, 'greaterThan')).toBe(true);
      expect(runner.compareValues(5, 10, 'greaterThan')).toBe(false);
      expect(runner.compareValues(5, 5, 'greaterThan')).toBe(false);
    });

    test('should compare with lessThan operator', () => {
      expect(runner.compareValues(5, 10, 'lessThan')).toBe(true);
      expect(runner.compareValues(10, 5, 'lessThan')).toBe(false);
      expect(runner.compareValues(5, 5, 'lessThan')).toBe(false);
    });

    test('should return false for unknown operator', () => {
      expect(runner.compareValues('a', 'b', 'unknown')).toBe(false);
    });
  });

  describe('runAssertion()', () => {
    test('should pass assertion when element matches', () => {
      const container = document.createElement('div');
      const h2 = document.createElement('h2');
      h2.textContent = 'Test User';
      container.appendChild(h2);

      const assertion = {
        selector: 'h2',
        property: 'textContent',
        operator: 'equals',
        expected: 'Test User'
      };

      const result = runner.runAssertion(container, assertion);
      expect(result.passed).toBe(true);
      expect(result.actual).toBe('Test User');
      expect(result.expected).toBe('Test User');
      expect(result.message).toContain('✓');
    });

    test('should fail assertion when value does not match', () => {
      const container = document.createElement('div');
      const h2 = document.createElement('h2');
      h2.textContent = 'Wrong Value';
      container.appendChild(h2);

      const assertion = {
        selector: 'h2',
        property: 'textContent',
        operator: 'equals',
        expected: 'Test User'
      };

      const result = runner.runAssertion(container, assertion);
      expect(result.passed).toBe(false);
      expect(result.actual).toBe('Wrong Value');
      expect(result.expected).toBe('Test User');
      expect(result.message).toContain('✗');
      expect(result.message).toContain('Expected Test User, got Wrong Value');
    });

    test('should fail assertion when element not found', () => {
      const container = document.createElement('div');

      const assertion = {
        selector: '.missing',
        property: 'textContent',
        operator: 'equals',
        expected: 'Test'
      };

      const result = runner.runAssertion(container, assertion);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Element not found: .missing');
    });

    test('should handle contains operator', () => {
      const container = document.createElement('div');
      const div = document.createElement('div');
      div.className = 'card active';
      container.appendChild(div);

      const assertion = {
        selector: 'div',
        property: 'className',
        operator: 'contains',
        expected: 'active'
      };

      const result = runner.runAssertion(container, assertion);
      expect(result.passed).toBe(true);
    });

    test('should handle nested property assertion', () => {
      const container = document.createElement('div');
      const div = document.createElement('div');
      div.style.color = 'red';
      container.appendChild(div);

      const assertion = {
        selector: 'div',
        property: 'style.color',
        operator: 'equals',
        expected: 'red'
      };

      const result = runner.runAssertion(container, assertion);
      expect(result.passed).toBe(true);
    });
  });

  describe('runTest()', () => {
    test('should run test with passing assertions', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } }';
      const test = {
        name: 'should display user name',
        data: { name: 'Test User' },
        assertions: [
          {
            selector: 'h2.name',
            property: 'textContent',
            operator: 'equals',
            expected: 'Test User'
          }
        ]
      };

      const result = await runner.runTest(dsl, test);
      expect(result.name).toBe('should display user name');
      expect(result.passed).toBe(true);
      expect(result.assertions).toHaveLength(1);
      expect(result.assertions[0].passed).toBe(true);
      expect(result.message).toBe('All assertions passed');
    });

    test('should run test with failing assertions', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } }';
      const test = {
        name: 'should display user name',
        data: { name: 'Test User' },
        assertions: [
          {
            selector: 'h2.name',
            property: 'textContent',
            operator: 'equals',
            expected: 'Wrong Name'
          }
        ]
      };

      const result = await runner.runTest(dsl, test);
      expect(result.name).toBe('should display user name');
      expect(result.passed).toBe(false);
      expect(result.assertions).toHaveLength(1);
      expect(result.assertions[0].passed).toBe(false);
      expect(result.message).toBe('Some assertions failed');
    });

    test('should run test with multiple assertions', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } img.avatar[src=user.avatar] }';
      const test = {
        name: 'should display user card',
        data: {
          name: 'Test User',
          avatar: 'https://example.com/avatar.jpg'
        },
        assertions: [
          {
            selector: 'h2.name',
            property: 'textContent',
            operator: 'equals',
            expected: 'Test User'
          },
          {
            selector: 'img.avatar',
            property: 'src',
            operator: 'equals',
            expected: 'https://example.com/avatar.jpg'
          }
        ]
      };

      const result = await runner.runTest(dsl, test);
      expect(result.passed).toBe(true);
      expect(result.assertions).toHaveLength(2);
      expect(result.assertions.every(a => a.passed)).toBe(true);
    });

    test('should cleanup container after test', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } }';
      const test = {
        name: 'cleanup test',
        data: { name: 'Test' },
        assertions: [
          {
            selector: 'h2.name',
            property: 'textContent',
            operator: 'equals',
            expected: 'Test'
          }
        ]
      };

      const initialChildren = document.body.children.length;
      await runner.runTest(dsl, test);
      const finalChildren = document.body.children.length;

      expect(finalChildren).toBe(initialChildren);
    });

    test('should handle test execution errors', async () => {
      // Mock lifecycle that throws error
      runner.lifecycle = {
        mount: async () => {
          throw new Error('Mount failed');
        }
      };

      const dsl = 'Bad :: s => div';
      const test = {
        name: 'failing test',
        data: {},
        assertions: []
      };

      const result = await runner.runTest(dsl, test);
      expect(result.name).toBe('failing test');
      expect(result.passed).toBe(false);
      expect(result.error).toBe('Mount failed');
      expect(result.message).toContain('Test failed: Mount failed');
    });

    test('should cleanup on error', async () => {
      runner.lifecycle = {
        mount: async () => {
          throw new Error('Mount failed');
        }
      };

      const initialChildren = document.body.children.length;
      await runner.runTest('Bad :: s => div', { name: 'test', data: {}, assertions: [] });
      const finalChildren = document.body.children.length;

      expect(finalChildren).toBe(initialChildren);
    });
  });

  describe('runTests()', () => {
    test('should run multiple tests and return results', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } }';
      const tests = [
        {
          name: 'test 1',
          data: { name: 'User 1' },
          assertions: [
            {
              selector: 'h2.name',
              property: 'textContent',
              operator: 'equals',
              expected: 'User 1'
            }
          ]
        },
        {
          name: 'test 2',
          data: { name: 'User 2' },
          assertions: [
            {
              selector: 'h2.name',
              property: 'textContent',
              operator: 'equals',
              expected: 'User 2'
            }
          ]
        }
      ];

      const results = await runner.runTests(dsl, tests);
      expect(results.total).toBe(2);
      expect(results.passed).toBe(2);
      expect(results.failed).toBe(0);
      expect(results.tests).toHaveLength(2);
      expect(results.tests[0].passed).toBe(true);
      expect(results.tests[1].passed).toBe(true);
    });

    test('should track passed and failed tests', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } }';
      const tests = [
        {
          name: 'passing test',
          data: { name: 'Test' },
          assertions: [
            {
              selector: 'h2.name',
              property: 'textContent',
              operator: 'equals',
              expected: 'Test'
            }
          ]
        },
        {
          name: 'failing test',
          data: { name: 'Test' },
          assertions: [
            {
              selector: 'h2.name',
              property: 'textContent',
              operator: 'equals',
              expected: 'Wrong'
            }
          ]
        }
      ];

      const results = await runner.runTests(dsl, tests);
      expect(results.total).toBe(2);
      expect(results.passed).toBe(1);
      expect(results.failed).toBe(1);
    });

    test('should handle empty test array', async () => {
      const dsl = 'Test :: s => div';
      const tests = [];

      const results = await runner.runTests(dsl, tests);
      expect(results.total).toBe(0);
      expect(results.passed).toBe(0);
      expect(results.failed).toBe(0);
      expect(results.tests).toEqual([]);
    });

    test('should run all tests even if some fail', async () => {
      const dsl = 'UserCard :: user => div { h2.name { user.name } }';
      const tests = [
        {
          name: 'test 1',
          data: { name: 'Test' },
          assertions: [
            {
              selector: '.missing',
              property: 'textContent',
              operator: 'equals',
              expected: 'Test'
            }
          ]
        },
        {
          name: 'test 2',
          data: { name: 'Test' },
          assertions: [
            {
              selector: 'h2.name',
              property: 'textContent',
              operator: 'equals',
              expected: 'Test'
            }
          ]
        }
      ];

      const results = await runner.runTests(dsl, tests);
      expect(results.tests).toHaveLength(2);
      expect(results.tests[0].passed).toBe(false);
      expect(results.tests[1].passed).toBe(true);
    });
  });

  describe('Integration', () => {
    test('should run complete test suite', async () => {
      // Use custom lifecycle for this test to simulate proper nesting
      const customLifecycle = {
        async mount(dsl, container, data) {
          const profileCard = document.createElement('div');
          profileCard.className = 'profile-card';

          const h2 = document.createElement('h2');
          h2.className = 'name';
          h2.textContent = data.name;

          const img = document.createElement('img');
          img.className = 'avatar';
          img.src = data.avatar;

          profileCard.appendChild(h2);
          profileCard.appendChild(img);
          container.appendChild(profileCard);

          return {
            unmount: async () => {
              container.innerHTML = '';
            }
          };
        }
      };

      const customRunner = new ComponentTestRunner(customLifecycle);

      const dsl = 'ProfileCard :: user => div.profile-card { h2.name { user.name } img.avatar[src=user.avatar] }';
      const tests = [
        {
          name: 'should display user profile',
          description: 'Verify profile card renders correctly',
          data: {
            name: 'John Doe',
            avatar: 'https://example.com/john.jpg'
          },
          assertions: [
            {
              selector: 'h2.name',
              property: 'textContent',
              operator: 'equals',
              expected: 'John Doe'
            },
            {
              selector: 'img.avatar',
              property: 'src',
              operator: 'equals',
              expected: 'https://example.com/john.jpg'
            },
            {
              selector: '.profile-card',
              property: 'classList',
              operator: 'contains',
              expected: 'profile-card'
            }
          ]
        }
      ];

      const results = await customRunner.runTests(dsl, tests);

      expect(results.total).toBe(1);
      expect(results.passed).toBe(1);
      expect(results.failed).toBe(0);
      expect(results.tests[0].assertions).toHaveLength(3);
      expect(results.tests[0].assertions.every(a => a.passed)).toBe(true);
    });
  });
});
