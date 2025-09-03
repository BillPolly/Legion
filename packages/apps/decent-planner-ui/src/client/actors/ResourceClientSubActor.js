/**
 * ResourceClientSubActor - Client-side resource management actor
 * Extends ProtocolActor to provide transparent resource proxy management
 */

import { ProtocolActor } from '../../shared/ProtocolActor.js';
import { TransparentResourceProxy } from '../../shared/resources/TransparentResourceProxy.js';

export class ResourceClientSubActor extends ProtocolActor {
  constructor() {
    super();
    
    this.remoteActor = null;
    this.parentActor = null;
    this.proxies = new Map(); // handleId -> TransparentResourceProxy
    this.pendingCalls = new Map(); // callId -> { resolve, reject }
    this.callCounter = 0;
  }
  
  getProtocol() {
    return {
      name: "ResourceClientActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          proxiesCount: { type: 'number', minimum: 0 }
        },
        initial: {
          connected: false,
          proxiesCount: 0
        }
      },
      
      messages: {
        receives: {
          "resource:handle": {
            schema: {
              handleId: { type: 'string', required: true },
              resourceType: { type: 'string', required: true },
              methodSignatures: { type: 'array', required: true },
              metadata: { type: 'object', required: true }
            },
            preconditions: ["state.connected === true"],
            postconditions: ["state.proxiesCount >= 0"],
            sideEffects: ["createTransparentProxy", "notifyParentActor"]
          },
          
          "resource:result": {
            schema: {
              handleId: { type: 'string', required: true },
              method: { type: 'string', required: true },
              result: { type: 'any' },
              error: { type: 'string' }
            },
            preconditions: ["state.connected === true"],
            sideEffects: ["resolvePendingCall"]
          },
          
          "resource:released": {
            schema: {
              handleId: { type: 'string', required: true }
            },
            postconditions: ["state.proxiesCount >= 0"],
            sideEffects: ["releaseProxy"]
          },
          
          "ready": {
            schema: {
              timestamp: { type: 'string', required: true }
            },
            preconditions: ["state.connected === false"],
            postconditions: ["state.connected === true"]
          }
        },
        
        sends: {
          "resource:request": {
            schema: {
              path: { type: 'string', required: true },
              type: { type: 'string', required: true }
            },
            preconditions: ["state.connected === true"]
          },
          
          "resource:call": {
            schema: {
              handleId: { type: 'string', required: true },
              method: { type: 'string', required: true },
              args: { type: 'array', required: true }
            },
            preconditions: ["state.connected === true"]
          },
          
          "resource:release": {
            schema: {
              handleId: { type: 'string', required: true }
            },
            preconditions: ["state.connected === true"]
          }
        }
      }
    };
  }
  
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    console.log('🎭 Resource client sub-actor connected');
  }
  
  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }
  
  handleMessage(messageType, data) {
    switch (messageType) {
      case 'ready':
        this.state.connected = true;
        break;
        
      case 'resource:handle':
        this.handleResourceHandle(data);
        break;
        
      case 'resource:result':
        this.handleResourceResult(data);
        break;
        
      case 'resource:released':
        this.handleResourceReleased(data);
        break;
        
      default:
        console.warn(`ResourceClientSubActor: Unknown message type: ${messageType}`);
    }
  }
  
  doSend(messageType, data) {
    if (this.remoteActor) {
      return this.remoteActor.receive(messageType, data);
    }
    throw new Error('No remote actor connected');
  }
  
  /**
   * Handle incoming resource handle metadata and create proxy
   */
  handleResourceHandle(data) {
    const { handleId, resourceType, methodSignatures, metadata } = data;
    
    console.log(`Creating proxy for handle ${handleId} (${resourceType})`);
    
    // Create transparent proxy
    const proxy = new TransparentResourceProxy(
      handleId,
      resourceType, 
      methodSignatures,
      this, // Pass this actor as the channel
      metadata // Pass metadata for path access
    );
    
    // Store proxy
    this.proxies.set(handleId, proxy);
    this.state.proxiesCount = this.proxies.size;
    
    // Notify parent actor (chat, show command handler, etc.)
    if (this.parentActor) {
      this.parentActor.receive('resource:ready', {
        path: metadata.path,
        type: metadata.type,
        extension: metadata.extension,
        handle: proxy
      });
    }
  }
  
  /**
   * Handle resource method call results
   */
  handleResourceResult(data) {
    const { handleId, method, result, error } = data;
    
    const callId = `${handleId}-${method}`;
    const pendingCall = this.pendingCalls.get(callId);
    
    if (pendingCall) {
      this.pendingCalls.delete(callId);
      
      if (error) {
        pendingCall.reject(new Error(error));
      } else {
        pendingCall.resolve(result);
      }
    }
  }
  
  /**
   * Handle resource release notification
   */
  handleResourceReleased(data) {
    const { handleId } = data;
    
    console.log(`Releasing proxy for handle ${handleId}`);
    this.proxies.delete(handleId);
    this.state.proxiesCount = this.proxies.size;
  }
  
  /**
   * Call a method on a resource handle (used by TransparentResourceProxy)
   * @param {string} handleId - Handle identifier
   * @param {string} method - Method name to call
   * @param {Array} args - Method arguments
   * @returns {Promise} Promise that resolves with method result
   */
  async callResourceMethod(handleId, method, args) {
    const callId = `${handleId}-${method}`;
    
    // Send call to server
    await this.send('resource:call', {
      handleId,
      method,
      args
    });
    
    // Return promise that will be resolved by handleResourceResult
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(callId, { resolve, reject });
    });
  }
  
  /**
   * Create a proxy from serialization data (used by ActorSerializer)
   * @param {Object} handleData - Serialized handle data
   * @returns {TransparentResourceProxy} Proxy object
   */
  createProxyFromData(handleData) {
    const { handleId, resourceType, methodSignatures, metadata } = handleData;
    
    const proxy = new TransparentResourceProxy(
      handleId,
      resourceType,
      methodSignatures,
      this,
      metadata
    );
    
    this.proxies.set(handleId, proxy);
    this.state.proxiesCount = this.proxies.size;
    
    return proxy;
  }
  
  /**
   * Request a resource handle from the server
   * @param {string} path - Resource path
   * @param {string} type - Resource type (file, image, directory)
   */
  async requestResource(path, type) {
    return this.send('resource:request', { path, type });
  }
  
  /**
   * Release a resource handle
   * @param {string} handleId - Handle to release
   */
  async releaseResource(handleId) {
    // Remove local proxy
    this.proxies.delete(handleId);
    this.state.proxiesCount = this.proxies.size;
    
    // Notify server
    return this.send('resource:release', { handleId });
  }
}