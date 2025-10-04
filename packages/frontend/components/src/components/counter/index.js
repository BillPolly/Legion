import { UmbilicalUtils, UmbilicalError } from '@legion/components';

/**
 * Counter Component
 * 
 * Pure state management component - no DOM knowledge.
 * Manages numeric state and exposes increment/decrement operations.
 */
export const Counter = {
  /**
   * Create a Counter instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('initialValue', 'number', 'Starting counter value (optional, defaults to 0)');
      requirements.add('onChange', 'function', 'Callback fired when counter value changes');
      requirements.add('onIncrement', 'function', 'Callback fired when counter is incremented (optional)');
      requirements.add('onDecrement', 'function', 'Callback fired when counter is decremented (optional)');
      requirements.add('onReset', 'function', 'Callback fired when counter is reset (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasOnChange: typeof umbilical.onChange === 'function',
        hasValidInitialValue: umbilical.initialValue === undefined || typeof umbilical.initialValue === 'number'
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['onChange'], 'Counter');

    // Initialize state
    let value = umbilical.initialValue || 0;

    // Internal state change handler
    const notifyChange = (newValue, action) => {
      const oldValue = value;
      value = newValue;
      
      // Always notify main onChange
      umbilical.onChange(value, oldValue, action);
      
      // Notify specific action callbacks if provided
      if (action === 'increment' && umbilical.onIncrement) {
        umbilical.onIncrement(value, oldValue);
      } else if (action === 'decrement' && umbilical.onDecrement) {
        umbilical.onDecrement(value, oldValue);
      } else if (action === 'reset' && umbilical.onReset) {
        umbilical.onReset(value, oldValue);
      }
    };

    // Create instance interface
    const instance = {
      // State access
      get value() {
        return value;
      },

      // Operations
      increment(amount = 1) {
        notifyChange(value + amount, 'increment');
      },

      decrement(amount = 1) {
        notifyChange(value - amount, 'decrement');
      },

      reset(newValue = umbilical.initialValue || 0) {
        notifyChange(newValue, 'reset');
      },

      setValue(newValue) {
        if (typeof newValue !== 'number') {
          throw new UmbilicalError('Counter value must be a number', 'Counter');
        }
        notifyChange(newValue, 'set');
      }
    };

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    if (umbilical.onDestroy) {
      instance.destroy = () => umbilical.onDestroy(instance);
    }

    return instance;
  }
};