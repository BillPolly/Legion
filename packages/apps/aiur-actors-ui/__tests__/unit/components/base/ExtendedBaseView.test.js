/**
 * Tests for ExtendedBaseView with DOM operations
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('ExtendedBaseView', () => {
  let ExtendedBaseView;
  let view;
  let container;
  
  beforeEach(async () => {
    ({ ExtendedBaseView } = await import('../../../../src/components/base/ExtendedBaseView.js'));
    
    // Create DOM container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    view = new ExtendedBaseView(container);
  });
  
  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should initialize with DOM element', () => {
    expect(view.dom).toBe(container);
    expect(view.elements).toBeDefined();
    expect(view.destroyed).toBe(false);
  });

  test('should create element with classes', () => {
    const el = view.createElement('div', ['class1', 'class2']);
    
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('class1')).toBe(true);
    expect(el.classList.contains('class2')).toBe(true);
  });

  test('should create element with attributes', () => {
    const el = view.createElement('input', [], {
      type: 'text',
      placeholder: 'Enter text',
      'data-test': 'value'
    });
    
    expect(el.tagName).toBe('INPUT');
    expect(el.type).toBe('text');
    expect(el.placeholder).toBe('Enter text');
    expect(el.getAttribute('data-test')).toBe('value');
  });

  test('should query elements', () => {
    container.innerHTML = `
      <div class="test-class">Test 1</div>
      <div class="test-class">Test 2</div>
      <span id="test-id">Test 3</span>
    `;
    
    const byClass = view.query('.test-class');
    expect(byClass).toBeDefined();
    expect(byClass.textContent).toBe('Test 1');
    
    const byId = view.query('#test-id');
    expect(byId).toBeDefined();
    expect(byId.textContent).toBe('Test 3');
    
    const notFound = view.query('.not-exists');
    expect(notFound).toBeNull();
  });

  test('should query all elements', () => {
    container.innerHTML = `
      <div class="item">Item 1</div>
      <div class="item">Item 2</div>
      <div class="item">Item 3</div>
    `;
    
    const items = view.queryAll('.item');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('Item 1');
    expect(items[2].textContent).toBe('Item 3');
  });

  test('should add event listener with cleanup', () => {
    const button = document.createElement('button');
    container.appendChild(button);
    
    const handler = jest.fn();
    view.addEventListener(button, 'click', handler);
    
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
    
    // Cleanup should remove listener
    view.removeAllEventListeners();
    button.click();
    expect(handler).toHaveBeenCalledTimes(1); // Still 1
  });

  test('should show and hide elements', () => {
    const el = document.createElement('div');
    el.style.display = 'block';
    container.appendChild(el);
    
    view.hide(el);
    expect(el.style.display).toBe('none');
    
    view.show(el);
    expect(el.style.display).toBe('block');
    
    view.show(el, 'flex');
    expect(el.style.display).toBe('flex');
  });

  test('should toggle element visibility', () => {
    const el = document.createElement('div');
    el.style.display = 'block';
    container.appendChild(el);
    
    view.toggle(el);
    expect(el.style.display).toBe('none');
    
    view.toggle(el);
    expect(el.style.display).toBe('block');
  });

  test('should add and remove classes', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    
    view.addClass(el, 'active', 'highlight');
    expect(el.classList.contains('active')).toBe(true);
    expect(el.classList.contains('highlight')).toBe(true);
    
    view.removeClass(el, 'active');
    expect(el.classList.contains('active')).toBe(false);
    expect(el.classList.contains('highlight')).toBe(true);
  });

  test('should toggle classes', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    
    view.toggleClass(el, 'active');
    expect(el.classList.contains('active')).toBe(true);
    
    view.toggleClass(el, 'active');
    expect(el.classList.contains('active')).toBe(false);
  });

  test('should set element text safely', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    
    view.setText(el, '<script>alert("xss")</script>');
    expect(el.textContent).toBe('<script>alert("xss")</script>');
    expect(el.innerHTML).not.toContain('<script>');
  });

  test('should set element HTML', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    
    view.setHTML(el, '<span>Safe HTML</span>');
    expect(el.innerHTML).toBe('<span>Safe HTML</span>');
    expect(el.querySelector('span')).toBeDefined();
  });

  test('should handle input values', () => {
    const input = document.createElement('input');
    input.type = 'text';
    container.appendChild(input);
    
    view.setValue(input, 'test value');
    expect(input.value).toBe('test value');
    
    expect(view.getValue(input)).toBe('test value');
  });

  test('should focus and blur elements', () => {
    const input = document.createElement('input');
    container.appendChild(input);
    
    const focusSpy = jest.spyOn(input, 'focus');
    const blurSpy = jest.spyOn(input, 'blur');
    
    view.focus(input);
    expect(focusSpy).toHaveBeenCalled();
    
    view.blur(input);
    expect(blurSpy).toHaveBeenCalled();
  });

  test('should scroll element into view', () => {
    const el = document.createElement('div');
    container.appendChild(el);
    
    // Mock scrollIntoView since it doesn't exist in jsdom
    el.scrollIntoView = jest.fn();
    
    view.scrollIntoView(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    
    view.scrollIntoView(el, { block: 'center' });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  test('should clean up on destroy', () => {
    const button = document.createElement('button');
    container.appendChild(button);
    
    const handler = jest.fn();
    view.addEventListener(button, 'click', handler);
    
    view.destroy();
    
    expect(view.destroyed).toBe(true);
    expect(view.eventListeners.length).toBe(0);
    
    // Listeners should be removed
    button.click();
    expect(handler).not.toHaveBeenCalled();
  });

  test('should render template', () => {
    const template = `
      <div class="header">{{title}}</div>
      <div class="content">{{content}}</div>
    `;
    
    const data = {
      title: 'Test Title',
      content: 'Test Content'
    };
    
    const html = view.renderTemplate(template, data);
    
    expect(html).toContain('Test Title');
    expect(html).toContain('Test Content');
    expect(html).not.toContain('{{');
  });
});