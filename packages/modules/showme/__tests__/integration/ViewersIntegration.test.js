/**
 * Integration Tests for Viewers with Real Legion Components
 * 
 * Tests each viewer type with actual asset rendering and display
 * NO MOCKS - Tests real viewer implementations with Legion components
 */

import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { ImageRenderer } from '../../src/client/renderers/ImageRenderer.js';
import { JSONRenderer } from '../../src/client/renderers/JSONRenderer.js';
import { TableRenderer } from '../../src/client/renderers/TableRenderer.js';
import { CodeRenderer } from '../../src/client/renderers/CodeRenderer.js';
import { WebRenderer } from '../../src/client/renderers/WebRenderer.js';
import { TextRenderer } from '../../src/client/renderers/TextRenderer.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Viewers Integration with Real Legion Components', () => {
  let server;
  let displayManager;
  let resourceManager;
  const testPort = 3790;
  const testAssetsDir = path.join(__dirname, '../assets');

  beforeAll(async () => {
    // Start real server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Initialize display manager
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/showme`
    });
    await displayManager.initialize();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('ImageRenderer integration', () => {
    test('should render PNG image correctly', async () => {
      // Create a small test PNG image (1x1 red pixel)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x5B, 0x84, 0xC5,
        0xE1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
      ]);
      
      const base64Image = `data:image/png;base64,${pngData.toString('base64')}`;
      
      // Create image asset
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: base64Image,
          assetType: 'image',
          title: 'PNG Test Image'
        })
      });
      
      const { assetId, success } = await response.json();
      expect(success).toBe(true);
      
      // Display image using renderer
      const windowId = await displayManager.displayAsset(assetId, 'image', {
        title: 'PNG Test Image',
        width: 200,
        height: 200
      });
      
      expect(windowId).toBeTruthy();
      
      // Verify window created with correct type
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.assetType).toBe('image');
      expect(windowInfo.renderer).toBe('ImageRenderer');
    });

    test('should render JPEG image correctly', async () => {
      // Create minimal JPEG header (not complete but recognizable)
      const jpegData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, // JPEG SOI and APP0 marker
        0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF
        0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xFF, 0xD9 // EOI marker
      ]);
      
      const base64Image = `data:image/jpeg;base64,${jpegData.toString('base64')}`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: base64Image,
          assetType: 'image',
          title: 'JPEG Test Image'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'image', {
        title: 'JPEG Test Image'
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).assetType).toBe('image');
    });

    test('should handle SVG images', async () => {
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="blue"/>
      </svg>`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: svgContent,
          assetType: 'image',
          title: 'SVG Test'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'image', {
        title: 'SVG Test',
        scalable: true
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should apply image display options', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: imageData,
          assetType: 'image',
          title: 'Options Test'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'image', {
        title: 'Image with Options',
        width: 640,
        height: 480,
        maintainAspectRatio: true,
        allowZoom: true,
        showToolbar: true
      });
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.options.width).toBe(640);
      expect(windowInfo.options.height).toBe(480);
      expect(windowInfo.options.maintainAspectRatio).toBe(true);
    });
  });

  describe('JSONRenderer integration', () => {
    test('should render simple JSON object', async () => {
      const jsonData = {
        name: 'Test Object',
        value: 42,
        nested: {
          array: [1, 2, 3],
          boolean: true,
          null: null
        }
      };
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: jsonData,
          assetType: 'json',
          title: 'JSON Object Test'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        title: 'JSON Object',
        collapsible: true,
        theme: 'dark'
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).renderer).toBe('JSONRenderer');
    });

    test('should render complex nested JSON', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', roles: ['admin', 'user'] },
          { id: 2, name: 'Bob', roles: ['user'] }
        ],
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            frequency: 'daily'
          }
        },
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      };
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: complexData,
          assetType: 'json',
          title: 'Complex JSON'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        title: 'Complex Nested JSON',
        initialExpanded: false,
        searchable: true
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should handle large JSON arrays', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: Math.random(),
        timestamp: Date.now() + i
      }));
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: largeArray,
          assetType: 'json',
          title: 'Large Array'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        title: 'Large JSON Array',
        pagination: true,
        pageSize: 10
      });
      
      expect(windowId).toBeTruthy();
    });
  });

  describe('TableRenderer integration', () => {
    test('should render array of objects as table', async () => {
      const tableData = [
        { id: 1, product: 'Laptop', price: 999.99, stock: 5 },
        { id: 2, product: 'Mouse', price: 29.99, stock: 50 },
        { id: 3, product: 'Keyboard', price: 79.99, stock: 25 },
        { id: 4, product: 'Monitor', price: 299.99, stock: 10 }
      ];
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: tableData,
          assetType: 'data',
          title: 'Product Table'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'data', {
        title: 'Product Inventory',
        sortable: true,
        filterable: true,
        resizableColumns: true
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).renderer).toBe('TableRenderer');
    });

    test('should render 2D array as table', async () => {
      const matrix = [
        ['Name', 'Age', 'City'],
        ['Alice', 30, 'New York'],
        ['Bob', 25, 'Los Angeles'],
        ['Charlie', 35, 'Chicago']
      ];
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: matrix,
          assetType: 'data',
          title: '2D Array Table'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'data', {
        title: '2D Array Data',
        firstRowAsHeader: true
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should handle CSV-like data', async () => {
      const csvData = `Name,Department,Salary
John Doe,Engineering,75000
Jane Smith,Marketing,65000
Bob Johnson,Sales,70000`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: csvData,
          assetType: 'data',
          title: 'CSV Data'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'data', {
        title: 'CSV Table',
        format: 'csv',
        delimiter: ','
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should apply table formatting options', async () => {
      const data = [
        { metric: 'Revenue', q1: 100000, q2: 120000, q3: 110000, q4: 150000 },
        { metric: 'Expenses', q1: 80000, q2: 85000, q3: 82000, q4: 90000 },
        { metric: 'Profit', q1: 20000, q2: 35000, q3: 28000, q4: 60000 }
      ];
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: data,
          assetType: 'data',
          title: 'Financial Data'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'data', {
        title: 'Quarterly Financial Report',
        striped: true,
        bordered: true,
        hover: true,
        dense: false,
        numberFormat: 'currency',
        totalsRow: true
      });
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.options.striped).toBe(true);
      expect(windowInfo.options.numberFormat).toBe('currency');
    });
  });

  describe('CodeRenderer integration', () => {
    test('should render JavaScript code with syntax highlighting', async () => {
      const jsCode = `// Calculate factorial
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

const result = factorial(5);
console.log(\`5! = \${result}\`);`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: jsCode,
          assetType: 'code',
          title: 'JavaScript Code'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'code', {
        title: 'JavaScript Example',
        language: 'javascript',
        lineNumbers: true,
        theme: 'monokai'
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).renderer).toBe('CodeRenderer');
    });

    test('should render Python code', async () => {
      const pythonCode = `# Python example
import math

def calculate_distance(x1, y1, x2, y2):
    """Calculate Euclidean distance between two points."""
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

# Test the function
distance = calculate_distance(0, 0, 3, 4)
print(f"Distance: {distance}")`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: pythonCode,
          assetType: 'code',
          title: 'Python Code'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'code', {
        title: 'Python Example',
        language: 'python',
        highlightLines: [3, 4, 5, 6]
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should render SQL code', async () => {
      const sqlCode = `-- Get top customers by total orders
SELECT 
    c.customer_id,
    c.first_name,
    c.last_name,
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_date >= '2024-01-01'
GROUP BY c.customer_id, c.first_name, c.last_name
HAVING COUNT(o.order_id) > 5
ORDER BY total_spent DESC
LIMIT 10;`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: sqlCode,
          assetType: 'code',
          title: 'SQL Query'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'code', {
        title: 'SQL Query Example',
        language: 'sql',
        readOnly: true
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should apply code editor options', async () => {
      const code = 'const x = 42;\nconst y = x * 2;\nconsole.log(y);';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: code,
          assetType: 'code',
          title: 'Editor Options Test'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'code', {
        title: 'Code with Options',
        language: 'javascript',
        lineNumbers: true,
        wordWrap: true,
        fontSize: 14,
        tabSize: 2,
        minimap: true,
        readOnly: false
      });
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.options.lineNumbers).toBe(true);
      expect(windowInfo.options.fontSize).toBe(14);
    });
  });

  describe('WebRenderer integration', () => {
    test('should render HTML content', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Test Web Content</h1>
  <p>This is a test paragraph.</p>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ul>
</body>
</html>`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: htmlContent,
          assetType: 'web',
          title: 'HTML Content'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'web', {
        title: 'HTML Test Page',
        allowNavigation: false,
        sandbox: true
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).renderer).toBe('WebRenderer');
    });

    test('should render URL in iframe', async () => {
      const url = 'https://example.com';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: url,
          assetType: 'web',
          title: 'External URL'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'web', {
        title: 'Example Website',
        allowNavigation: true,
        showAddressBar: true
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should handle markdown content', async () => {
      const markdownContent = `# Markdown Test

This is a **bold** text and this is *italic*.

## Features
- Feature 1
- Feature 2
- Feature 3

\`\`\`javascript
console.log('Code block');
\`\`\`

> This is a blockquote

[Link to example](https://example.com)`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: markdownContent,
          assetType: 'web',
          title: 'Markdown Content'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'web', {
        title: 'Markdown Preview',
        renderMarkdown: true
      });
      
      expect(windowId).toBeTruthy();
    });
  });

  describe('TextRenderer integration', () => {
    test('should render plain text', async () => {
      const textContent = `This is plain text content.
Multiple lines are supported.
Special characters: !@#$%^&*()_+
Unicode: 你好 مرحبا こんにちは`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: textContent,
          assetType: 'text',
          title: 'Plain Text'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'text', {
        title: 'Text Display',
        fontFamily: 'monospace',
        fontSize: 12,
        wordWrap: true
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).renderer).toBe('TextRenderer');
    });

    test('should render log format', async () => {
      const logContent = `[2024-01-10 10:00:00] INFO: Application started
[2024-01-10 10:00:01] DEBUG: Loading configuration
[2024-01-10 10:00:02] INFO: Database connected
[2024-01-10 10:00:03] WARNING: Cache size exceeded threshold
[2024-01-10 10:00:04] ERROR: Failed to load module X
[2024-01-10 10:00:05] INFO: Recovery initiated`;
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: logContent,
          assetType: 'text',
          title: 'Log Output'
        })
      });
      
      const { assetId } = await response.json();
      
      const windowId = await displayManager.displayAsset(assetId, 'text', {
        title: 'Application Logs',
        format: 'log',
        colorize: true,
        followTail: true
      });
      
      expect(windowId).toBeTruthy();
    });
  });

  describe('viewer error handling', () => {
    test('should handle corrupted image data', async () => {
      const corruptedImage = 'data:image/png;base64,INVALID_BASE64_DATA';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: corruptedImage,
          assetType: 'image',
          title: 'Corrupted Image'
        })
      });
      
      const { assetId } = await response.json();
      
      // Should handle gracefully even with corrupted data
      const windowId = await displayManager.displayAsset(assetId, 'image', {
        title: 'Error Test',
        fallbackMessage: 'Failed to load image'
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should handle invalid JSON', async () => {
      const invalidJson = '{ invalid json }';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: invalidJson,
          assetType: 'json',
          title: 'Invalid JSON'
        })
      });
      
      const { assetId } = await response.json();
      
      // Should display as text fallback
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        title: 'JSON Error Test'
      });
      
      expect(windowId).toBeTruthy();
    });

    test('should handle unsupported code language', async () => {
      const code = 'Some code in unknown language';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: code,
          assetType: 'code',
          title: 'Unknown Language'
        })
      });
      
      const { assetId } = await response.json();
      
      // Should fall back to plain text
      const windowId = await displayManager.displayAsset(assetId, 'code', {
        title: 'Unknown Language Code',
        language: 'unknown-lang'
      });
      
      expect(windowId).toBeTruthy();
    });
  });
});