import { jest } from '@jest/globals';

describe('Basic Frontend Tests', () => {
  test('Jest is working correctly', () => {
    expect(2 + 2).toBe(4);
  });

  test('DOM is available in test environment', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello World';
    expect(div.textContent).toBe('Hello World');
  });

  test('Event listeners work in test environment', () => {
    const button = document.createElement('button');
    const clickHandler = jest.fn();
    
    button.addEventListener('click', clickHandler);
    button.click();
    
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  test('CSS classes can be manipulated', () => {
    const element = document.createElement('div');
    
    element.classList.add('test-class');
    expect(element.classList.contains('test-class')).toBe(true);
    
    element.classList.remove('test-class');
    expect(element.classList.contains('test-class')).toBe(false);
  });

  test('JSON parsing works correctly', () => {
    const data = { message: 'Hello', type: 'user' };
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);
    
    expect(parsed).toEqual(data);
  });
});