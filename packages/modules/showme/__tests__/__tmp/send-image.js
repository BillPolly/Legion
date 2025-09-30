/**
 * Send test image to connected browser
 */
process.env.NODE_ENV = 'test';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple red 10x10 PNG
const redSquareBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
const imageData = `data:image/png;base64,${redSquareBase64}`;

// Connect to running server using fetch API
const response = await fetch('http://localhost:4567/api/display-asset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    asset: {
      type: 'image',
      data: imageData,
      width: 100,
      height: 100
    },
    assetType: 'image',
    title: 'Test Red Square'
  })
});

if (response.ok) {
  const result = await response.json();
  console.log('✅ Image sent successfully!', result);
} else {
  console.error('❌ Failed to send image:', response.status, response.statusText);
  const text = await response.text();
  console.error('Response:', text);
}