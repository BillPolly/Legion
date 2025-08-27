/**
 * Picture Analysis Tool Package
 * 
 * Provides AI-powered image analysis capabilities for the Legion framework
 */

// Main exports
export { default as PictureAnalysisModule } from './PictureAnalysisModule.js';
export { PictureAnalysisTool } from './PictureAnalysisTool.js';

// Utility exports
export * from './utils/index.js';

// Package information
export const PACKAGE_NAME = 'picture-analysis';
export const PACKAGE_VERSION = '1.0.0';

export function getPackageInfo() {
  return {
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    ready: true,
    description: 'AI-powered image analysis for Legion framework'
  };
}