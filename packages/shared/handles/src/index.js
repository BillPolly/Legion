/**
 * Legion Shared Handle System
 * 
 * Main exports for the handle system including base classes,
 * specialized handles, and utility classes.
 */

// Core classes
export { BaseHandle } from './BaseHandle.js';
export { TypeHandle } from './TypeHandle.js';
export { TypeHandleRegistry } from './TypeHandleRegistry.js';
export { HandleRegistry } from './HandleRegistry.js';
export { RemoteHandle, createRemoteHandleProxy } from './RemoteHandle.js';

// Utility classes
export { HandleCache } from './HandleCache.js';
export { HandleSubscriptions } from './HandleSubscriptions.js';

// Specialized handle implementations
export { FileHandle } from './handles/FileHandle.js';

// Convenience exports  
export const createGlobalRegistry = () => {
  const { TypeHandleRegistry } = await import('./TypeHandleRegistry.js');
  return TypeHandleRegistry.getGlobalRegistry();
};

export const registerHandleType = async (name, metadata) => {
  const { TypeHandleRegistry } = await import('./TypeHandleRegistry.js');
  return TypeHandleRegistry.getGlobalRegistry().registerType(name, metadata);
};

export const autoRegisterHandle = async (HandleClass) => {
  const { TypeHandleRegistry } = await import('./TypeHandleRegistry.js');
  return TypeHandleRegistry.getGlobalRegistry().autoRegisterFromClass(HandleClass);
};