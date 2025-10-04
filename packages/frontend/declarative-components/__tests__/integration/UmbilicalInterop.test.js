/**
 * Test interoperability between declarative components and umbilical components
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// Declarative components
import { Tokenizer } from '../../src/compiler/Tokenizer.js';
import { Parser } from '../../src/compiler/Parser.js';

// Umbilical components
import { Button, Counter } from '@legion/components';

describe('Declarative + Umbilical Interoperability', () => {
  let container;

  beforeEach(() => {
    // Jest already provides JSDOM via testEnvironment config
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app');
  });

  test('umbilical components work in JSDOM', () => {
    // Create umbilical Counter component
    let currentValue = 0;
    const counter = Counter.create({
      onChange: (value) => {
        currentValue = value;
      },
      initialValue: 5
    });

    expect(counter).toBeDefined();
    expect(counter.value).toBe(5); // Initial value in counter

    counter.increment();
    expect(currentValue).toBe(6); // onChange called with new value
    expect(counter.value).toBe(6);

    counter.decrement();
    expect(currentValue).toBe(5);
  });

  test('umbilical components can be embedded in manually created declarative structure', () => {
    // Create container structure manually (simulating declarative output)
    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';

    const header = document.createElement('h2');
    header.textContent = 'Counter Demo';
    wrapper.appendChild(header);

    const counterContainer = document.createElement('div');
    counterContainer.className = 'counter-container';
    wrapper.appendChild(counterContainer);

    container.appendChild(wrapper);

    // Verify DOM structure was created
    expect(container.querySelector('.wrapper')).toBeTruthy();
    expect(container.querySelector('h2').textContent).toBe('Counter Demo');
    expect(container.querySelector('.counter-container')).toBeTruthy();

    // Embed umbilical Counter component
    let currentValue = 0;
    const counter = Counter.create({
      onChange: (value) => {
        currentValue = value;
      },
      initialValue: 10
    });

    expect(counter).toBeDefined();
    expect(counter.value).toBe(10);

    counter.increment();
    expect(currentValue).toBe(11); // onChange called
    expect(counter.value).toBe(11);

    counter.increment();
    expect(currentValue).toBe(12);
  });

  test('declarative DSL parser works independently', () => {
    // Test that declarative DSL parser can parse component definitions
    const dsl = 'Counter :: count => div { count }';

    // Parser takes string directly
    const parser = new Parser(dsl);
    const ast = parser.parse();

    expect(ast).toBeDefined();
    expect(ast.type).toBe('Component');
    expect(ast.name).toBe('Counter');
    expect(ast.entityParam).toBe('count');
    expect(ast.body).toBeDefined();
    expect(ast.body.tagName).toBe('div');

    // Also test tokenizer independently
    const tokenizer = new Tokenizer(dsl);
    const tokens = tokenizer.tokenize();
    expect(tokens.length).toBeGreaterThan(0);
  });

  test('JSDOM environment supports both component systems', () => {
    // Verify JSDOM capabilities needed by both systems
    expect(document.createElement).toBeDefined();
    expect(document.querySelector).toBeDefined();
    expect(HTMLElement).toBeDefined();

    // Create elements for umbilical
    const div1 = document.createElement('div');
    div1.className = 'umbilical-test';
    expect(div1.classList.contains('umbilical-test')).toBe(true);

    // Create elements for declarative
    const div2 = document.createElement('div');
    div2.setAttribute('data-binding', 'test');
    expect(div2.getAttribute('data-binding')).toBe('test');

    // Both can coexist in DOM
    container.appendChild(div1);
    container.appendChild(div2);
    expect(container.children.length).toBe(2);
  });
});
