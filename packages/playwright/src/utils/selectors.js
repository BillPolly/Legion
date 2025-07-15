/**
 * Utility functions for handling selectors and element identification
 */

/**
 * Normalize selector to handle different selector types
 */
export function normalizeSelector(selector) {
  if (!selector) {
    throw new Error('Selector is required');
  }

  // Handle text content selectors
  if (selector.startsWith('text=')) {
    return selector;
  }

  // Handle XPath selectors
  if (selector.startsWith('//') || selector.startsWith('xpath=')) {
    return selector.startsWith('xpath=') ? selector : `xpath=${selector}`;
  }

  // Handle data-testid selectors
  if (selector.startsWith('data-testid=')) {
    return `[data-testid="${selector.replace('data-testid=', '')}"]`;
  }

  // Handle role selectors
  if (selector.startsWith('role=')) {
    return selector;
  }

  // Default to CSS selector
  return selector;
}

/**
 * Create a selector that combines multiple strategies
 */
export function createRobustSelector(options) {
  const { text, role, testId, css, xpath } = options;
  
  const selectors = [];
  
  if (testId) {
    selectors.push(`[data-testid="${testId}"]`);
  }
  
  if (role) {
    selectors.push(`role=${role}`);
  }
  
  if (text) {
    selectors.push(`text="${text}"`);
  }
  
  if (css) {
    selectors.push(css);
  }
  
  if (xpath) {
    selectors.push(`xpath=${xpath}`);
  }
  
  return selectors.length > 0 ? selectors.join(' >> ') : null;
}

/**
 * Wait for selector with retry logic
 */
export async function waitForSelectorWithRetry(page, selector, options = {}) {
  const { timeout = 10000, retries = 3, state = 'visible' } = options;
  
  for (let i = 0; i < retries; i++) {
    try {
      const normalizedSelector = normalizeSelector(selector);
      await page.waitForSelector(normalizedSelector, { 
        timeout: timeout / retries, 
        state 
      });
      return true;
    } catch (error) {
      if (i === retries - 1) {
        throw new Error(`Element not found after ${retries} attempts: ${selector}`);
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return false;
}

/**
 * Get element with multiple fallback strategies
 */
export async function getElementWithFallback(page, selector, options = {}) {
  const strategies = [
    // Try as-is first
    selector,
    // Try with text if it looks like text
    selector.includes(' ') ? `text="${selector}"` : null,
    // Try as CSS selector
    normalizeSelector(selector),
    // Try as placeholder
    `[placeholder*="${selector}"]`,
    // Try as aria-label
    `[aria-label*="${selector}"]`,
    // Try as title
    `[title*="${selector}"]`
  ].filter(Boolean);
  
  for (const strategy of strategies) {
    try {
      const element = await page.locator(strategy).first();
      if (await element.isVisible()) {
        return element;
      }
    } catch (error) {
      // Continue to next strategy
    }
  }
  
  throw new Error(`Element not found with any strategy: ${selector}`);
}