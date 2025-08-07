/**
 * Artifact system exports
 */

export { ArtifactRenderer, ArtifactRendererRegistry, artifactRegistry } from './ArtifactRenderer.js';
export { CodeRenderer } from './renderers/CodeRenderer.js';
export { DocumentRenderer, MarkdownRenderer } from './renderers/DocumentRenderer.js';
export { ImageRenderer } from './renderers/ImageRenderer.js';

// Auto-register default renderers
import { artifactRegistry } from './ArtifactRenderer.js';
import { CodeRenderer } from './renderers/CodeRenderer.js';
import { DocumentRenderer, MarkdownRenderer } from './renderers/DocumentRenderer.js';
import { ImageRenderer } from './renderers/ImageRenderer.js';

// Register default renderers
artifactRegistry.register(new CodeRenderer());
artifactRegistry.register(new DocumentRenderer());
artifactRegistry.register(new MarkdownRenderer());
artifactRegistry.register(new ImageRenderer());

console.log('Artifact renderers registered:', artifactRegistry.getRegisteredTypes());