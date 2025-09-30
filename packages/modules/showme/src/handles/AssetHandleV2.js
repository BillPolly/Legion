/**
 * AssetHandle - Handle implementation for display assets
 *
 * Extends Handle (not Actor) to work with RemoteHandle pattern.
 * When sent through Actor channel, client receives RemoteHandle proxy
 * that can call methods transparently.
 *
 * This replaces the old AssetHandle that extended Actor.
 */

import { Handle } from '@legion/handle';
import { AssetDataSource } from './AssetDataSource.js';

export class AssetHandle extends Handle {
  constructor(assetData) {
    // Create DataSource for the asset
    const dataSource = new AssetDataSource(assetData);

    // Initialize Handle with DataSource
    super(dataSource);

    // Store asset properties for quick access
    this.assetId = dataSource.assetId;
    this.assetType = dataSource.assetType;
    this.title = dataSource.title;
  }

  /**
   * REQUIRED: Get current value
   * Returns the full asset data
   */
  value() {
    this._validateNotDestroyed();
    return this.dataSource.getData();
  }

  /**
   * REQUIRED: Execute query
   */
  query(querySpec) {
    this._validateNotDestroyed();
    // DataSource does its own validation
    return this.dataSource.query(querySpec);
  }

  /**
   * Get asset metadata
   * This method will work transparently through RemoteHandle
   */
  getMetadata() {
    this._validateNotDestroyed();
    return this.dataSource.getMetadata();
  }

  /**
   * Get asset data/content
   * This method will work transparently through RemoteHandle
   */
  getData() {
    this._validateNotDestroyed();
    return this.dataSource.getData();
  }

  /**
   * Get asset type
   * This method will work transparently through RemoteHandle
   */
  getType() {
    this._validateNotDestroyed();
    return this.dataSource.getType();
  }

  /**
   * Get asset title
   * This method will work transparently through RemoteHandle
   */
  getTitle() {
    this._validateNotDestroyed();
    return this.dataSource.getTitle();
  }
}