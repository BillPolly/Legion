/**
 * DOM testing helpers for jsdom
 */

/**
 * Query selector with better error messages
 */
export function querySelector(container, selector) {
  const element = container.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Query all matching elements
 */
export function querySelectorAll(container, selector) {
  return Array.from(container.querySelectorAll(selector));
}

/**
 * Simulate a click event
 */
export function click(element) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(event);
}

/**
 * Simulate typing in an input
 */
export function type(element, text) {
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate selecting an option in a select element
 */
export function selectOption(selectElement, value) {
  selectElement.value = value;
  selectElement.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Wait for an element to appear
 */
export async function waitForElement(container, selector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = container.querySelector(selector);
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  throw new Error(`Timeout waiting for element: ${selector}`);
}

/**
 * Wait for element to have specific text content
 */
export async function waitForText(element, text, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (element.textContent.includes(text)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  throw new Error(`Timeout waiting for text: ${text}`);
}

/**
 * Get all text content from an element
 */
export function getText(element) {
  return element.textContent.trim();
}

/**
 * Check if element is visible
 */
export function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0';
}

/**
 * Check if element has a class
 */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/**
 * Trigger a keyboard event
 */
export function keyPress(element, key, options = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  });
  element.dispatchEvent(event);
}

/**
 * Simulate drag and drop
 */
export function dragAndDrop(dragElement, dropTarget) {
  // Start drag
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  dragElement.dispatchEvent(dragStartEvent);
  
  // Drag over
  const dragOverEvent = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer
  });
  dropTarget.dispatchEvent(dragOverEvent);
  
  // Drop
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer
  });
  dropTarget.dispatchEvent(dropEvent);
  
  // End drag
  const dragEndEvent = new DragEvent('dragend', {
    bubbles: true,
    cancelable: true
  });
  dragElement.dispatchEvent(dragEndEvent);
}

/**
 * Get computed style property
 */
export function getStyle(element, property) {
  return window.getComputedStyle(element).getPropertyValue(property);
}

/**
 * Wait for async updates to complete
 */
export async function waitForUpdates() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * Create a container element for testing
 */
export function createTestContainer() {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
}

/**
 * Clean up test container
 */
export function cleanupTestContainer() {
  const container = document.getElementById('test-container');
  if (container) {
    container.remove();
  }
}

/**
 * Simulate scroll event
 */
export function scroll(element, { top = 0, left = 0 }) {
  element.scrollTop = top;
  element.scrollLeft = left;
  element.dispatchEvent(new Event('scroll', { bubbles: true }));
}

/**
 * Get all form values
 */
export function getFormValues(formElement) {
  const values = {};
  const inputs = formElement.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => {
    const name = input.name || input.id;
    if (name) {
      if (input.type === 'checkbox') {
        values[name] = input.checked;
      } else if (input.type === 'radio') {
        if (input.checked) {
          values[name] = input.value;
        }
      } else {
        values[name] = input.value;
      }
    }
  });
  
  return values;
}

/**
 * Debug helper to print element tree
 */
export function debugElement(element, depth = 0) {
  const indent = '  '.repeat(depth);
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
  const text = element.childNodes.length === 1 && element.childNodes[0].nodeType === 3
    ? ` "${element.textContent.trim().substring(0, 20)}..."`
    : '';
  
  console.log(`${indent}${tag}${id}${classes}${text}`);
  
  Array.from(element.children).forEach(child => {
    debugElement(child, depth + 1);
  });
}