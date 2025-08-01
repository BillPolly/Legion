/**
 * @jest-environment jsdom
 */

import { greet, add, multiply } from '../src/utils.js';

describe('Utils functions', () => {
    test('greet should return a greeting message', () => {
        expect(greet('World')).toBe('Hello, World!');
        expect(greet('Jest')).toBe('Hello, Jest!');
    });

    test('add should return the sum of two numbers', () => {
        expect(add(2, 3)).toBe(5);
        expect(add(-1, 1)).toBe(0);
        expect(add(0, 0)).toBe(0);
    });

    test('multiply should return the product of two numbers', () => {
        expect(multiply(2, 3)).toBe(6);
        expect(multiply(-1, 5)).toBe(-5);
        expect(multiply(0, 10)).toBe(0);
    });
});