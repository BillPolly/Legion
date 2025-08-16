import fs from 'fs';
import path from 'path';

/**
 * Resolve file path with intelligent fallback locations
 * @param {string} filePath - File path to resolve
 * @returns {string} Resolved absolute path
 */
export function resolveFilePath(filePath) {
  // If absolute path, use directly
  if (path.isAbsolute(filePath)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`File not found: ${filePath} (not a file)`);
    }
    return filePath;
  }
  
  // Try relative path resolution in order
  const searchPaths = [
    process.cwd(),                           // Current working directory
    process.env.MONOREPO_ROOT,              // Monorepo root from environment
    path.resolve(process.cwd(), '../..'),   // Project root (relative)
  ].filter(Boolean); // Remove undefined values
  
  for (const basePath of searchPaths) {
    const resolvedPath = path.resolve(basePath, filePath);
    if (fs.existsSync(resolvedPath)) {
      const stats = fs.statSync(resolvedPath);
      if (stats.isFile()) {
        return resolvedPath;
      }
    }
  }
  
  throw new Error(`File not found: ${filePath} (searched: ${searchPaths.join(', ')})`);
}

/**
 * Validate image file format
 * @param {string} filePath - Path to image file
 */
export function validateImageFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  
  if (!supportedFormats.includes(ext)) {
    throw new Error(`Unsupported format: ${ext}. Supported: ${supportedFormats.join(', ')}`);
  }
}

/**
 * Validate file size is within limits
 * @param {string} filePath - Path to file
 */
export function validateFileSize(filePath) {
  const stats = fs.statSync(filePath);
  const maxSize = 20 * 1024 * 1024; // 20MB
  
  if (stats.size === 0) {
    throw new Error(`File is empty: ${filePath}`);
  }
  
  if (stats.size > maxSize) {
    throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB. Maximum: 20MB`);
  }
}

/**
 * Encode image file as base64
 * @param {string} filePath - Path to image file
 * @returns {Object} Object with base64Data, mimeType, and format
 */
export function encodeImageAsBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  const base64Data = buffer.toString('base64');
  
  const ext = path.extname(filePath).toLowerCase();
  const format = ext.substring(1); // Remove the dot
  
  // Map extensions to MIME types
  const mimeTypeMap = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  
  const mimeType = mimeTypeMap[format] || 'application/octet-stream';
  
  return {
    base64Data,
    mimeType,
    format
  };
}

/**
 * Get metadata about an image file
 * @param {string} filePath - Path to image file
 * @returns {Object} Metadata object
 */
export function getImageMetadata(filePath) {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const format = ext.substring(1);
  
  const mimeTypeMap = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  
  return {
    size: stats.size,
    format,
    mimeType: mimeTypeMap[format] || 'application/octet-stream',
    path: filePath
  };
}