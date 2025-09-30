/**
 * AssetDataSource - DataSource implementation for display assets
 *
 * Provides a simple DataSource for assets that can be displayed in UI.
 * Works with the Handle/RemoteHandle pattern for transparent remote access.
 */

import { validateDataSourceInterface } from '@legion/handle';

export class AssetDataSource {
  constructor(assetData) {
    // Store asset data
    this.data = assetData;
    this.assetId = assetData.id || `asset-${Date.now()}`;
    this.assetType = assetData.assetType || assetData.type || 'unknown';
    this.title = assetData.title || 'Untitled';
    this.timestamp = assetData.timestamp || Date.now();

    // Validate DataSource interface
    validateDataSourceInterface(this, 'AssetDataSource');
  }

  /**
   * REQUIRED: Execute query against the asset data
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    // Simple property access queries
    if (querySpec.property) {
      const value = this.data[querySpec.property];
      return value !== undefined ? [value] : [];
    }

    // Return full asset data by default
    return [this.data];
  }

  /**
   * REQUIRED: Set up subscription for change notifications
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    // Assets are typically immutable, but support subscriptions for consistency
    // Return a no-op subscription
    return {
      id: `sub-${Date.now()}`,
      unsubscribe: () => {
        // No-op for immutable assets
      }
    };
  }

  /**
   * REQUIRED: Get resource schema for introspection
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    // Infer schema from asset data
    return {
      type: 'asset',
      assetType: this.assetType,
      attributes: {
        id: { type: 'string', value: this.assetId },
        assetType: { type: 'string', value: this.assetType },
        title: { type: 'string', value: this.title },
        timestamp: { type: 'number', value: this.timestamp }
      }
    };
  }

  /**
   * REQUIRED: Get query builder
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    // Return simple query builder
    return {
      where: () => this,
      select: () => this,
      toArray: () => [this.data]
    };
  }

  /**
   * Get asset metadata
   */
  getMetadata() {
    return {
      id: this.assetId,
      type: this.assetType,
      title: this.title,
      timestamp: this.timestamp
    };
  }

  /**
   * Get asset data/content (returns full data object)
   */
  getData() {
    return this.data;
  }

  /**
   * Get asset type
   */
  getType() {
    return this.assetType;
  }

  /**
   * Get asset title
   */
  getTitle() {
    return this.title;
  }
}