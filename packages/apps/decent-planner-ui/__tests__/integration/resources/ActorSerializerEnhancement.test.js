/**
 * Integration tests for enhanced ActorSerializer with resource handle support
 * Tests that existing ActorSerializer can handle TransparentResourceProxy serialization
 */

import { jest } from '@jest/globals';

describe('ActorSerializer Resource Handle Enhancement', () => {
  let mockActorSpace;
  let mockChannel;
  let serializer;
  
  beforeEach(async () => {
    // Create mock actor space
    mockActorSpace = {
      spaceId: 'test-space',
      objectToGuid: new Map(),
      guidToObject: new Map(),
      _generateGuid: jest.fn(() => 'generated-guid'),
      makeRemote: jest.fn(),
      getResourceClientActor: jest.fn()
    };
    
    mockChannel = {
      sendResourceCall: jest.fn()
    };
    
    // Import the EXISTING ActorSerializer (not a custom one)
    const { ActorSerializer } = await import('@legion/actors');
    serializer = new ActorSerializer(mockActorSpace);
  });

  describe('Resource Handle Serialization Detection', () => {
    test('should detect resource handles without enhancement yet', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const proxy = new TransparentResourceProxy(
        'test-handle-123',
        'FileHandle',
        ['read', 'write'],
        mockChannel
      );
      
      const testData = { handle: proxy };
      
      // Before enhancement - this should just work with existing toJSON
      const serialized = serializer.serialize(testData);
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.handle).toBeDefined();
    });
  });

  describe('Resource Handle Deserialization', () => {
    test('should handle resource handle data in deserialization', async () => {
      const { ResourceClientSubActor } = await import('../../../src/client/actors/ResourceClientSubActor.js');
      
      const mockResourceClient = new ResourceClientSubActor();
      mockActorSpace.getResourceClientActor.mockReturnValue(mockResourceClient);
      mockActorSpace.guidToObject.set('resource-client-sub', mockResourceClient);
      
      const handleData = {
        handle: {
          __type: 'ResourceHandle',
          handleId: 'test-handle-456',
          resourceType: 'ImageHandle',
          methodSignatures: ['getData', 'getUrl']
        }
      };
      
      // After enhancement - should reconstruct proxy
      const result = serializer.deserialize(JSON.stringify(handleData), mockChannel);
      
      // Should be reconstructed as TransparentResourceProxy
      expect(result.handle.__isResourceHandle).toBe(true);
      expect(result.handle.__handleId).toBe('test-handle-456');
      expect(result.handle.__resourceType).toBe('ImageHandle');
    });
  });

  describe('Mixed Object Handling', () => {
    test('should handle objects with both actors and resource handles', async () => {
      const { TransparentResourceProxy } = await import('../../../src/shared/resources/TransparentResourceProxy.js');
      
      const mockActor = { isActor: true, isRemote: false };
      mockActorSpace.objectToGuid.set(mockActor, 'actor-guid-123');
      
      const proxy = new TransparentResourceProxy(
        'mixed-handle',
        'FileHandle',
        ['read'],
        mockChannel
      );
      
      const mixedData = {
        actor: mockActor,
        handle: proxy,
        message: 'test'
      };
      
      const serialized = serializer.serialize(mixedData);
      const parsed = JSON.parse(serialized);
      
      // Actor should be serialized as GUID
      expect(parsed.actor['#actorGuid']).toBe('actor-guid-123');
      
      // Handle should be serialized as handle data
      expect(parsed.handle.handleId).toBe('mixed-handle');
      
      // Normal data preserved
      expect(parsed.message).toBe('test');
    });
  });
});