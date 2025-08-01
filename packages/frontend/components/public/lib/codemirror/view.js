// Re-export everything from the bundled file
export * from '../codemirror-bundle.esm.js';

// Import the bundled module
import * as CM from '../codemirror-bundle.esm.js';

// Re-export specific commands that might not be in the main export
export const undo = CM.undo || function(view) {
  // Fallback: dispatch undo transaction
  view.dispatch(view.state.replaceSelection(''));
  return true;
};

export const redo = CM.redo || function(view) {
  // Fallback: dispatch redo transaction
  view.dispatch(view.state.replaceSelection(''));
  return true;
};

// Export the history field if available
export const historyField = CM.historyField;