/**
 * Component Methods Test - Phase 1.1 Feature
 *
 * Tests the new component methods, computed properties, and helper functions feature.
 */

import { ComponentLifecycle } from '../../src/lifecycle/ComponentLifecycle.js';
import { DataStore } from '@legion/data-store';

describe('Component Methods Feature', () => {
  let lifecycle;
  let dataStore;
  let container;

  beforeEach(() => {
    // Create DataStore and ComponentLifecycle
    dataStore = new DataStore();
    lifecycle = new ComponentLifecycle(dataStore);

    // Create container (jsdom provides document)
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await lifecycle.cleanup();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Component Methods', () => {
    test('should define and execute component methods', async () => {
      const dsl = `
        Counter :: state =>
          methods: {
            increment() {
              state.count = state.count + 1
            },
            decrement() {
              state.count = state.count - 1
            },
            reset() {
              state.count = 0
            }
          }
          div.counter [
            div.count { state.count }
            button.increment @click="increment()" { "+" }
            button.decrement @click="decrement()" { "-" }
            button.reset @click="reset()" { "Reset" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, { count: 5 });

      const countDiv = component.getElement('root_child_0');
      const incrementBtn = component.getElement('root_child_1');
      const decrementBtn = component.getElement('root_child_2');
      const resetBtn = component.getElement('root_child_3');

      // Initial state
      expect(countDiv.textContent).toBe('5');

      // Click increment
      incrementBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(countDiv.textContent).toBe('6');

      // Click decrement
      decrementBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(countDiv.textContent).toBe('5');

      // Click reset
      resetBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(countDiv.textContent).toBe('0');
    });

    test('should pass arguments to methods', async () => {
      const dsl = `
        Calculator :: calc =>
          methods: {
            add(amount) {
              calc.total = calc.total + amount
            }
          }
          div.calculator [
            div.total { calc.total }
            button.add5 @click="add(5)" { "+5" }
            button.add10 @click="add(10)" { "+10" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, { total: 0 });

      const totalDiv = component.getElement('root_child_0');
      const add5Btn = component.getElement('root_child_1');
      const add10Btn = component.getElement('root_child_2');

      expect(totalDiv.textContent).toBe('0');

      add5Btn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(totalDiv.textContent).toBe('5');

      add10Btn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(totalDiv.textContent).toBe('15');
    });

    test('should access dataStore in methods', async () => {
      const dsl = `
        User :: user =>
          methods: {
            greet() {
              user.greeting = "Hello, " + user.name + "!"
            }
          }
          div.user [
            input.name value={user.name}
            button.greet @click="greet()" { "Greet" }
            div.greeting { user.greeting }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, {
        name: 'Alice',
        greeting: ''
      });

      const greetBtn = component.getElement('root_child_1');
      const greetingDiv = component.getElement('root_child_2');

      expect(greetingDiv.textContent).toBe('');

      greetBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(greetingDiv.textContent).toBe('Hello, Alice!');
    });
  });

  describe('Computed Properties', () => {
    test('should define and use computed properties', async () => {
      const dsl = `
        Cart :: cart =>
          computed: {
            total() {
              return cart.price * cart.quantity
            }
          }
          methods: {
            incrementQty() {
              cart.quantity = cart.quantity + 1
            }
          }
          div.cart [
            div.price { cart.price }
            div.quantity { cart.quantity }
            div.total { computed.total }
            button.add @click="incrementQty()" { "Add Item" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, {
        price: 10,
        quantity: 2
      });

      const totalDiv = component.getElement('root_child_2');
      const addBtn = component.getElement('root_child_3');

      // Initial computed value: 10 * 2 = 20
      expect(totalDiv.textContent).toBe('20');

      // Increment quantity
      addBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      // New computed value: 10 * 3 = 30
      expect(totalDiv.textContent).toBe('30');
    });

    test('should use computed in expressions', async () => {
      const dsl = `
        Status :: state =>
          computed: {
            isValid() {
              return state.count > 0
            }
          }
          methods: {
            toggle() {
              state.count = computed.isValid ? 0 : 5
            }
          }
          div.status [
            div.count { state.count }
            button.toggle @click="toggle()" { "Toggle" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, { count: 5 });

      const countDiv = component.getElement('root_child_0');
      const toggleBtn = component.getElement('root_child_1');

      expect(countDiv.textContent).toBe('5');

      // First toggle: isValid is true, so set to 0
      toggleBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(countDiv.textContent).toBe('0');

      // Second toggle: isValid is false, so set to 5
      toggleBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(countDiv.textContent).toBe('5');
    });
  });

  describe('Helper Functions', () => {
    test('should register and use helper functions', async () => {
      // Register helper functions
      lifecycle.registerHelper('formatCurrency', (amount) => {
        return '$' + amount.toFixed(2);
      });

      lifecycle.registerHelper('uppercase', (text) => {
        return String(text).toUpperCase();
      });

      const dsl = `
        Product :: product =>
          computed: {
            formattedPrice() {
              return helpers.formatCurrency(product.price)
            }
          }
          methods: {
            updateName() {
              product.displayName = helpers.uppercase(product.name)
            }
          }
          div.product [
            div.price { computed.formattedPrice }
            div.name { product.displayName }
            button.update @click="updateName()" { "Update" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, {
        price: 19.99,
        name: 'widget',
        displayName: 'widget'
      });

      const priceDiv = component.getElement('root_child_0');
      const nameDiv = component.getElement('root_child_1');
      const updateBtn = component.getElement('root_child_2');

      // Check formatted price
      expect(priceDiv.textContent).toBe('$19.99');

      // Update name with uppercase helper
      updateBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(nameDiv.textContent).toBe('WIDGET');
    });

    test('should register multiple helpers at once', async () => {
      lifecycle.registerHelpers({
        double: (n) => n * 2,
        triple: (n) => n * 3
      });

      const dsl = `
        Math :: nums =>
          computed: {
            doubled() {
              return helpers.double(nums.value)
            },
            tripled() {
              return helpers.triple(nums.value)
            }
          }
          div.math [
            div.doubled { computed.doubled }
            div.tripled { computed.tripled }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, { value: 5 });

      const doubledDiv = component.getElement('root_child_0');
      const tripledDiv = component.getElement('root_child_1');

      expect(doubledDiv.textContent).toBe('10');
      expect(tripledDiv.textContent).toBe('15');
    });
  });

  describe('Integration', () => {
    test('should combine methods, computed, and helpers', async () => {
      lifecycle.registerHelper('calculateTax', (amount, rate) => {
        return amount * rate;
      });

      const dsl = `
        Invoice :: invoice =>
          computed: {
            subtotal() {
              return invoice.price * invoice.quantity
            },
            tax() {
              return helpers.calculateTax(computed.subtotal, 0.1)
            },
            total() {
              return computed.subtotal + computed.tax
            }
          }
          methods: {
            addItem() {
              invoice.quantity = invoice.quantity + 1
            }
          }
          div.invoice [
            div.subtotal { computed.subtotal }
            div.tax { computed.tax }
            div.total { computed.total }
            button.add @click="addItem()" { "Add Item" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, {
        price: 100,
        quantity: 2
      });

      const subtotalDiv = component.getElement('root_child_0');
      const taxDiv = component.getElement('root_child_1');
      const totalDiv = component.getElement('root_child_2');
      const addBtn = component.getElement('root_child_3');

      // Initial: 100 * 2 = 200, tax = 20, total = 220
      expect(subtotalDiv.textContent).toBe('200');
      expect(taxDiv.textContent).toBe('20');
      expect(totalDiv.textContent).toBe('220');

      // Add item: 100 * 3 = 300, tax = 30, total = 330
      addBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(subtotalDiv.textContent).toBe('300');
      expect(taxDiv.textContent).toBe('30');
      expect(totalDiv.textContent).toBe('330');
    });
  });

  describe('Error Handling', () => {
    test('should throw error for undefined method', async () => {
      const dsl = `
        App :: state =>
          div.app [
            button.btn @click="undefinedMethod()" { "Click" }
          ]
      `;

      const component = await lifecycle.mount(dsl, container, {});
      const btn = component.getElement('root_child_0');

      // Click should throw error (async event handlers don't throw synchronously in jsdom)
      // Instead, verify the error is thrown when the action is executed
      try {
        component.solver.executeAction('undefinedMethod()');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Method "undefinedMethod" is not defined');
      }
    });

    test('should throw error for undefined computed property', async () => {
      const dsl = `
        App :: state =>
          computed: {
            valid() {
              return computed.nonExistent
            }
          }
          div.app { computed.valid }
      `;

      await expect(lifecycle.mount(dsl, container, {}))
        .rejects.toThrow('Computed property "nonExistent" is not defined');
    });

    test('should throw error for undefined helper function', async () => {
      const dsl = `
        App :: state =>
          computed: {
            result() {
              return helpers.nonExistent(5)
            }
          }
          div.app { computed.result }
      `;

      await expect(lifecycle.mount(dsl, container, {}))
        .rejects.toThrow('Helper function "nonExistent" is not defined');
    });

    test('should throw error for invalid helper registration', () => {
      expect(() => lifecycle.registerHelper('test', 'not a function'))
        .toThrow('Helper must be a function');
    });
  });
});
