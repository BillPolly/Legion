/**
 * Basic smoke test for data-store package
 */

import { ImmutableDataStore, createDataStore } from '../src/index.js';

describe('DataStore Package', () => {
  it('should export ImmutableDataStore', () => {
    expect(ImmutableDataStore).toBeDefined();
    expect(typeof ImmutableDataStore).toBe('function');
  });

  it('should export createDataStore helper', () => {
    expect(createDataStore).toBeDefined();
    expect(typeof createDataStore).toBe('function');
  });

  it('should create working data store instance', () => {
    const store = createDataStore();
    expect(store).toBeInstanceOf(ImmutableDataStore);
    expect(store.getEdgeCount()).toBe(0);
    expect(store.getConstraintCount()).toBe(0);
  });
});