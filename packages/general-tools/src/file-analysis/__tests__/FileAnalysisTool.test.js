import { jest } from '@jest/globals';
import FileAnalysisModule from '../FileAnalysisModule.js';
import { FileConverter } from '../utils/FileConverter.js';
import { ModuleFactory } from '@legion/tools';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileAnalysisTool', () => {
  let module;
  let mockResourceManager;
  let mockLLMClient;

  beforeEach(() => {
    // Mock ResourceManager
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'env.ANTHROPIC_API_KEY') return 'test-anthropic-key';
        if (key === 'env.OPENAI_API_KEY') return 'test-openai-key';
        return null;
      })
    };

    // Mock LLMClient
    mockLLMClient = {
      sendAndReceiveResponse: jest.fn()
    };
  });

  describe('FileConverter', () => {
    test('should correctly identify file types', () => {
      expect(FileConverter.getFileType('.png')).toBe('image');
      expect(FileConverter.getFileType('.jpg')).toBe('image');
      expect(FileConverter.getFileType('.pdf')).toBe('document');
      expect(FileConverter.getFileType('.md')).toBe('text');
      expect(FileConverter.getFileType('.txt')).toBe('text');
      expect(FileConverter.getFileType('.unknown')).toBe('auto');
    });

    test('should return correct MIME types', () => {
      expect(FileConverter.getMimeType('.png')).toBe('image/png');
      expect(FileConverter.getMimeType('.jpg')).toBe('image/jpeg');
      expect(FileConverter.getMimeType('.pdf')).toBe('application/pdf');
      expect(FileConverter.getMimeType('.md')).toBe('text/markdown');
      expect(FileConverter.getMimeType('.unknown')).toBe('application/octet-stream');
    });

    test('should check if file is supported', () => {
      expect(FileConverter.isSupported('test.png')).toBe(true);
      expect(FileConverter.isSupported('test.md')).toBe(true);
      expect(FileConverter.isSupported('test.unknown')).toBe(false);
    });
  });

  describe('FileAnalysisModule', () => {
    test('should create module with ResourceManager', async () => {
      const module = await FileAnalysisModule.create(mockResourceManager);
      
      expect(module).toBeInstanceOf(FileAnalysisModule);
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.ANTHROPIC_API_KEY');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.OPENAI_API_KEY');
    });

    test('should throw error if ANTHROPIC_API_KEY is missing', async () => {
      mockResourceManager.get = jest.fn((key) => {
        if (key === 'env.ANTHROPIC_API_KEY') return null;
        return 'test-key';
      });

      await expect(FileAnalysisModule.create(mockResourceManager))
        .rejects.toThrow('ANTHROPIC_API_KEY environment variable is required');
    });

    test('should handle file not found error', async () => {
      const module = await FileAnalysisModule.create(mockResourceManager);
      
      const result = await module.analyzeFile({
        file_path: '/non/existent/file.png',
        prompt: 'What is this?'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    test('should reject PDF files with appropriate message', async () => {
      // Create a mock PDF file
      const testPdfPath = path.join(__dirname, 'test.pdf');
      await fs.writeFile(testPdfPath, 'Mock PDF content');
      
      try {
        const module = await FileAnalysisModule.create(mockResourceManager);
        
        const result = await module.analyzeFile({
          file_path: testPdfPath,
          prompt: 'What is in this PDF?'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('PDF analysis requires text extraction');
      } finally {
        // Clean up
        await fs.unlink(testPdfPath).catch(() => {});
      }
    });
  });

  describe('Module JSON Configuration', () => {
    test('module.json should be valid', async () => {
      const modulePath = path.join(__dirname, '..', 'module.json');
      const moduleJson = JSON.parse(await fs.readFile(modulePath, 'utf-8'));
      
      expect(moduleJson.name).toBe('file-analysis');
      expect(moduleJson.tools).toHaveLength(1);
      expect(moduleJson.tools[0].name).toBe('analyze_file');
      expect(moduleJson.tools[0].inputSchema.required).toContain('file_path');
      expect(moduleJson.tools[0].inputSchema.required).toContain('prompt');
    });
  });
});