/**
 * ImageHandle - Handle implementation for image assets
 *
 * Extends Handle to provide image access through the Handle/DataSource pattern.
 * When serialized and sent to client, becomes a RemoteHandle that can call
 * getData() and other methods asynchronously through Actor messages.
 */

import { Handle } from '@legion/handle';

export class ImageHandle extends Handle {
  /**
   * Create an ImageHandle
   * @param {Object} imageData - Image asset data
   * @param {string} imageData.id - Image identifier
   * @param {string} imageData.title - Image title
   * @param {string} imageData.type - Image MIME type
   * @param {string} imageData.data - Image data (base64 or data URL)
   * @param {number} imageData.width - Image width
   * @param {number} imageData.height - Image height
   */
  constructor(imageData) {
    // Create a simple DataSource that serves this image's data
    const dataSource = {
      // Query returns the image data
      query: (querySpec) => {
        if (querySpec?.read) {
          // Return image data for read operations
          return Promise.resolve([imageData.data]);
        }
        // Return metadata for other queries
        return Promise.resolve([{
          id: imageData.id,
          title: imageData.title,
          type: imageData.type,
          width: imageData.width,
          height: imageData.height
        }]);
      },

      // Subscribe not needed for static images
      subscribe: () => {
        throw new Error('ImageHandle does not support subscriptions');
      },

      // queryBuilder for Handle-based queries
      queryBuilder: () => {
        throw new Error('ImageHandle does not support queryBuilder');
      },

      // Schema describes the image structure
      getSchema: () => ({
        type: 'image',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          type: { type: 'string' },
          data: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' }
        }
      })
    };

    // Call Handle constructor with DataSource
    super(dataSource);

    // Store image information
    this.imageData = imageData;
    this._handleType = 'ImageHandle';
  }

  /**
   * Get image data asynchronously
   * This method will be callable on RemoteHandle via Proxy
   * @returns {Promise<string>} Image data (base64 or data URL)
   */
  async getData() {
    // On server: return data directly
    // On client (RemoteHandle): this call is proxied via _callRemote()
    return this.imageData.data;
  }

  /**
   * Get image metadata
   * @returns {Promise<Object>} Image metadata
   */
  async getMetadata() {
    return {
      id: this.imageData.id,
      title: this.imageData.title,
      type: this.imageData.type,
      width: this.imageData.width,
      height: this.imageData.height
    };
  }

  /**
   * Get image type/MIME type
   * @returns {Promise<string>} Image type
   */
  async getType() {
    return this.imageData.type;
  }

  /**
   * Get image title
   * @returns {Promise<string>} Image title
   */
  async getTitle() {
    return this.imageData.title;
  }

  /**
   * Serialize Handle for transmission to client
   * Returns metadata needed for RemoteHandle creation
   * @returns {Object} Serialization data
   */
  serialize() {
    // Get base capabilities from parent Handle class
    const baseSerialize = super.serialize ? super.serialize() : {
      __type: 'RemoteHandle',
      handleType: this._handleType || this.constructor.name,
      schema: this.dataSource.getSchema(),
      capabilities: ['query', 'subscribe', 'getSchema', 'queryBuilder']
    };

    // Add ImageHandle-specific capabilities
    const customCapabilities = ['getData', 'getMetadata', 'getType', 'getTitle'];

    return {
      ...baseSerialize,
      capabilities: [...baseSerialize.capabilities, ...customCapabilities]
    };
  }

  // Note: receive() is handled by parent Handle class
  // Handle._handleRemoteCall() will call our getData(), getMetadata(), etc. methods
}