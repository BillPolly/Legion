import { Actor } from '@legion/actors';

/**
 * AssetHandle - Actor wrapper for display assets
 *
 * Extends Actor (not Handle) to work as a remote proxy.
 * When sent through Actor channel, client receives RemoteActor proxy
 * that can call methods on this server-side actor.
 *
 * Since Actor protocol doesn't have automatic return values,
 * this actor PUSHES data back through the display-asset event pattern.
 */
export class AssetHandle extends Actor {
  constructor(assetData, serverActor) {
    super();
    this.assetData = assetData;
    this.assetId = assetData.id || `asset-${Date.now()}`;
    this.assetType = assetData.assetType || 'unknown';
    this.title = assetData.title || 'Untitled';
    this.serverActor = serverActor; // Reference to server actor for push-back
  }

  /**
   * Get asset metadata
   * Since Actor protocol doesn't return values across WebSocket,
   * this pushes the metadata back through the server actor
   */
  getMetadata() {
    const metadata = {
      id: this.assetId,
      type: this.assetType,
      title: this.title,
      timestamp: this.assetData.timestamp || Date.now()
    };

    // Push metadata back through server actor
    if (this.serverActor && this.serverActor.broadcast) {
      this.serverActor.broadcast('asset-metadata', {
        assetId: this.assetId,
        metadata
      });
    }

    return metadata; // Local return (not sent back through WebSocket)
  }

  /**
   * Get asset data
   * Pushes the actual asset data back through server actor
   */
  getData() {
    const data = this.assetData.asset || this.assetData.data;

    // Push data back through server actor
    if (this.serverActor && this.serverActor.broadcast) {
      this.serverActor.broadcast('asset-data', {
        assetId: this.assetId,
        data
      });
    }

    return data; // Local return (not sent back through WebSocket)
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