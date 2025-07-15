/**
 * Utility functions for waiting and timing operations
 */

/**
 * Wait for network requests to complete
 */
export async function waitForNetworkIdle(page, options = {}) {
  const { timeout = 30000, idleTime = 2000 } = options;
  
  return new Promise((resolve, reject) => {
    let timeoutId;
    let idleTimeoutId;
    let requestCount = 0;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      page.off('request', onRequest);
      page.off('response', onResponse);
    };
    
    const onRequest = () => {
      requestCount++;
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
    };
    
    const onResponse = () => {
      requestCount--;
      if (requestCount === 0) {
        idleTimeoutId = setTimeout(() => {
          cleanup();
          resolve();
        }, idleTime);
      }
    };
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Network idle timeout after ${timeout}ms`));
    }, timeout);
    
    // Listen for network events
    page.on('request', onRequest);
    page.on('response', onResponse);
    
    // Check if already idle
    if (requestCount === 0) {
      idleTimeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, idleTime);
    }
  });
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page, options = {}) {
  const { timeout = 30000, waitUntil = 'networkidle' } = options;
  
  await page.waitForLoadState(waitUntil, { timeout });
}

/**
 * Wait for element to be stable (not moving)
 */
export async function waitForElementStable(page, selector, options = {}) {
  const { timeout = 10000, stableTime = 1000 } = options;
  
  const element = page.locator(selector);
  
  return new Promise((resolve, reject) => {
    let timeoutId;
    let stableTimeoutId;
    let lastBoundingBox = null;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (stableTimeoutId) clearTimeout(stableTimeoutId);
    };
    
    const checkStability = async () => {
      try {
        const boundingBox = await element.boundingBox();
        
        if (lastBoundingBox && 
            boundingBox?.x === lastBoundingBox.x &&
            boundingBox?.y === lastBoundingBox.y &&
            boundingBox?.width === lastBoundingBox.width &&
            boundingBox?.height === lastBoundingBox.height) {
          
          if (stableTimeoutId) clearTimeout(stableTimeoutId);
          stableTimeoutId = setTimeout(() => {
            cleanup();
            resolve();
          }, stableTime);
        } else {
          lastBoundingBox = boundingBox;
          if (stableTimeoutId) clearTimeout(stableTimeoutId);
          setTimeout(checkStability, 100);
        }
      } catch (error) {
        setTimeout(checkStability, 100);
      }
    };
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Element not stable after ${timeout}ms`));
    }, timeout);
    
    // Start checking
    checkStability();
  });
}

/**
 * Wait for condition with custom logic
 */
export async function waitForCondition(conditionFn, options = {}) {
  const { timeout = 10000, interval = 100, errorMessage = 'Condition not met' } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await conditionFn();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`${errorMessage} after ${timeout}ms`);
}

/**
 * Wait for page title to match
 */
export async function waitForTitle(page, titlePattern, options = {}) {
  const { timeout = 10000 } = options;
  
  return waitForCondition(
    async () => {
      const title = await page.title();
      if (titlePattern instanceof RegExp) {
        return titlePattern.test(title);
      }
      return title.includes(titlePattern);
    },
    { timeout, errorMessage: `Title did not match pattern: ${titlePattern}` }
  );
}

/**
 * Wait for URL to match
 */
export async function waitForURL(page, urlPattern, options = {}) {
  const { timeout = 10000 } = options;
  
  return waitForCondition(
    async () => {
      const url = page.url();
      if (urlPattern instanceof RegExp) {
        return urlPattern.test(url);
      }
      return url.includes(urlPattern);
    },
    { timeout, errorMessage: `URL did not match pattern: ${urlPattern}` }
  );
}