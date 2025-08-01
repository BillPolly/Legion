/**
 * Base MVVM Components - Reusable foundation classes for building complex components
 * 
 * This module provides standardized base classes and utilities for creating
 * MVVM components that follow the umbilical protocol. It eliminates boilerplate
 * and ensures consistency across complex components.
 */

// Base classes
export { BaseUmbilicalComponent } from './BaseUmbilicalComponent.js';
export { BaseModel } from './BaseModel.js';
export { BaseView } from './BaseView.js';
export { BaseViewModel } from './BaseViewModel.js';

// Factory and utilities
export { MVVMComponentFactory, createMVVMComponent, wrapMVVMComponent } from './MVVMComponentFactory.js';
export { MVVMTestHelpers } from './MVVMTestHelpers.js';

/**
 * Example usage:
 * 
 * ```javascript
 * import { createMVVMComponent, BaseModel, BaseView, BaseViewModel } from './base/index.js';
 * 
 * class MyModel extends BaseModel {
 *   // Component-specific model logic
 * }
 * 
 * class MyView extends BaseView {
 *   // Component-specific view logic
 * }
 * 
 * class MyViewModel extends BaseViewModel {
 *   // Component-specific coordination logic
 * }
 * 
 * export const MyComponent = createMVVMComponent({
 *   ModelClass: MyModel,
 *   ViewClass: MyView,
 *   ViewModelClass: MyViewModel,
 *   name: 'MyComponent',
 *   defaults: {
 *     theme: 'light',
 *     selectable: true
 *   }
 * });
 * ```
 * 
 * For testing:
 * 
 * ```javascript
 * import { MVVMTestHelpers } from './base/index.js';
 * 
 * describe('MyComponent', MVVMTestHelpers.createTestSuite(
 *   'MyComponent', 
 *   MyComponent,
 *   {
 *     umbilical: { data: mockData },
 *     customTests: [
 *       {
 *         name: 'should handle specific interaction',
 *         test: (component) => {
 *           // Component-specific test logic
 *         }
 *       }
 *     ]
 *   }
 * ));
 * ```
 */