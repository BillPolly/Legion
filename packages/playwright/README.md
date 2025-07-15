# @jsenvoy/playwright

Browser automation and web testing using Playwright for jsEnvoy AI agents.

## Overview

This package provides a comprehensive Playwright wrapper that exposes browser automation capabilities as AI agent tools through the jsEnvoy framework. It uses the JSON module pattern for flexible tool definition and follows natural Playwright API design principles.

## Features

- **Multi-browser support**: Chrome, Firefox, Safari, Edge
- **Natural API**: Write Playwright code the way it's meant to be written
- **Robust error handling**: Comprehensive error handling with retry logic
- **Flexible selectors**: Support for CSS, XPath, text content, and data-testid
- **Mobile emulation**: Device presets and custom configurations
- **Screenshot capabilities**: Full page and element screenshots
- **Data extraction**: Structured data scraping from web pages
- **Form automation**: Fill and submit forms automatically
- **Wait strategies**: Wait for elements, network, and custom conditions
- **JavaScript execution**: Execute custom scripts in browser context

## Installation

```bash
npm install @jsenvoy/playwright
```

## Usage

### As a JSON Module (Recommended)

The package can be loaded as a JSON module using the jsEnvoy module loader:

```javascript
import { ModuleFactory } from '@jsenvoy/module-loader';

const moduleFactory = new ModuleFactory();
const playwrightModule = await moduleFactory.createJsonModule('./node_modules/@jsenvoy/playwright/module.json');
const tools = await playwrightModule.getTools();
```

### Direct Usage

```javascript
import PlaywrightWrapper from '@jsenvoy/playwright';

const browser = new PlaywrightWrapper({
  browserType: 'chromium',
  headless: false,
  timeout: 30000
});

// Navigate to a page
await browser.navigateToPage('https://example.com');

// Take a screenshot
const screenshot = await browser.takeScreenshot({
  fullPage: true,
  format: 'png'
});

// Extract data
const data = await browser.extractData({
  title: 'h1',
  description: 'p.description',
  links: 'a[href]'
});

// Close browser
await browser.close();
```

## Available Tools

When loaded as a JSON module, the following tools are available:

### navigate_to_page
Navigate to a web page and wait for it to load.

```javascript
{
  "url": "https://example.com",
  "waitUntil": "networkidle",
  "timeout": 30000
}
```

### click_element
Click on an element using various selector strategies.

```javascript
{
  "selector": "button.submit",
  "clickType": "single",
  "waitForElement": true
}
```

### fill_form
Fill out a form with provided data.

```javascript
{
  "formData": {
    "input[name='username']": "john_doe",
    "input[name='password']": "secret123",
    "select[name='country']": "US"
  },
  "submitForm": true
}
```

### take_screenshot
Take a screenshot of the current page or specific element.

```javascript
{
  "fullPage": true,
  "format": "png",
  "quality": 90
}
```

### extract_data
Extract structured data from the page.

```javascript
{
  "selectors": {
    "title": "h1",
    "price": ".price",
    "description": ".description"
  },
  "multiple": false
}
```

### wait_for_element
Wait for an element to appear or change state.

```javascript
{
  "selector": ".loading-spinner",
  "state": "hidden",
  "timeout": 10000
}
```

### execute_script
Execute JavaScript code in the browser context.

```javascript
{
  "script": "return document.title;",
  "args": []
}
```

### get_page_info
Get information about the current page.

```javascript
{}
```

### close_browser
Close the browser and clean up resources.

```javascript
{}
```

## Configuration

The wrapper supports various configuration options:

```javascript
const config = {
  browserType: 'chromium',    // 'chromium', 'firefox', 'webkit'
  headless: true,             // Run in headless mode
  timeout: 30000,             // Default timeout in milliseconds
  retries: 3,                 // Number of retry attempts
  browserOptions: {           // Additional Playwright launch options
    slowMo: 100,
    devtools: false
  }
};
```

## Error Handling

The wrapper provides comprehensive error handling with specific error types:

- `PlaywrightError`: Base error class
- `ElementNotFoundError`: When elements cannot be found
- `TimeoutError`: When operations timeout
- `NavigationError`: When navigation fails
- `FormError`: When form operations fail
- `ScreenshotError`: When screenshots fail

All errors include detailed context information including the action that failed, selectors used, and debugging details.

## Selector Strategies

The wrapper supports multiple selector strategies:

- **CSS Selectors**: `button.submit`, `#main-content`
- **XPath**: `//button[@class='submit']`
- **Text Content**: `text="Click me"`
- **Data Test ID**: `data-testid=submit-button`
- **Role Selectors**: `role=button`
- **Placeholder**: `[placeholder="Enter email"]`
- **ARIA Labels**: `[aria-label="Close dialog"]`

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Examples

### Web Scraping Example

```javascript
// Navigate to a product page
await browser.navigateToPage('https://example-store.com/product/123');

// Extract product information
const productData = await browser.extractData({
  name: 'h1.product-title',
  price: '.price-current',
  description: '.product-description',
  images: 'img.product-image'
});

// Take a screenshot for documentation
const screenshot = await browser.takeScreenshot({
  fullPage: true,
  format: 'png'
});
```

### Form Automation Example

```javascript
// Navigate to a form page
await browser.navigateToPage('https://example.com/contact');

// Fill out the contact form
await browser.fillForm({
  'input[name="name"]': 'John Doe',
  'input[name="email"]': 'john@example.com',
  'textarea[name="message"]': 'Hello, I need help with...',
  'select[name="subject"]': 'Support'
}, { submitForm: true });

// Wait for success message
await browser.waitForElement('.success-message', {
  state: 'visible',
  timeout: 10000
});
```

### Testing Example

```javascript
// Navigate to application
await browser.navigateToPage('https://myapp.com/login');

// Test login functionality
await browser.fillForm({
  'input[name="username"]': 'testuser',
  'input[name="password"]': 'testpass'
});

await browser.clickElement('button[type="submit"]');

// Verify successful login
await browser.waitForElement('.dashboard', {
  state: 'visible',
  timeout: 5000
});

// Check page title
const pageInfo = await browser.getPageInfo();
expect(pageInfo.title).toContain('Dashboard');
```

## Browser Configuration

### Different Browsers

```javascript
// Chrome/Chromium
const chromeWrapper = new PlaywrightWrapper({ browserType: 'chromium' });

// Firefox
const firefoxWrapper = new PlaywrightWrapper({ browserType: 'firefox' });

// Safari (WebKit)
const safariWrapper = new PlaywrightWrapper({ browserType: 'webkit' });
```

### Mobile Emulation

```javascript
const mobileWrapper = new PlaywrightWrapper({
  browserType: 'chromium',
  contextOptions: {
    ...devices['iPhone 12'],
    permissions: ['geolocation']
  }
});
```

## Performance Considerations

- The wrapper automatically manages browser lifecycle
- Browsers are launched lazily when first needed
- Resources are cleaned up properly on close
- Network requests can be intercepted for testing
- Screenshots are returned as base64 for easy transmission

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the main repository.

## Support

For issues and support, please use the GitHub issue tracker in the main jsEnvoy repository.