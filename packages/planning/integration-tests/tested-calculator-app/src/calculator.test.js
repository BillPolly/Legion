const Calculator = require('./calculator');

describe('Calculator', () => {
  let calc;

  beforeEach(() => {
    calc = new Calculator();
  });

  test('adds two numbers', () => {
    expect(calc.add(2, 3)).toBe(5);
  });

  test('subtracts two numbers', () => {
    expect(calc.subtract(5, 2)).toBe(3);
  });

  test('multiplies two numbers', () => {
    expect(calc.multiply(4, 3)).toBe(12);
  });

  test('divides two numbers', () => {
    expect(calc.divide(6, 2)).toBe(3);
  });

  test('throws on division by zero', () => {
    expect(() => calc.divide(5, 0)).toThrow('Division by zero');
  });
});