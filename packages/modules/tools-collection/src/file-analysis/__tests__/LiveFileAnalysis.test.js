import { LLMClient } from '@legion/llm-client'
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only run these tests when explicitly requested
describe.skip('Live File Analysis with Claude', () => {
  let llmClient;
  let moduleLoader;
  let fileAnalysisModule;
  let testImagePath;

  beforeAll(async () => {
    // Skip if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping live tests - ANTHROPIC_API_KEY not set');
      return;
    }

    // Initialize ResourceManager and ModuleLoader
    const resourceManager = await ResourceManager.getResourceManager();
    
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load the file-analysis module
    fileAnalysisModule = await moduleLoader.loadModuleByName('file-analysis');
    
    // Initialize LLMClient
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Create a test image
    testImagePath = path.join(__dirname, 'test-image.png');
    // Copy the dalle image if it exists, or create a simple test image
    const dallePath = '/var/folders/1v/w4sqw_sn2f9gp0cbwsrbtxt00000gp/T/legion-generated-images/dalle3-2025-08-04T21-31-03.png';
    try {
      await fs.copyFile(dallePath, testImagePath);
    } catch (error) {
      // Create a simple 1x1 red pixel PNG as fallback
      const redPixelPNG = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      await fs.writeFile(testImagePath, redPixelPNG);
    }
  }, 30000);

  afterAll(async () => {
    // Clean up test image
    if (testImagePath) {
      await fs.unlink(testImagePath).catch(() => {});
    }
  });

  test('should analyze an image using sendAndReceiveResponse with files', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Test skipped - no API key');
      return;
    }

    // Read the test image
    const imageData = await fs.readFile(testImagePath);
    
    // Send request with file
    const response = await llmClient.sendAndReceiveResponse(
      [{ role: 'user', content: 'Describe what you see in this image in detail. What objects, colors, and composition do you observe?' }],
      {
        files: [{
          type: 'image',
          name: 'test-image.png',
          data: imageData,
          mimeType: 'image/png'
        }]
      }
    );
    
    console.log('Claude\'s image analysis:', response);
    
    // Verify response contains some analysis
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(50); // Should be a detailed description
    expect(response.toLowerCase()).toMatch(/image|color|see|shows|appears|contains/);
  }, 30000);

  test('should analyze a file using the analyze_file tool', async () => {
    if (!process.env.ANTHROPIC_API_KEY || !fileAnalysisModule) {
      console.log('Test skipped - no API key or module not loaded');
      return;
    }

    // Get the tool
    const tools = fileAnalysisModule.getTools();
    const analyzeFileTool = tools.find(t => t.name === 'analyze_file');
    
    expect(analyzeFileTool).toBeDefined();
    
    // Execute the tool
    const result = await analyzeFileTool.execute({
      file_path: testImagePath,
      prompt: 'What is the main subject of this image? Describe any notable features.'
    });
    
    console.log('Tool execution result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.data.analysis).toBeTruthy();
    expect(result.data.file.type).toBe('image');
    expect(result.data.provider).toBe('anthropic');
  }, 30000);

  test('should analyze a markdown file', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Test skipped - no API key');
      return;
    }

    // Create a test markdown file
    const testMdPath = path.join(__dirname, 'test-doc.md');
    const mdContent = `# Test Document

This is a test markdown document for AI analysis.

## Features
- Bullet point 1
- Bullet point 2
- Bullet point 3

## Code Example
\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

This document is used to test file analysis capabilities.`;

    await fs.writeFile(testMdPath, mdContent);
    
    try {
      // Read the file
      const fileData = await fs.readFile(testMdPath);
      
      // Analyze with Claude
      const response = await llmClient.sendAndReceiveResponse(
        [{ role: 'user', content: 'Summarize this markdown document and list its main sections.' }],
        {
          files: [{
            type: 'text',
            name: 'test-doc.md',
            data: fileData,
            mimeType: 'text/markdown'
          }]
        }
      );
      
      console.log('Claude\'s markdown analysis:', response);
      
      expect(response).toContain('Test Document');
      expect(response).toMatch(/features|code|example/i);
    } finally {
      // Clean up
      await fs.unlink(testMdPath).catch(() => {});
    }
  }, 30000);

  test('should handle multiple files in one request', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Test skipped - no API key');
      return;
    }

    // Create a text file
    const testTxtPath = path.join(__dirname, 'test.txt');
    await fs.writeFile(testTxtPath, 'This is a simple text file for testing.');
    
    try {
      const imageData = await fs.readFile(testImagePath);
      const textData = await fs.readFile(testTxtPath);
      
      // Send both files
      const response = await llmClient.sendAndReceiveResponse(
        [{ role: 'user', content: 'I\'m sending you an image and a text file. Please describe what you see in the image and tell me what the text file contains.' }],
        {
          files: [
            {
              type: 'image',
              name: 'test-image.png',
              data: imageData,
              mimeType: 'image/png'
            },
            {
              type: 'text',
              name: 'test.txt',
              data: textData,
              mimeType: 'text/plain'
            }
          ]
        }
      );
      
      console.log('Claude\'s multi-file analysis:', response);
      
      expect(response).toContain('text file');
      expect(response).toContain('image');
    } finally {
      await fs.unlink(testTxtPath).catch(() => {});
    }
  }, 30000);
});

// To run these tests, use: npm test -- --testNamePattern="Live File Analysis"