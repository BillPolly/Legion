/**
 * TransparentResourceProxy - Creates transparent proxy objects for remote resources
 * 
 * Uses JavaScript Proxy API to intercept method calls and route them through 
 * the actor protocol, making remote resources appear identical to local resources.
 */

export class TransparentResourceProxy {
  /**
   * Create a transparent resource proxy
   * @param {string} handleId - Unique handle identifier
   * @param {string} resourceType - Type of resource (FileHandle, ImageHandle, etc.)
   * @param {Array<string>} methodSignatures - Available method names
   * @param {Object} actorChannel - Actor channel for remote communication
   */
  constructor(handleId, resourceType, methodSignatures, actorChannel) {
    if (!actorChannel) {
      throw new Error('Actor channel is required for resource proxy');
    }
    
    // Store metadata on the target object
    this.__handleId = handleId;
    this.__resourceType = resourceType;
    this.__methodSignatures = methodSignatures;
    this.__actorChannel = actorChannel;
    this.__isResourceHandle = true;
    
    // Return a Proxy that intercepts all property access
    return new Proxy(this, {
      get(target, prop) {
        // Return metadata properties directly
        if (prop.startsWith('__') || prop === 'getSerializationData') {
          return target[prop];
        }
        
        // Handle JSON serialization by providing toJSON method
        if (prop === 'toJSON') {
          return () => target.getSerializationData();
        }
        
        // Check if this is a known method
        if (methodSignatures.includes(prop)) {
          // Return a function that routes the call through actor channel
          return (...args) => {
            return actorChannel.callResourceMethod(handleId, prop, args);
          };
        }
        
        // Handle Jest matcher methods silently
        if (typeof prop === 'string' && (prop.includes('asymmetric') || prop.includes('Symbol'))) {
          return undefined;
        }
        
        // For unknown methods, throw error (fail fast)
        if (typeof target[prop] === 'undefined') {
          throw new Error(`Method ${prop} not available on ${resourceType}`);
        }
        
        // Return the original property
        return target[prop];
      },
      
      has(target, prop) {
        // Proxy has all the method signatures plus metadata
        return methodSignatures.includes(prop) || 
               prop.startsWith('__') || 
               prop === 'getSerializationData' ||
               prop in target;
      }
    });
  }
  
  /**
   * Get serialization data for this handle
   * @returns {Object} Serialization metadata
   */
  getSerializationData() {
    return {
      handleId: this.__handleId,
      resourceType: this.__resourceType,
      methodSignatures: this.__methodSignatures
    };
  }
}