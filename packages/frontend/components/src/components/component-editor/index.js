/**
 * ComponentEditor - Umbilical Component for Editing Components
 * Phase 5.4
 *
 * Provides umbilical interface for creating component editor instances
 */

import { ComponentEditorModel } from './src/model/ComponentEditorModel.js';
import { ComponentEditorView } from './src/view/ComponentEditorView.js';
import { ComponentEditorViewModel } from './src/viewmodel/ComponentEditorViewModel.js';

export const ComponentEditor = {
  /**
   * Create component editor instance via umbilical interface
   *
   * REQUIRED umbilical properties:
   * - dom: HTMLElement - Container for editor UI
   * - componentStore: ComponentLibraryHandle - Component storage
   *
   * OPTIONAL umbilical properties:
   * - dataStore: DataStore - For preview components (enables live preview)
   * - testRunner: ComponentTestRunner - For testing components (optional)
   * - initialComponent: string - Component ID to load initially
   * - theme: 'light'|'dark' - Visual theme (default: 'light')
   * - onComponentSaved: Function - Callback when component saved
   * - onComponentDeleted: Function - Callback when component deleted
   * - onClose: Function - Callback when editor closes
   */
  create(umbilical) {
    // Validate required dependencies
    if (!umbilical || !umbilical.dom) {
      throw new Error('ComponentEditor: "dom" parameter is required');
    }
    if (!umbilical.componentStore) {
      throw new Error('ComponentEditor: "componentStore" parameter is required');
    }

    // Extract umbilical properties
    const {
      dom,
      componentStore,
      dataStore,
      previewManager, // Optional: for testing purposes
      testRunner, // Optional: for testing purposes
      initialComponent,
      theme,
      onComponentSaved,
      onComponentDeleted,
      onClose,
    } = umbilical;

    // Create MVVM layers
    const model = new ComponentEditorModel({ componentStore, testRunner });
    const view = new ComponentEditorView({ dom, theme });
    const viewModel = new ComponentEditorViewModel({ model, view, dataStore, previewManager });

    // Load initial component if provided
    if (initialComponent) {
      // Async load, don't block construction
      viewModel.loadComponent(initialComponent).catch(error => {
        console.error('Failed to load initial component:', error.message);
      });
    }

    // Track if destroyed
    let isDestroyed = false;

    // Public API
    const editor = {
      /**
       * Load component by ID
       */
      async loadComponent(componentId) {
        if (isDestroyed) {
          throw new Error('Editor has been destroyed');
        }
        return await viewModel.loadComponent(componentId);
      },

      /**
       * Save current component
       */
      async saveComponent() {
        if (isDestroyed) {
          throw new Error('Editor has been destroyed');
        }
        const component = await viewModel.handleSave();

        // Call onComponentSaved callback if provided
        if (onComponentSaved && model.currentComponent) {
          onComponentSaved(model.currentComponent);
        }

        return model.currentComponent;
      },

      /**
       * Delete current component
       */
      async deleteComponent() {
        if (isDestroyed) {
          throw new Error('Editor has been destroyed');
        }

        const componentId = model.currentComponent ? model.currentComponent.id : null;
        const result = await model.deleteComponent();

        // Call onComponentDeleted callback if provided
        if (result && onComponentDeleted && componentId) {
          onComponentDeleted(componentId);
        }

        return result;
      },

      /**
       * Destroy editor and cleanup
       */
      destroy() {
        if (isDestroyed) {
          return; // Already destroyed, do nothing
        }

        isDestroyed = true;

        // Cleanup ViewModel
        if (viewModel && viewModel.destroy) {
          viewModel.destroy();
        }

        // Cleanup View
        if (view && view.destroy) {
          view.destroy();
        }

        // Call onClose callback if provided
        if (onClose) {
          onClose();
        }
      },

      // Internal properties for testing
      viewModel,
      model,
      view
    };

    return editor;
  }
};
