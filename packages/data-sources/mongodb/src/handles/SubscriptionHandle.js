/**
 * SubscriptionHandle - Represents a MongoDB change stream subscription
 * 
 * This Handle is returned immediately from subscribe() calls and manages
 * the lifecycle of a change stream subscription.
 * 
 * Pattern:
 * 1. subscribe() returns SubscriptionHandle immediately (synchronous)
 * 2. Change stream is set up in background
 * 3. When changes occur, callbacks are invoked
 * 4. Unsubscribe() closes the change stream
 */

import { Handle } from '@legion/handle';

export class SubscriptionHandle extends Handle {
  constructor(dataSource, subscriptionSpec) {
    super(dataSource);
    
    this.subscriptionSpec = subscriptionSpec;
    this.callback = subscriptionSpec.callback;
    this._active = true;
    this._changeStream = null;
    this._error = null;
    
    // Generate unique subscription ID
    this.subscriptionId = dataSource._subscriptionId++;
    
    // Start change stream setup immediately
    this._setupChangeStream();
  }
  
  /**
   * Get subscription status
   */
  value() {
    return {
      active: this._active,
      subscriptionId: this.subscriptionId,
      level: this.subscriptionSpec.level,
      database: this.subscriptionSpec.database,
      collection: this.subscriptionSpec.collection,
      pipeline: this.subscriptionSpec.pipeline
    };
  }
  
  /**
   * Check if subscription is active
   */
  isActive() {
    return this._active;
  }
  
  /**
   * Check if subscription has error
   */
  hasError() {
    return this._error !== null;
  }
  
  /**
   * Get error if one occurred
   */
  getError() {
    return this._error;
  }
  
  /**
   * Unsubscribe from change stream
   */
  unsubscribe() {
    if (!this._active) {
      return;
    }
    
    this._active = false;
    
    // Close change stream if it exists
    if (this._changeStream) {
      try {
        this._changeStream.close();
      } catch (error) {
        console.error('Error closing change stream:', error);
      }
    }
    
    // Remove from data source's subscription map
    this.dataSource._subscriptions.delete(this.subscriptionId);
    this.dataSource._changeStreams.delete(this.subscriptionId);
  }
  
  /**
   * Alias for unsubscribe
   */
  close() {
    this.unsubscribe();
  }
  
  /**
   * Set up change stream asynchronously
   * @private
   */
  _setupChangeStream() {
    const setupAsync = async () => {
      try {
        const { level, database, collection, pipeline } = this.subscriptionSpec;
        const client = this.dataSource.client;
        
        // Ensure connection
        if (!this.dataSource.connected) {
          await client.connect();
          this.dataSource.connected = true;
        }
        
        let changeStream;
        
        // Create change stream based on level
        switch (level) {
          case 'server':
            // Watch all changes on the server
            changeStream = client.watch(pipeline || []);
            break;
            
          case 'database':
            // Watch changes on specific database
            const db = client.db(database);
            changeStream = db.watch(pipeline || []);
            break;
            
          case 'collection':
            // Watch changes on specific collection
            const coll = client.db(database).collection(collection);
            changeStream = coll.watch(pipeline || []);
            break;
            
          case 'document':
            // Watch changes on specific document (using pipeline filter)
            const docColl = client.db(database).collection(collection);
            changeStream = docColl.watch(pipeline || []);
            break;
            
          default:
            throw new Error(`Unsupported subscription level: ${level}`);
        }
        
        // Store change stream
        this._changeStream = changeStream;
        
        // Store in data source's maps
        this.dataSource._subscriptions.set(this.subscriptionId, this);
        this.dataSource._changeStreams.set(this.subscriptionId, changeStream);
        
        // Set up change listener
        changeStream.on('change', (change) => {
          if (this._active && this.callback) {
            try {
              this.callback(change);
            } catch (error) {
              console.error('Error in subscription callback:', error);
            }
          }
        });
        
        // Handle errors
        changeStream.on('error', (error) => {
          this._error = error;
          if (this._active && this.callback) {
            try {
              this.callback(null, error);
            } catch (callbackError) {
              console.error('Error in subscription error callback:', callbackError);
            }
          }
        });
        
        // Handle close
        changeStream.on('close', () => {
          this._active = false;
        });
        
      } catch (error) {
        this._error = error;
        this._active = false;
        
        // Notify callback of setup error
        if (this.callback) {
          try {
            this.callback(null, error);
          } catch (callbackError) {
            console.error('Error in subscription setup error callback:', callbackError);
          }
        }
      }
    };
    
    // Start async setup
    setupAsync();
  }
}