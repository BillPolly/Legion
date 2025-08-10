/**
 * Sidewinder ES Module Loader
 * Used with --loader flag for ES module applications
 */

import { pathToFileURL } from 'url';
import path from 'path';

// Initialize Sidewinder when loader is activated
const injectPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'inject.js');

// Dynamic import to load CommonJS injection script
await import(pathToFileURL(injectPath).href);

// Export loader hooks for Node.js
export async function resolve(specifier, context, nextResolve) {
  // Pass through to default resolver
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // Pass through to default loader
  return nextLoad(url, context);
}

export async function getFormat(url, context, nextGetFormat) {
  // Pass through to default format detector
  return nextGetFormat(url, context);
}

export async function getSource(url, context, nextGetSource) {
  // Pass through to default source loader
  return nextGetSource(url, context);
}

export async function transformSource(source, context, nextTransformSource) {
  // Pass through to default transformer
  return nextTransformSource(source, context);
}

// Log that loader is active
if (process.env.SIDEWINDER_DEBUG === 'true') {
  console.error('[Sidewinder Loader] ES module loader activated');
}