/**
 * @legion/components - Umbilical Component Protocol
 * Main exports for all components
 */

// Utilities (MUST be first - components depend on these)
export { UmbilicalUtils, UmbilicalError } from './umbilical/index.js';

// Core Components
export { Button } from './components/button/index.js';
export { Counter } from './components/counter/index.js';
export { Display } from './components/display/index.js';
export { Window } from './components/window/index.js';
export { ContextMenu } from './components/context-menu/index.js';
export { Divider } from './components/divider/index.js';
export { Tabs } from './components/tabs/index.js';

// Base MVVM Classes (MUST be before components that use them)
export { BaseModel, BaseView, BaseViewModel, BaseUmbilicalComponent } from './components/base/index.js';

// Visual Components
export { ImageViewer } from './components/image-viewer/index.js';
export { SimpleImage } from './components/simple-image/index.js';
export { CodeEditor } from './components/code-editor/index.js';
export { MarkdownRenderer } from './components/markdown-renderer/index.js';

// Data Components
export { Grid } from './components/grid/index.js';
export { Tree } from './components/tree/index.js';
export { ModernTree } from './components/modern-tree/index.js';

// Field Editors
export { TextField, NumericField, BooleanField } from './components/field-editors/index.js';

// Advanced Components
export { GraphEditor } from './components/graph-editor/index.js';
export { HierarchyEditor } from './components/hierarchy-editor/index.js';
export { TreeScribe } from './components/tree-scribe/index.js';
