/**
 * E2E Integration Test for AssetHandle with RemoteHandle
 *
 * Tests that AssetHandle works properly through RemoteHandle when sent
 * from server to client via Actor channels.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AssetHandle } from '../../src/handles/AssetHandleV2.js';
import { ActorSpace } from '@legion/actors';
import { ActorSerializer } from '@legion/actors';
import { Channel } from '@legion/actors';
import { RemoteHandle } from '@legion/handle';

// Register RemoteHandle for deserialization
ActorSerializer.registerRemoteHandle(RemoteHandle);

describe('AssetHandle E2E with RemoteHandle', () => {
  let serverSpace;
  let clientSpace;
  let serverSerializer;
  let clientSerializer;
  let serverChannel;
  let clientChannel;

  beforeEach(() => {
    // Create two ActorSpaces (server and client)
    serverSpace = new ActorSpace('server');
    clientSpace = new ActorSpace('client');

    serverSerializer = new ActorSerializer(serverSpace);
    clientSerializer = new ActorSerializer(clientSpace);

    // Create bidirectional WebSocket mock
    const mockServerWs = {
      send: (data) => {
        setImmediate(() => {
          if (mockClientWs.onmessage) {
            mockClientWs.onmessage({ data });
          }
        });
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const mockClientWs = {
      send: (data) => {
        setImmediate(() => {
          if (mockServerWs.onmessage) {
            mockServerWs.onmessage({ data });
          }
        });
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    // Create Channels
    serverChannel = new Channel(serverSpace, mockServerWs);
    clientChannel = new Channel(clientSpace, mockClientWs);
  });

  describe('Image Asset Display', () => {
    it('should send cat image Handle and receive RemoteHandle', async () => {
      // Server: Create AssetHandle for a cat image
      const catImageData = {
        id: 'cat-001',
        assetType: 'image',
        title: 'Cute Cat Picture',
        asset: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...',
        width: 800,
        height: 600
      };

      const serverAssetHandle = new AssetHandle(catImageData);

      // Verify server handle works locally
      expect(serverAssetHandle.getType()).toBe('image');
      expect(serverAssetHandle.getTitle()).toBe('Cute Cat Picture');

      const metadata = serverAssetHandle.getMetadata();
      expect(metadata.id).toBe('cat-001');
      expect(metadata.type).toBe('image');

      // Server: Serialize and send to client
      const serialized = serverSerializer.serialize({ asset: serverAssetHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);

      const clientAssetHandle = deserialized.asset;

      // Client: Should receive RemoteHandle
      expect(clientAssetHandle).toBeInstanceOf(RemoteHandle);
      expect(clientAssetHandle.isRemote).toBe(true);

      // Client: Call methods through RemoteHandle (async via remote-call protocol)
      const remoteType = await clientAssetHandle.getType();
      expect(remoteType).toBe('image');

      const remoteTitle = await clientAssetHandle.getTitle();
      expect(remoteTitle).toBe('Cute Cat Picture');

      const remoteMetadata = await clientAssetHandle.getMetadata();
      expect(remoteMetadata.id).toBe('cat-001');
      expect(remoteMetadata.type).toBe('image');
      expect(remoteMetadata.title).toBe('Cute Cat Picture');

      const remoteData = await clientAssetHandle.getData();
      expect(remoteData.assetType).toBe('image');
      expect(remoteData.width).toBe(800);
      expect(remoteData.height).toBe(600);
    });

    it('should handle multiple asset types', async () => {
      // Test different asset types
      const assets = [
        { id: 'img-1', assetType: 'image', title: 'Image', asset: 'imagedata' },
        { id: 'json-1', assetType: 'json', title: 'Data', asset: { foo: 'bar' } },
        { id: 'text-1', assetType: 'text', title: 'Document', asset: 'Hello World' }
      ];

      for (const assetData of assets) {
        const serverHandle = new AssetHandle(assetData);
        const serialized = serverSerializer.serialize({ asset: serverHandle });
        const deserialized = clientSerializer.deserialize(serialized, clientChannel);
        const clientHandle = deserialized.asset;

        expect(clientHandle).toBeInstanceOf(RemoteHandle);

        const type = await clientHandle.getType();
        expect(type).toBe(assetData.assetType);

        const title = await clientHandle.getTitle();
        expect(title).toBe(assetData.title);
      }
    });
  });

  describe('Asset Queries', () => {
    it('should query asset properties through RemoteHandle', async () => {
      const assetData = {
        id: 'test-asset',
        assetType: 'data',
        title: 'Test Data',
        asset: { name: 'test', value: 42 }
      };

      const serverHandle = new AssetHandle(assetData);
      const serialized = serverSerializer.serialize({ asset: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      const clientHandle = deserialized.asset;

      // Query through RemoteHandle
      const queryResult = await clientHandle.query({ property: 'title' });
      expect(queryResult).toEqual(['Test Data']);
    });
  });

  describe('Schema Access', () => {
    it('should access asset schema without remote call', () => {
      const assetData = {
        id: 'test-asset',
        assetType: 'image',
        title: 'Test Image',
        asset: 'data:image...'
      };

      const serverHandle = new AssetHandle(assetData);
      const serialized = serverSerializer.serialize({ asset: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      const clientHandle = deserialized.asset;

      // Schema should be cached from serialization (synchronous)
      const schema = clientHandle.getSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('asset');
      expect(schema.assetType).toBe('image');
    });
  });

  describe('Error Handling', () => {
    it('should handle server-side errors', async () => {
      // Create asset with DataSource that throws
      const assetData = {
        id: 'error-asset',
        assetType: 'test',
        title: 'Error Test',
        asset: 'test'
      };

      const serverHandle = new AssetHandle(assetData);

      // Override getData to throw
      serverHandle.dataSource.getData = () => {
        throw new Error('Data retrieval failed');
      };

      const serialized = serverSerializer.serialize({ asset: serverHandle });
      const deserialized = clientSerializer.deserialize(serialized, clientChannel);
      const clientHandle = deserialized.asset;

      // Error should propagate to client
      await expect(clientHandle.getData()).rejects.toThrow('Data retrieval failed');
    });
  });
});