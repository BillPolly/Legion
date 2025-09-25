/**
 * Tests for reactive schema change notifications
 */

import { DynamicDataStore, createDynamicDataStore } from '../src/DynamicDataStore.js';
import { SchemaNotificationSystem } from '../src/SchemaNotificationSystem.js';

describe('Schema Notifications', () => {
  let dataStore;
  
  beforeEach(() => {
    // Create store with initial schema
    dataStore = createDynamicDataStore({
      schema: {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      }
    });
  });
  
  describe('SchemaNotificationSystem', () => {
    it('should create notification system', () => {
      const notificationSystem = new SchemaNotificationSystem();
      expect(notificationSystem).toBeDefined();
      expect(notificationSystem.getStats().totalSubscriptions).toBe(0);
    });
    
    it('should subscribe to global schema changes', () => {
      const notificationSystem = new SchemaNotificationSystem();
      const changes = [];
      
      // Subscribe globally
      const subscription = notificationSystem.subscribe({
        callback: (change) => changes.push(change)
      });
      
      // Notify changes
      notificationSystem.notify({
        type: 'addAttribute',
        entityType: 'user',
        attributeName: 'age',
        version: 1
      });
      
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('addAttribute');
      
      // Unsubscribe
      subscription.unsubscribe();
      
      // Should not receive after unsubscribe
      notificationSystem.notify({
        type: 'removeAttribute',
        entityType: 'user',
        attributeName: 'email'
      });
      
      expect(changes).toHaveLength(1);
    });
    
    it('should filter notifications by entity type', () => {
      const notificationSystem = new SchemaNotificationSystem();
      const userChanges = [];
      const productChanges = [];
      
      // Subscribe to user changes
      notificationSystem.subscribe({
        entityType: 'user',
        callback: (change) => userChanges.push(change)
      });
      
      // Subscribe to product changes
      notificationSystem.subscribe({
        entityType: 'product',
        callback: (change) => productChanges.push(change)
      });
      
      // Notify user change
      notificationSystem.notify({
        type: 'addAttribute',
        entityType: 'user',
        attributeName: 'age'
      });
      
      // Notify product change
      notificationSystem.notify({
        type: 'addAttribute',
        entityType: 'product',
        attributeName: 'price'
      });
      
      expect(userChanges).toHaveLength(1);
      expect(userChanges[0].entityType).toBe('user');
      expect(productChanges).toHaveLength(1);
      expect(productChanges[0].entityType).toBe('product');
    });
    
    it('should filter by attribute name', () => {
      const notificationSystem = new SchemaNotificationSystem();
      const ageChanges = [];
      
      // Subscribe to age attribute changes
      notificationSystem.subscribe({
        entityType: 'user',
        attributeName: 'age',
        callback: (change) => ageChanges.push(change)
      });
      
      // Notify age change
      notificationSystem.notify({
        type: 'addAttribute',
        entityType: 'user',
        attributeName: 'age'
      });
      
      // Notify email change (should not receive)
      notificationSystem.notify({
        type: 'addAttribute',
        entityType: 'user',
        attributeName: 'email'
      });
      
      expect(ageChanges).toHaveLength(1);
      expect(ageChanges[0].attributeName).toBe('age');
    });
    
    it('should batch notifications', (done) => {
      const notificationSystem = new SchemaNotificationSystem();
      const batches = [];
      
      // Subscribe with batching (immediate: false)
      notificationSystem.subscribe({
        immediate: false,
        callback: (changes) => batches.push(changes)
      });
      
      // Send multiple notifications
      notificationSystem.notify({ type: 'change1' });
      notificationSystem.notify({ type: 'change2' });
      notificationSystem.notify({ type: 'change3' });
      
      // Should batch in next microtask
      queueMicrotask(() => {
        expect(batches).toHaveLength(1);
        expect(batches[0]).toHaveLength(3);
        expect(batches[0].map(c => c.type)).toEqual(['change1', 'change2', 'change3']);
        done();
      });
    });
    
    it('should provide statistics', () => {
      const notificationSystem = new SchemaNotificationSystem();
      
      // Add subscriptions
      notificationSystem.subscribe({
        callback: () => {}
      });
      
      notificationSystem.subscribe({
        entityType: 'user',
        callback: () => {}
      });
      
      notificationSystem.subscribe({
        entityType: 'product',
        callback: () => {}
      });
      
      const stats = notificationSystem.getStats();
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.globalSubscriptions).toBe(1);
      expect(stats.typeSubscriptions).toBe(2);
      expect(stats.subscriptionsByType.user).toBe(1);
      expect(stats.subscriptionsByType.product).toBe(1);
    });
    
    it('should create filtered view', () => {
      const notificationSystem = new SchemaNotificationSystem();
      const userChanges = [];
      
      // Create filtered view for user entity
      const userView = notificationSystem.createFilteredView('user');
      
      // Subscribe through view
      userView.subscribe((change) => userChanges.push(change));
      
      // Notify through view (automatically adds entityType)
      userView.notify({
        type: 'addAttribute',
        attributeName: 'age'
      });
      
      expect(userChanges).toHaveLength(1);
      expect(userChanges[0].entityType).toBe('user');
    });
  });
  
  describe('DynamicDataStore Integration', () => {
    it('should notify on attribute addition', async () => {
      const changes = [];
      
      // Subscribe to schema changes
      const subscription = dataStore.subscribeToSchema({
        callback: (change) => changes.push(change)
      });
      
      // Add attribute
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('addAttribute');
      expect(changes[0].entityType).toBe('user');
      expect(changes[0].attributeName).toBe('age');
      expect(changes[0].fullAttribute).toBe(':user/age');
      
      subscription.unsubscribe();
    });
    
    it('should notify on entity type addition', async () => {
      const changes = [];
      
      // Subscribe to schema changes
      dataStore.subscribeToSchema((change) => changes.push(change));
      
      // Add entity type
      await dataStore.addEntityType('product', {
        ':product/name': { valueType: 'string' },
        ':product/price': { valueType: 'number' }
      });
      
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('addEntityType');
      expect(changes[0].entityType).toBe('product');
    });
    
    it('should filter notifications by entity type', async () => {
      const userChanges = [];
      const productChanges = [];
      
      // Subscribe to user changes only
      dataStore.subscribeToSchema({
        entityType: 'user',
        callback: (change) => userChanges.push(change)
      });
      
      // Subscribe to product changes only
      dataStore.subscribeToSchema({
        entityType: 'product',
        callback: (change) => productChanges.push(change)
      });
      
      // Add user attribute
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      // Add product type
      await dataStore.addEntityType('product', {
        ':product/name': { valueType: 'string' }
      });
      
      // Add product attribute
      await dataStore.addAttribute('product', 'price', { valueType: 'number' });
      
      // Check filtered results
      expect(userChanges).toHaveLength(1);
      expect(userChanges[0].entityType).toBe('user');
      
      expect(productChanges).toHaveLength(2); // Entity type + attribute
      expect(productChanges.every(c => c.entityType === 'product')).toBe(true);
    });
    
    it('should provide notification statistics', async () => {
      // Add some subscriptions
      dataStore.subscribeToSchema(() => {});
      dataStore.subscribeToSchema({ entityType: 'user', callback: () => {} });
      dataStore.subscribeToSchema({ entityType: 'product', callback: () => {} });
      
      const stats = dataStore.getNotificationStats();
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.globalSubscriptions).toBe(1);
      expect(stats.typeSubscriptions).toBe(2);
    });
    
    it('should create entity type view', async () => {
      const userChanges = [];
      
      // Create view for user entity
      const userView = dataStore.createSchemaView('user');
      
      // Subscribe through view
      userView.subscribe((change) => userChanges.push(change));
      
      // Add attribute (should receive)
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      // Add product entity (should not receive)
      await dataStore.addEntityType('product', {
        ':product/name': { valueType: 'string' }
      });
      
      expect(userChanges).toHaveLength(1);
      expect(userChanges[0].entityType).toBe('user');
    });
    
    it('should maintain backward compatibility', async () => {
      const legacyChanges = [];
      const modernChanges = [];
      
      // Legacy subscription method
      const unsubscribe = dataStore.subscribeToSchemaChanges((change) => {
        legacyChanges.push(change);
      });
      
      // Modern subscription method
      const subscription = dataStore.subscribeToSchema((change) => {
        modernChanges.push(change);
      });
      
      // Add attribute
      await dataStore.addAttribute('user', 'age', { valueType: 'number' });
      
      // Both should receive the change
      expect(legacyChanges).toHaveLength(1);
      expect(modernChanges).toHaveLength(1);
      expect(legacyChanges[0]).toEqual(modernChanges[0]);
      
      // Cleanup
      unsubscribe();
      subscription.unsubscribe();
    });
  });
});