/**
 * Path utilities - pure JavaScript implementation
 * Replaces Node.js path module dependency
 */

/**
 * Join path segments into a single path
 * @param {...string} segments - Path segments to join
 * @returns {string} Joined path
 */
export function joinPath(...segments) {
  // Filter out empty segments and join with /
  const joined = segments
    .filter(Boolean)
    .join('/')
    // Replace multiple slashes with single slash
    .replace(/\/+/g, '/')
    // Remove trailing slash unless it's the root
    .replace(/\/$/, '') || '/';
  
  return joined;
}

/**
 * Get the directory name from a path
 * @param {string} filepath - File path
 * @returns {string} Directory path
 */
export function dirname(filepath) {
  if (!filepath) return '.';
  if (filepath === '/') return '/';
  if (filepath === '.' || filepath === '..') return '.';
  
  // Remove trailing slash
  const normalized = filepath.replace(/\/$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  
  // No slash found - relative path
  if (lastSlash === -1) return '.';
  
  // Root directory
  if (lastSlash === 0) return '/';
  
  return normalized.substring(0, lastSlash);
}

/**
 * Get the base name from a path
 * @param {string} filepath - File path
 * @param {string} ext - Optional extension to remove
 * @returns {string} Base name
 */
export function basename(filepath, ext) {
  if (!filepath) return '';
  
  // Remove trailing slash
  const normalized = filepath.replace(/\/$/, '');
  const parts = normalized.split('/');
  let base = parts[parts.length - 1] || '';
  
  // Remove extension if provided and matches
  if (ext && base.endsWith(ext)) {
    base = base.substring(0, base.length - ext.length);
  }
  
  return base;
}

/**
 * Get file extension
 * @param {string} filepath - File path
 * @returns {string} File extension including dot
 */
export function extname(filepath) {
  const base = basename(filepath);
  if (base === '.' || base === '..') return '';
  const lastDot = base.lastIndexOf('.');
  // Don't treat dotfiles as having extensions
  if (lastDot === -1 || lastDot === 0) return '';
  return base.substring(lastDot);
}

/**
 * Check if path is absolute
 * @param {string} filepath - File path
 * @returns {boolean} True if path is absolute
 */
export function isAbsolute(filepath) {
  return Boolean(filepath && filepath.startsWith('/'));
}

/**
 * Resolve path segments into an absolute path
 * @param {...string} segments - Path segments
 * @returns {string} Resolved absolute path
 */
export function resolve(...segments) {
  // Default to /workspace if no arguments or first is relative
  if (segments.length === 0) return '/workspace';
  
  let resolvedPath = '';
  let resolvedAbsolute = false;
  
  for (let i = segments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? segments[i] : '/workspace';
    
    if (!path) continue;
    
    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }
  
  // Normalize the path
  const pathArray = resolvedPath.split('/').filter(part => part !== '');
  const result = [];
  
  for (const part of pathArray) {
    if (part === '..') {
      result.pop();
    } else if (part !== '.') {
      result.push(part);
    }
  }
  
  return '/' + result.join('/');
}

// Default export
export default {
  joinPath,
  dirname,
  basename,
  extname,
  isAbsolute,
  resolve
};