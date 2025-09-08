/**
 * Integration Tests for Asset Detection
 * 
 * Tests detection accuracy with real asset samples and edge cases
 * NO MOCKS - Uses real asset data and file system operations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Asset Detection Integration', () => {
  let detector;
  let testAssetsDir;

  beforeAll(async () => {
    detector = new AssetTypeDetector();
    testAssetsDir = path.join(__dirname, '../assets');
    
    // Create test assets directory
    await fs.mkdir(testAssetsDir, { recursive: true });
    
    // Create real test assets
    await createTestAssets();
  });

  afterAll(async () => {
    // Clean up test assets
    await fs.rm(testAssetsDir, { recursive: true, force: true });
  });

  async function createTestAssets() {
    // Create real image file with PNG header
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // "IHDR"
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
      0x90, 0x77, 0x53, 0xDE, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4E, 0x44, // "IEND"
      0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    await fs.writeFile(path.join(testAssetsDir, 'test.png'), pngBuffer);

    // Create JPEG file with JPEG header
    const jpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, // JPEG signature
      0x00, 0x10, // length
      0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF"
      0x01, 0x01, // version
      0x01, 0x00, 0x01, 0x00, 0x01, // units, x/y density
      0x00, 0x00, // thumbnail width/height
      0xFF, 0xD9 // End of image
    ]);
    await fs.writeFile(path.join(testAssetsDir, 'test.jpg'), jpegBuffer);

    // Create real JSON file
    const jsonData = {
      name: 'Test Application',
      version: '1.0.0',
      dependencies: {
        'express': '^4.18.0',
        'lodash': '^4.17.21'
      },
      scripts: {
        start: 'node server.js',
        test: 'npm test'
      }
    };
    await fs.writeFile(path.join(testAssetsDir, 'test.json'), JSON.stringify(jsonData, null, 2));

    // Create real CSV file
    const csvContent = `id,name,email,department,salary
1,John Doe,john.doe@company.com,Engineering,75000
2,Jane Smith,jane.smith@company.com,Marketing,65000
3,Bob Johnson,bob.johnson@company.com,Sales,55000
4,Alice Brown,alice.brown@company.com,Engineering,80000
5,Charlie Davis,charlie.davis@company.com,HR,60000`;
    await fs.writeFile(path.join(testAssetsDir, 'test.csv'), csvContent);

    // Create real JavaScript code file
    const jsContent = `/**
 * Simple Express server for testing
 */
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  res.json({ id: userId, name: \`User \${userId}\` });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`;
    await fs.writeFile(path.join(testAssetsDir, 'server.js'), jsContent);

    // Create Python code file
    const pythonContent = `#!/usr/bin/env python3
"""
Simple Python script for testing detection
"""

import json
import sys
from typing import List, Dict, Any

def process_data(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Process a list of data objects and return summary statistics."""
    if not data:
        return {"count": 0, "message": "No data provided"}
    
    total_count = len(data)
    result = {
        "count": total_count,
        "keys": list(data[0].keys()) if data else [],
        "summary": f"Processed {total_count} items"
    }
    
    return result

def main():
    """Main function."""
    sample_data = [
        {"id": 1, "name": "Alice", "score": 95},
        {"id": 2, "name": "Bob", "score": 87},
        {"id": 3, "name": "Charlie", "score": 92}
    ]
    
    result = process_data(sample_data)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()`;
    await fs.writeFile(path.join(testAssetsDir, 'script.py'), pythonContent);

    // Create HTML file
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test HTML Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test HTML Page</h1>
        <p>This is a test HTML file for asset detection.</p>
    </div>
    
    <main>
        <h2>Content</h2>
        <p>This page contains various HTML elements for testing purposes.</p>
        <ul>
            <li>Lists</li>
            <li>Paragraphs</li>
            <li>Headers</li>
        </ul>
    </main>
    
    <script>
        console.log('Test HTML page loaded');
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded');
        });
    </script>
</body>
</html>`;
    await fs.writeFile(path.join(testAssetsDir, 'test.html'), htmlContent);

    // Create plain text file
    const textContent = `This is a plain text file for testing asset detection.
It contains multiple lines of text without any special formatting or structure.

The content includes:
- Simple sentences
- Multiple paragraphs
- Basic punctuation

This type of content should be detected as 'text' type since it doesn't
match any of the more specific patterns for code, JSON, CSV, or other formats.`;
    await fs.writeFile(path.join(testAssetsDir, 'test.txt'), textContent);
  }

  describe('Real File Detection', () => {
    test('should detect PNG image file correctly', async () => {
      const pngPath = path.join(testAssetsDir, 'test.png');
      const pngBuffer = await fs.readFile(pngPath);
      
      // Test with file path
      expect(detector.detectAssetType(pngPath)).toBe('image');
      
      // Test with buffer content
      expect(detector.detectAssetType(pngBuffer)).toBe('image');
      
      // Test with hint validation
      expect(detector.validateHint('image', pngBuffer)).toBe(true);
      expect(detector.validateHint('json', pngBuffer)).toBe(false);
    });

    test('should detect JPEG image file correctly', async () => {
      const jpegPath = path.join(testAssetsDir, 'test.jpg');
      const jpegBuffer = await fs.readFile(jpegPath);
      
      // Test with file path
      expect(detector.detectAssetType(jpegPath)).toBe('image');
      
      // Test with buffer content
      expect(detector.detectAssetType(jpegBuffer)).toBe('image');
      
      // Test detection priority - image should be detected even if JSON hint is given
      expect(detector.detectAssetType(jpegBuffer, 'json')).toBe('image');
    });

    test('should detect JSON file correctly', async () => {
      const jsonPath = path.join(testAssetsDir, 'test.json');
      const jsonContent = await fs.readFile(jsonPath, 'utf8');
      const jsonObject = JSON.parse(jsonContent);
      
      // Test with file path
      expect(detector.detectAssetType(jsonPath)).toBe('json');
      
      // Test with string content
      expect(detector.detectAssetType(jsonContent)).toBe('json');
      
      // Test with parsed object
      expect(detector.detectAssetType(jsonObject)).toBe('json');
    });

    test('should detect CSV file as tabular data', async () => {
      const csvPath = path.join(testAssetsDir, 'test.csv');
      const csvContent = await fs.readFile(csvPath, 'utf8');
      
      // CSV should be detected as 'data' (tabular)
      expect(detector.detectAssetType(csvContent)).toBe('data');
      
      // File path should be detected as text (no .csv extension in detector)
      // but content should be detected as data
      expect(detector.detectAssetType(csvContent)).toBe('data');
    });

    test('should detect JavaScript code file correctly', async () => {
      const jsPath = path.join(testAssetsDir, 'server.js');
      const jsContent = await fs.readFile(jsPath, 'utf8');
      
      // Test with file path
      expect(detector.detectAssetType(jsPath)).toBe('code');
      
      // Test with content
      expect(detector.detectAssetType(jsContent)).toBe('code');
    });

    test('should detect Python code file correctly', async () => {
      const pyPath = path.join(testAssetsDir, 'script.py');
      const pyContent = await fs.readFile(pyPath, 'utf8');
      
      // Test with file path
      expect(detector.detectAssetType(pyPath)).toBe('code');
      
      // Test with content
      expect(detector.detectAssetType(pyContent)).toBe('code');
    });

    test('should detect HTML file as web content', async () => {
      const htmlPath = path.join(testAssetsDir, 'test.html');
      const htmlContent = await fs.readFile(htmlPath, 'utf8');
      
      // Test with file path
      expect(detector.detectAssetType(htmlPath)).toBe('code');
      
      // Test with content - should detect as web because of HTML tags
      expect(detector.detectAssetType(htmlContent)).toBe('web');
    });

    test('should detect plain text file correctly', async () => {
      const textPath = path.join(testAssetsDir, 'test.txt');
      const textContent = await fs.readFile(textPath, 'utf8');
      
      // Both should default to text
      expect(detector.detectAssetType(textPath)).toBe('text');
      expect(detector.detectAssetType(textContent)).toBe('text');
    });
  });

  describe('Complex Data Structure Detection', () => {
    test('should detect complex JSON structures correctly', () => {
      const complexJson = {
        users: [
          { id: 1, name: 'John', profile: { age: 30, city: 'NYC' } },
          { id: 2, name: 'Jane', profile: { age: 25, city: 'LA' } }
        ],
        metadata: {
          total: 2,
          page: 1,
          created: new Date().toISOString()
        },
        config: {
          pagination: true,
          sortBy: 'name',
          filters: ['active', 'verified']
        }
      };
      
      expect(detector.detectAssetType(complexJson)).toBe('json');
    });

    test('should detect tabular data from object arrays', () => {
      const tableData = [
        { id: 1, name: 'John Doe', email: 'john@example.com', department: 'Engineering', salary: 75000 },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', department: 'Marketing', salary: 65000 },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', department: 'Sales', salary: 55000 }
      ];
      
      // Should be detected as tabular data, not JSON
      expect(detector.detectAssetType(tableData)).toBe('data');
    });

    test('should handle mixed content types in arrays', () => {
      const mixedArray = [
        'string item',
        123,
        { key: 'value' },
        true,
        null
      ];
      
      // Mixed arrays should fall back to JSON
      expect(detector.detectAssetType(mixedArray)).toBe('json');
    });
  });

  describe('URL and Web Content Detection', () => {
    test('should detect various URL formats as web content', () => {
      const urls = [
        'https://api.example.com/users',
        'http://localhost:3000/dashboard',
        'https://cdn.example.com/assets/image.png',
        'https://example.com/api/v1/data.json'
      ];
      
      urls.forEach(url => {
        expect(detector.detectAssetType(url)).toBe('web');
      });
    });

    test('should detect HTML content with various structures', () => {
      const htmlSamples = [
        '<html><head><title>Test</title></head><body>Content</body></html>',
        '<!DOCTYPE html><html lang="en"><head></head><body></body></html>',
        '<div class="container"><p>Simple HTML fragment</p></div>',
        '<table><tr><td>Table content</td></tr></table>'
      ];
      
      htmlSamples.forEach(html => {
        expect(detector.detectAssetType(html)).toBe('web');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty and minimal files', async () => {
      // Create empty file
      const emptyPath = path.join(testAssetsDir, 'empty.txt');
      await fs.writeFile(emptyPath, '');
      
      const emptyContent = await fs.readFile(emptyPath, 'utf8');
      expect(detector.detectAssetType(emptyContent)).toBe('text');
    });

    test('should handle corrupted or invalid JSON gracefully', () => {
      const invalidJson = '{"key": "value", "missing": }';
      
      // Should not throw, should default to text
      expect(() => detector.detectAssetType(invalidJson)).not.toThrow();
      expect(detector.detectAssetType(invalidJson)).toBe('text');
    });

    test('should handle very large data structures', () => {
      // Create large array (1000 items)
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random(),
        timestamp: Date.now() + i
      }));
      
      expect(detector.detectAssetType(largeArray)).toBe('data');
    });

    test('should handle binary data that is not image', async () => {
      // Create binary file that is not an image
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]);
      const binaryPath = path.join(testAssetsDir, 'binary.dat');
      await fs.writeFile(binaryPath, binaryBuffer);
      
      // Should not be detected as image, should default to text
      expect(detector.detectAssetType(binaryBuffer)).toBe('text');
    });
  });

  describe('Hint Override Scenarios', () => {
    test('should respect valid hints over automatic detection', async () => {
      const jsonPath = path.join(testAssetsDir, 'test.json');
      
      // Normally would be detected as JSON, but hint overrides to text
      expect(detector.detectAssetType(jsonPath, 'text')).toBe('text');
    });

    test('should ignore invalid hints and use automatic detection', () => {
      const jsonData = { key: 'value' };
      
      // Invalid hint should be ignored
      expect(detector.detectAssetType(jsonData, 'image')).toBe('json');
      expect(detector.detectAssetType(jsonData, 'invalid_type')).toBe('json');
    });

    test('should validate hint compatibility correctly', async () => {
      const pngBuffer = await fs.readFile(path.join(testAssetsDir, 'test.png'));
      const jsonContent = await fs.readFile(path.join(testAssetsDir, 'test.json'), 'utf8');
      
      // Compatible hints
      expect(detector.validateHint('image', pngBuffer)).toBe(true);
      expect(detector.validateHint('json', jsonContent)).toBe(true);
      expect(detector.validateHint('text', 'any content')).toBe(true);
      
      // Incompatible hints
      expect(detector.validateHint('image', jsonContent)).toBe(false);
      expect(detector.validateHint('json', pngBuffer)).toBe(false);
    });
  });
});