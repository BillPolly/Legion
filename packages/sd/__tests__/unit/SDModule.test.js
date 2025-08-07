/**
 * Unit tests for SDModule
 */

import { jest } from '@jest/globals';
import SDModule from '../../src/SDModule.js';

// Mock dependencies
jest.mock('@legion/llm', () => ({
  LLMClient: jest.fn().mockImplementation(() => ({
    complete: jest.fn().mockResolvedValue('mocked response')
  }))
}));

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    db: jest.fn().mockReturnValue({
      admin: () => ({ ping: jest.fn().mockResolvedValue(true) })
    }),
    close: jest.fn()
  }))
}));

describe('SDModule', () => {
  let module;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'env.ANTHROPIC_API_KEY') return 'test-api-key';
        if (key === 'env.MONGODB_URI') return 'mongodb://localhost:27017/test';
        return null;
      }),
      register: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create SDModule instance', () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      
      expect(module).toBeDefined();
      expect(module.name).toBe('SDModule');
      expect(module.resourceManager).toBe(mockResourceManager);
    });
  });

  describe('initialize', () => {
    it('should initialize module successfully', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      expect(module.llmClient).toBeDefined();
      expect(module.profileManager).toBeDefined();
      expect(module.tools.size).toBeGreaterThan(0);
    });

    it('should throw error if API key is missing', async () => {
      mockResourceManager.get = jest.fn().mockReturnValue(null);
      module = new SDModule({ resourceManager: mockResourceManager });
      
      await expect(module.initialize()).rejects.toThrow('ANTHROPIC_API_KEY not found');
    });
  });

  describe('getLLMClient', () => {
    it('should get LLM client from ResourceManager', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      const client = await module.getLLMClient();
      
      expect(client).toBeDefined();
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.ANTHROPIC_API_KEY');
    });

    it('should reuse existing LLM client', async () => {
      const existingClient = { complete: jest.fn() };
      mockResourceManager.get = jest.fn((key) => {
        if (key === 'llmClient') return existingClient;
        return 'test-api-key';
      });
      
      module = new SDModule({ resourceManager: mockResourceManager });
      const client = await module.getLLMClient();
      
      expect(client).toBe(existingClient);
    });
  });

  describe('getTools', () => {
    it('should return all registered tools', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      const tools = module.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('execute');
    });
  });

  describe('getTool', () => {
    it('should return specific tool by name', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      const tool = module.getTool('parse_requirements');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('parse_requirements');
    });

    it('should return null for non-existent tool', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      const tool = module.getTool('non_existent_tool');
      
      expect(tool).toBeNull();
    });
  });

  describe('getProfiles', () => {
    it('should return list of available profiles', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      const profiles = module.getProfiles();
      
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles[0]).toHaveProperty('name');
      expect(profiles[0]).toHaveProperty('description');
    });
  });

  describe('getProfile', () => {
    it('should return specific profile by name', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      const profile = module.getProfile('sd-full');
      
      expect(profile).toBeDefined();
      expect(profile.name).toBe('sd-full');
      expect(profile.allowableActions).toBeDefined();
      expect(Array.isArray(profile.allowableActions)).toBe(true);
    });
  });

  describe('static create', () => {
    it('should create and initialize module', async () => {
      const module = await SDModule.create(mockResourceManager);
      
      expect(module).toBeDefined();
      expect(module.llmClient).toBeDefined();
      expect(module.tools.size).toBeGreaterThan(0);
    });
  });

  describe('getMetadata', () => {
    it('should return module metadata', async () => {
      module = new SDModule({ resourceManager: mockResourceManager });
      await module.initialize();
      
      const metadata = module.getMetadata();
      
      expect(metadata).toHaveProperty('name', 'sd');
      expect(metadata).toHaveProperty('version', '1.0.0');
      expect(metadata).toHaveProperty('toolCount');
      expect(metadata).toHaveProperty('profileCount');
      expect(metadata.toolCount).toBeGreaterThan(0);
      expect(metadata.profileCount).toBeGreaterThan(0);
    });
  });
});