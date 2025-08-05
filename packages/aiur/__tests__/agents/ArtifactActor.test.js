import { jest } from '@jest/globals';
import { ArtifactActor } from '../../src/agents/ArtifactActor.js';
import { ArtifactManager } from '../../src/agents/artifacts/ArtifactManager.js';

describe('ArtifactActor', () => {
  let artifactActor;
  let artifactManager;
  let mockResourceManager;
  let mockLLMClient;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      complete: jest.fn()
    };

    // Create mock resource manager
    mockResourceManager = {
      createLLMClient: jest.fn().mockResolvedValue(mockLLMClient)
    };

    // Create real artifact manager
    artifactManager = new ArtifactManager({ sessionId: 'test-session' });

    // Create artifact actor
    artifactActor = new ArtifactActor({
      sessionId: 'test-session',
      artifactManager: artifactManager,
      resourceManager: mockResourceManager,
      enableCuration: true
    });
  });

  afterEach(() => {
    if (artifactActor) {
      artifactActor.destroy();
    }
    if (artifactManager) {
      artifactManager.destroy();
    }
  });

  describe('initialization', () => {
    test('should initialize with LLM client when resource manager provided', async () => {
      await artifactActor.initialize();

      expect(mockResourceManager.createLLMClient).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        maxRetries: 2
      });
      expect(artifactActor.llmClient).toBe(mockLLMClient);
    });

    test('should disable curation if LLM client fails to initialize', async () => {
      mockResourceManager.createLLMClient.mockRejectedValue(new Error('No API key'));
      
      await artifactActor.initialize();

      expect(artifactActor.curationConfig.enableCuration).toBe(false);
    });
  });

  describe('processToolResult', () => {
    test('should detect and store image artifacts', async () => {
      const toolResult = {
        success: true,
        imageData: 'data:image/png;base64,iVBORw0KGgo...',
        filename: 'test-image.png',
        metadata: {
          prompt: 'A test image',
          model: 'dall-e-3'
        }
      };

      // Mock LLM curation response
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        keep: [
          {
            index: 0,
            label: '@test-image',
            description: 'Generated test image'
          }
        ],
        discard: []
      }));

      await artifactActor.initialize();
      const result = await artifactActor.processToolResult({
        toolName: 'generate_image',
        toolResult: toolResult,
        context: { userMessage: 'Generate a test image' }
      });

      expect(result.success).toBe(true);
      expect(result.artifactsDetected).toBe(1);
      expect(result.artifactsStored).toBe(1);
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].label).toBe('@test-image');
      expect(result.artifacts[0].description).toBe('Generated test image');

      // Verify artifact is in manager
      const artifact = artifactManager.getArtifactByLabel('@test-image');
      expect(artifact).toBeTruthy();
      expect(artifact.type).toBe('image');
    });

    test('should detect and store text analysis artifacts', async () => {
      const toolResult = {
        success: true,
        analysis: 'This image shows a beautiful sunset over mountains...',
        file: {
          name: 'sunset.jpg',
          type: 'image',
          mimeType: 'image/jpeg'
        },
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022'
      };

      // Mock LLM curation response
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        keep: [
          {
            index: 0,
            label: '@sunset-analysis',
            description: 'Analysis of sunset image showing mountains'
          }
        ],
        discard: []
      }));

      await artifactActor.initialize();
      const result = await artifactActor.processToolResult({
        toolName: 'analyze_file',
        toolResult: toolResult,
        context: { userMessage: 'Analyze the sunset image' }
      });

      expect(result.success).toBe(true);
      expect(result.artifactsStored).toBe(1);
      expect(result.artifacts[0].label).toBe('@sunset-analysis');
      expect(result.artifacts[0].type).toBe('text');
      expect(result.artifacts[0].subtype).toBe('analysis');
      expect(result.artifacts[0].content).toBe(toolResult.analysis);
    });

    test('should auto-label artifacts when curation is disabled', async () => {
      // Create actor with curation disabled
      artifactActor = new ArtifactActor({
        sessionId: 'test-session',
        artifactManager: artifactManager,
        enableCuration: false
      });

      const toolResult = {
        success: true,
        imageUrl: 'https://example.com/image.png',
        filename: 'test.png'
      };

      const result = await artifactActor.processToolResult({
        toolName: 'generate_image',
        toolResult: toolResult
      });

      expect(result.success).toBe(true);
      expect(result.artifacts[0].label).toBe('@image1');
      expect(result.artifacts[0].curated).toBe(false);
    });

    test('should handle multiple artifacts from single tool', async () => {
      // Create mock tool result that would generate multiple artifacts
      const toolResult = {
        success: true,
        files: ['file1.txt', 'file2.txt', 'file3.txt'],
        path: '/tmp/output',
        content: 'Some generated content'
      };

      // Mock LLM curation - keep 2, discard 1
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        keep: [
          {
            index: 0,
            label: '@output-dir',
            description: 'Directory listing with 3 files'
          },
          {
            index: 1,
            label: '@generated-content',
            description: 'The generated content output'
          }
        ],
        discard: [2]
      }));

      await artifactActor.initialize();
      const result = await artifactActor.processToolResult({
        toolName: 'directory_list',
        toolResult: toolResult
      });

      expect(result.success).toBe(true);
      expect(result.artifactsDetected).toBeGreaterThan(0);
      expect(result.artifactsStored).toBe(2); // Only kept 2
    });

    test('should handle curation errors gracefully', async () => {
      const toolResult = {
        success: true,
        imageData: 'data:image/png;base64,abc',
        filename: 'test.png'
      };

      // Mock LLM to return invalid JSON
      mockLLMClient.complete.mockResolvedValue('Invalid JSON response');

      await artifactActor.initialize();
      const result = await artifactActor.processToolResult({
        toolName: 'generate_image',
        toolResult: toolResult
      });

      // Should fall back to auto-labeling
      expect(result.success).toBe(true);
      expect(result.artifacts[0].label).toBe('@image1');
      expect(result.artifacts[0].curated).toBe(false);
    });
  });

  describe('artifact context', () => {
    test('should generate proper context for LLM', async () => {
      // Manually add some artifacts
      artifactManager.registerArtifact({
        type: 'image',
        subtype: 'png',
        title: 'cat-image.png',
        label: '@cat-image',
        description: 'A cute cat with a laser gun',
        path: '/tmp/cat-image.png'
      });

      artifactManager.registerArtifact({
        type: 'text',
        subtype: 'analysis',
        title: 'Analysis of cat-image.png',
        label: '@cat-analysis',
        description: 'Detailed analysis of the sci-fi cat image',
        content: 'The image shows a futuristic cat...'
      });

      const context = artifactManager.getArtifactContext();
      
      expect(context).toContain('Available artifacts you can reference:');
      expect(context).toContain('@cat-image: "cat-image.png" (image/png) - A cute cat with a laser gun');
      expect(context).toContain('@cat-analysis: "Analysis of cat-image.png" (text/analysis) - Detailed analysis of the sci-fi cat image');
      expect(context).toContain('To use an artifact in a tool call, reference it by its label');
    });
  });

  describe('label management', () => {
    test('should track artifact counts by type', async () => {
      // Create actor and process multiple artifacts
      artifactActor = new ArtifactActor({
        sessionId: 'test-session',
        artifactManager: artifactManager,
        enableCuration: false // Use auto-labeling
      });

      // Process first image
      await artifactActor.processToolResult({
        toolName: 'generate_image',
        toolResult: { success: true, imageUrl: 'url1', filename: 'img1.png' }
      });

      // Process second image
      await artifactActor.processToolResult({
        toolName: 'generate_image',
        toolResult: { success: true, imageUrl: 'url2', filename: 'img2.png' }
      });

      // Process text
      await artifactActor.processToolResult({
        toolName: 'analyze_file',
        toolResult: { success: true, analysis: 'Some analysis', file: { name: 'test.txt' } }
      });

      // Check labels
      const artifacts = artifactManager.getAllArtifacts();
      const labels = artifacts.map(a => a.label);
      
      expect(labels).toContain('@image1');
      expect(labels).toContain('@image2');
      expect(labels).toContain('@text1');
    });
  });

  describe('artifact lookup', () => {
    test('should retrieve artifacts by label', () => {
      const artifact = {
        type: 'image',
        title: 'test.png',
        label: '@my-image',
        content: 'image-data'
      };

      artifactManager.registerArtifact(artifact);

      // Test retrieval by label
      const retrieved = artifactManager.getArtifactByLabel('@my-image');
      expect(retrieved).toBeTruthy();
      expect(retrieved.title).toBe('test.png');

      // Test retrieval by identifier (label)
      const byIdentifier = artifactManager.getArtifactByIdentifier('@my-image');
      expect(byIdentifier).toBeTruthy();
      expect(byIdentifier.title).toBe('test.png');
    });

    test('should return null for non-existent labels', () => {
      const artifact = artifactManager.getArtifactByLabel('@non-existent');
      expect(artifact).toBeNull();
    });
  });
});