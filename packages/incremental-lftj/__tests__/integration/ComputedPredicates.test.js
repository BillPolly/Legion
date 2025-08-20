import { ComputeNode } from '../../src/ComputeNode.js';
import { ScanNode } from '../../src/ScanNode.js';
import { JoinNode } from '../../src/JoinNode.js';
import { ProjectNode } from '../../src/ProjectNode.js';
import { UnionNode } from '../../src/UnionNode.js';
import { EnumerableProvider, PointwiseProvider } from '../../src/ComputeProvider.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, ID, BooleanAtom } from '../../src/Atom.js';
import { Node } from '../../src/Node.js';

// Mock output node for capturing emissions
class MockOutputNode extends Node {
  constructor(id) {
    super(id);
    this.receivedDeltas = [];
  }

  onDeltaReceived(source, delta) {
    this.receivedDeltas.push({ source, delta });
  }

  processDelta(delta) {
    return delta;
  }
}

// Example enumerable provider: external API data
class ProductCatalogProvider extends EnumerableProvider {
  constructor() {
    super('product-catalog');
    this._products = new Map();
    this._changes = [];
    this._nextId = 1;
  }

  enumerate() {
    return new Set(this._products.values());
  }

  deltaSince(stateHandle) {
    if (stateHandle >= this._changes.length) {
      return { adds: new Set(), removes: new Set() };
    }

    const adds = new Set();
    const removes = new Set();

    for (let i = stateHandle; i < this._changes.length; i++) {
      const change = this._changes[i];
      if (change.type === 'add') {
        adds.add(change.tuple);
      } else {
        removes.add(change.tuple);
      }
    }

    return { adds, removes };
  }

  // API simulation methods
  addProduct(name, price, category) {
    const id = this._nextId++;
    const tuple = new Tuple([new ID(`p${id}`), new StringAtom(name), new Integer(price), new StringAtom(category)]);
    this._products.set(id, tuple);
    this._changes.push({ type: 'add', tuple });
    return tuple;
  }

  removeProduct(id) {
    if (this._products.has(id)) {
      const tuple = this._products.get(id);
      this._products.delete(id);
      this._changes.push({ type: 'remove', tuple });
      return tuple;
    }
  }
}

// Example pointwise provider: business rules
class PriceValidationProvider extends PointwiseProvider {
  constructor(minPrice = 0, maxPrice = 1000) {
    super('price-validation');
    this._minPrice = minPrice;
    this._maxPrice = maxPrice;
  }

  evalMany(candidates) {
    const result = new Set();
    for (const tuple of candidates) {
      // For user tuples: position 1 (user_id, budget)
      // For product tuples: position 2 (product_id, name, price, category)
      // Try position 2 first, fall back to position 1
      const price = tuple.atoms[2] ? tuple.atoms[2].value : tuple.atoms[1].value;
      if (price >= this._minPrice && price <= this._maxPrice) {
        result.add(tuple);
      }
    }
    return result;
  }
}

// Advanced pointwise provider with flip support
class InventoryStatusProvider extends PointwiseProvider {
  constructor() {
    super('inventory-status');
    this._inventory = new Map(); // productId -> stock level
    this._flipHistory = [];
  }

  evalMany(candidates) {
    const result = new Set();
    for (const tuple of candidates) {
      // Assume product ID is at position 0
      const productId = tuple.atoms[0].value;
      const stock = this._inventory.get(productId) || 0;
      if (stock > 0) {
        result.add(tuple);
      }
    }
    return result;
  }

  flipsSince(stateHandle, watched) {
    if (stateHandle >= this._flipHistory.length) {
      return { true: new Set(), false: new Set() };
    }

    const trueFlips = new Set();
    const falseFlips = new Set();

    for (let i = stateHandle; i < this._flipHistory.length; i++) {
      const flip = this._flipHistory[i];
      if (flip === null) continue; // Skip padding entries
      
      // Find tuples in watched set that match this product ID
      for (const tuple of watched) {
        if (tuple.atoms[0].value === flip.productId) {
          if (flip.inStock) {
            trueFlips.add(tuple);
          } else {
            falseFlips.add(tuple);
          }
        }
      }
    }

    return { true: trueFlips, false: falseFlips };
  }

  // API simulation methods
  updateStock(productId, newStock) {
    const oldStock = this._inventory.get(productId) || 0;
    this._inventory.set(productId, newStock);

    // Record flip if stock status changed
    const wasInStock = oldStock > 0;
    const isInStock = newStock > 0;
    if (wasInStock !== isInStock) {
      // Pad flip history to current state handle if needed
      while (this._flipHistory.length < this._stateHandle) {
        this._flipHistory.push(null);
      }
      this._flipHistory.push({ productId, inStock: isInStock });
    }
  }
}

describe('Computed Predicates Integration', () => {
  describe('enumerable compute nodes', () => {
    it('should integrate with external data sources as leaf nodes', () => {
      // Setup: External product catalog + price filter
      const catalogProvider = new ProductCatalogProvider();
      const catalogCompute = new ComputeNode('productCatalog', catalogProvider);

      const mockOutput = new MockOutputNode('output');
      catalogCompute.addOutput(mockOutput);

      // Start with empty catalog, then add products incrementally
      
      // Add first batch of products
      catalogProvider.addProduct('Laptop', 999, 'Electronics');
      catalogProvider.addProduct('Mouse', 25, 'Electronics');
      
      catalogCompute.pushDelta(new Delta(new Set(), new Set()));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(2);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(0);

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Add new product dynamically
      catalogProvider.addProduct('Keyboard', 75, 'Electronics');
      
      catalogCompute.pushDelta(new Delta(new Set(), new Set()));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBeGreaterThanOrEqual(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(0);

      // Verify that Keyboard is among the new products
      const newProducts = Array.from(mockOutput.receivedDeltas[0].delta.adds);
      const productNames = newProducts.map(p => p.atoms[1].value);
      expect(productNames).toContain('Keyboard');
      
      // Verify Keyboard details
      const keyboardProduct = newProducts.find(p => p.atoms[1].value === 'Keyboard');
      expect(keyboardProduct.atoms[2].value).toBe(75);
    });

    it('should handle product removals and updates', () => {
      const catalogProvider = new ProductCatalogProvider();
      const catalogCompute = new ComputeNode('productCatalog', catalogProvider);

      const mockOutput = new MockOutputNode('output');
      catalogCompute.addOutput(mockOutput);

      // Setup initial products
      const laptop = catalogProvider.addProduct('Laptop', 999, 'Electronics');
      const mouse = catalogProvider.addProduct('Mouse', 25, 'Electronics');
      
      // Trigger initial processing
      catalogCompute.pushDelta(new Delta(new Set(), new Set()));
      mockOutput.receivedDeltas = [];

      // Remove a product
      catalogProvider.removeProduct(1); // Remove laptop

      catalogCompute.pushDelta(new Delta(new Set(), new Set()));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBeGreaterThanOrEqual(1);

      // Verify that Laptop was removed
      const removedProducts = Array.from(mockOutput.receivedDeltas[0].delta.removes);
      const removedNames = removedProducts.map(p => p.atoms[1].value);
      expect(removedNames).toContain('Laptop');
    });
  });

  describe('pointwise compute nodes', () => {
    it('should filter tuples based on business rules', () => {
      // Setup: User data → Price validation filter
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'budget', type: 'Integer' }
      ]);

      const userScan = new ScanNode('users', 'Users', userSchema, true);
      
      // Price validation: budget between 50 and 500
      const priceProvider = new PriceValidationProvider(50, 500);
      const priceFilter = new ComputeNode('priceFilter', priceProvider);

      // Connect pipeline
      userScan.addOutput(priceFilter);

      const mockOutput = new MockOutputNode('output');
      priceFilter.addOutput(mockOutput);

      // Test with various budgets
      const user1 = new Tuple([new ID('u1'), new Integer(25)]);   // Too low
      const user2 = new Tuple([new ID('u2'), new Integer(100)]);  // Valid
      const user3 = new Tuple([new ID('u3'), new Integer(750)]);  // Too high
      const user4 = new Tuple([new ID('u4'), new Integer(300)]);  // Valid

      userScan.pushDelta(new Delta(new Set([user1, user2, user3, user4])));

      // Should only emit valid users
      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(2);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(0);

      const validUsers = Array.from(mockOutput.receivedDeltas[0].delta.adds);
      const validIds = validUsers.map(u => u.atoms[0].value);
      expect(validIds).toContain('u2');
      expect(validIds).toContain('u4');
      expect(validIds).not.toContain('u1');
      expect(validIds).not.toContain('u3');
    });

    it('should handle truth changes and removals correctly', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'budget', type: 'Integer' }
      ]);

      const userScan = new ScanNode('users', 'Users', userSchema, true);
      const priceProvider = new PriceValidationProvider(50, 500);
      const priceFilter = new ComputeNode('priceFilter', priceProvider);

      userScan.addOutput(priceFilter);
      const mockOutput = new MockOutputNode('output');
      priceFilter.addOutput(mockOutput);

      // Add valid user
      const user1 = new Tuple([new ID('u1'), new Integer(100)]);
      userScan.pushDelta(new Delta(new Set([user1])));

      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(1);

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Remove user
      userScan.pushDelta(new Delta(new Set(), new Set([user1])));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(0);

      const removedUser = Array.from(mockOutput.receivedDeltas[0].delta.removes)[0];
      expect(removedUser.atoms[0].value).toBe('u1');
    });
  });

  describe('advanced scenarios with flip support', () => {
    it('should handle inventory status changes via provider flips', () => {
      // Setup: Product scan → Inventory status filter
      const productSchema = new Schema([
        { name: 'product_id', type: 'ID' },
        { name: 'name', type: 'String' },
        { name: 'price', type: 'Integer' }
      ]);

      const productScan = new ScanNode('products', 'Products', productSchema, true);
      
      const inventoryProvider = new InventoryStatusProvider();
      const inventoryFilter = new ComputeNode('inventoryFilter', inventoryProvider);

      productScan.addOutput(inventoryFilter);
      const mockOutput = new MockOutputNode('output');
      inventoryFilter.addOutput(mockOutput);

      // Add products
      const laptop = new Tuple([new ID('p1'), new StringAtom('Laptop'), new Integer(999)]);
      const mouse = new Tuple([new ID('p2'), new StringAtom('Mouse'), new Integer(25)]);

      // Initially no stock
      productScan.pushDelta(new Delta(new Set([laptop, mouse])));

      // No products should be emitted (no stock)
      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(0);

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Update inventory: add stock for laptop
      inventoryProvider.updateStock('p1', 10);

      // Process flip changes (simulate next batch) - use pushDelta to trigger output
      inventoryFilter.pushDelta(new Delta(new Set(), new Set()));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(0);

      const inStockProduct = Array.from(mockOutput.receivedDeltas[0].delta.adds)[0];
      expect(inStockProduct.atoms[0].value).toBe('p1');

      // Clear outputs
      mockOutput.receivedDeltas = [];

      // Update inventory: remove stock for laptop
      inventoryProvider.updateStock('p1', 0);

      inventoryFilter.pushDelta(new Delta(new Set(), new Set()));

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.removes.size).toBe(1);
      expect(mockOutput.receivedDeltas[0].delta.adds.size).toBe(0);

      const outOfStockProduct = Array.from(mockOutput.receivedDeltas[0].delta.removes)[0];
      expect(outOfStockProduct.atoms[0].value).toBe('p1');
    });
  });

  describe('complex operator combinations', () => {
    it('should integrate enumerable and pointwise compute in a pipeline', () => {
      // Pipeline: External catalog → Price filter → Union with manual products
      const catalogProvider = new ProductCatalogProvider();
      const catalogCompute = new ComputeNode('catalog', catalogProvider);

      const priceProvider = new PriceValidationProvider(0, 100); // Under $100
      const priceFilter = new ComputeNode('priceFilter', priceProvider);

      const manualSchema = new Schema([
        { name: 'product_id', type: 'ID' },
        { name: 'name', type: 'String' },
        { name: 'price', type: 'Integer' },
        { name: 'category', type: 'String' }
      ]);
      const manualScan = new ScanNode('manual', 'ManualProducts', manualSchema, true);

      const union = new UnionNode('allAffordableProducts');

      // Connect pipeline
      catalogCompute.addOutput(priceFilter);
      priceFilter.addOutput(union);
      manualScan.addOutput(union);

      const mockOutput = new MockOutputNode('output');
      union.addOutput(mockOutput);

      // Setup initial catalog products
      catalogProvider.addProduct('Expensive Laptop', 999, 'Electronics'); // Will be filtered out
      catalogProvider.addProduct('Cheap Mouse', 25, 'Electronics');       // Will pass filter
      
      // Trigger catalog processing
      catalogCompute.pushDelta(new Delta(new Set(), new Set()));

      // Add manual products
      const manualProduct = new Tuple([new ID('m1'), new StringAtom('Manual Product'), new Integer(50), new StringAtom('Tools')]);
      manualScan.pushDelta(new Delta(new Set([manualProduct])));

      // Should have union of filtered catalog + manual products
      const allDeltas = mockOutput.receivedDeltas;
      const totalAdds = allDeltas.reduce((sum, d) => sum + d.delta.adds.size, 0);

      expect(totalAdds).toBe(2); // Cheap mouse + manual product

      // Verify no expensive laptop
      const allProducts = [];
      allDeltas.forEach(d => {
        d.delta.adds.forEach(tuple => allProducts.push(tuple));
      });

      const productNames = allProducts.map(p => p.atoms[1].value);
      expect(productNames).toContain('Cheap Mouse');
      expect(productNames).toContain('Manual Product');
      expect(productNames).not.toContain('Expensive Laptop');
    });

    it('should work with projections and complex schemas', () => {
      // Pipeline: Catalog → Filter → Project to (name, price)
      const catalogProvider = new ProductCatalogProvider();
      const catalogCompute = new ComputeNode('catalog', catalogProvider);

      const priceProvider = new PriceValidationProvider(0, 200);
      const priceFilter = new ComputeNode('priceFilter', priceProvider);

      const projection = new ProjectNode('namePrice', [1, 2]); // name, price only

      // Connect pipeline
      catalogCompute.addOutput(priceFilter);
      priceFilter.addOutput(projection);

      const mockOutput = new MockOutputNode('output');
      projection.addOutput(mockOutput);

      // Add products
      catalogProvider.addProduct('Affordable Laptop', 150, 'Electronics');
      catalogProvider.addProduct('Expensive Tablet', 500, 'Electronics');
      catalogProvider.addProduct('Cheap Mouse', 20, 'Electronics');

      // Trigger catalog processing
      catalogCompute.pushDelta(new Delta(new Set(), new Set()));

      // Should project only affordable products
      const allDeltas = mockOutput.receivedDeltas;
      const totalAdds = allDeltas.reduce((sum, d) => sum + d.delta.adds.size, 0);

      expect(totalAdds).toBe(2); // Laptop and mouse, not tablet

      // Verify projected tuples have only 2 attributes
      const projectedProducts = [];
      allDeltas.forEach(d => {
        d.delta.adds.forEach(tuple => projectedProducts.push(tuple));
      });

      projectedProducts.forEach(tuple => {
        expect(tuple.arity).toBe(2);
        expect(tuple.atoms[0]).toBeInstanceOf(StringAtom); // name
        expect(tuple.atoms[1]).toBeInstanceOf(Integer);    // price
      });
    });
  });

  describe('performance and scalability', () => {
    it('should handle large datasets efficiently', () => {
      const catalogProvider = new ProductCatalogProvider();
      const catalogCompute = new ComputeNode('catalog', catalogProvider);

      const priceProvider = new PriceValidationProvider(0, 500);
      const priceFilter = new ComputeNode('priceFilter', priceProvider);

      catalogCompute.addOutput(priceFilter);
      const mockOutput = new MockOutputNode('output');
      priceFilter.addOutput(mockOutput);

      // Add many products
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const price = Math.floor(Math.random() * 1000); // 0-999
        catalogProvider.addProduct(`Product${i}`, price, 'Category');
      }

      catalogCompute.pushDelta(new Delta(new Set(), new Set()));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(100); // 100ms

      // Verify filtering worked correctly
      const allDeltas = mockOutput.receivedDeltas;
      const totalAdds = allDeltas.reduce((sum, d) => sum + d.delta.adds.size, 0);

      // Should have some products under $500
      expect(totalAdds).toBeGreaterThan(0);
      expect(totalAdds).toBeLessThanOrEqual(100);

      // Verify all emitted products are under $500
      const allProducts = [];
      allDeltas.forEach(d => {
        d.delta.adds.forEach(tuple => allProducts.push(tuple));
      });

      allProducts.forEach(product => {
        expect(product.atoms[2].value).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty provider results gracefully', () => {
      const emptyProvider = new ProductCatalogProvider();
      const emptyCompute = new ComputeNode('empty', emptyProvider);

      const mockOutput = new MockOutputNode('output');
      emptyCompute.addOutput(mockOutput);

      // Cold start with no products
      const delta = emptyCompute.coldStart();

      expect(delta.adds.size).toBe(0);
      expect(delta.removes.size).toBe(0);
      expect(mockOutput.receivedDeltas.length).toBe(0);
    });

    it('should handle provider that always rejects', () => {
      const userSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'value', type: 'Integer' }
      ]);

      const userScan = new ScanNode('users', 'Users', userSchema, true);
      
      // Predicate that always returns false
      const rejectProvider = new PriceValidationProvider(1000, 2000); // Impossible range
      const rejectFilter = new ComputeNode('rejectFilter', rejectProvider);

      userScan.addOutput(rejectFilter);
      const mockOutput = new MockOutputNode('output');
      rejectFilter.addOutput(mockOutput);

      // Add users with various values
      const users = [
        new Tuple([new ID('u1'), new Integer(100)]),
        new Tuple([new ID('u2'), new Integer(200)]),
        new Tuple([new ID('u3'), new Integer(300)])
      ];

      userScan.pushDelta(new Delta(new Set(users)));

      // Should emit a delta (even if empty adds)
      expect(mockOutput.receivedDeltas.length).toBeGreaterThanOrEqual(1);
      
      // Find the delta from the reject filter (may be multiple deltas in pipeline)
      const rejectDelta = mockOutput.receivedDeltas.find(d => d.source === rejectFilter);
      if (rejectDelta) {
        expect(rejectDelta.delta.adds.size).toBe(0);
        expect(rejectDelta.delta.removes.size).toBe(0);
      }

      // Verify internal state
      expect(rejectFilter.getWatchSet().size).toBe(3); // All watched
      expect(rejectFilter.getTruthMap().size).toBe(3); // All false
    });
  });
});