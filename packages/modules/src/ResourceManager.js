import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Central registry for all resources needed by modules
 * Automatically loads environment variables from .env file
 */
class ResourceManager {
  constructor(options = {}) {
    this.resources = new Map();
    this.options = options;
    
    // Note: .env loading will be done in initialize() method
    // since it needs to be async with ES6 modules
  }
  
  /**
   * Initialize the ResourceManager (async operations)
   * Must be called after construction if loadEnv is needed
   */
  async initialize() {
    if (this.options.loadEnv !== false) {
      await this.loadEnvFile(this.options.envPath);
    }
  }
  
  /**
   * Load environment variables from .env file
   * @param {string} envPath - Optional path to .env file
   */
  async loadEnvFile(envPath) {
    try {
      // If no path provided, search for .env file
      if (!envPath) {
        // Look for .env in common locations
        const possiblePaths = [
          path.join(process.cwd(), '.env'),
          path.join(process.cwd(), '..', '.env'),
          path.join(process.cwd(), '..', '..', '.env'),
          path.join(process.cwd(), '..', '..', '..', '.env'),
          path.join(__dirname, '..', '..', '..', '.env'),
          path.join(__dirname, '..', '..', '..', '..', '.env')
        ];
        
        for (const tryPath of possiblePaths) {
          if (fs.existsSync(tryPath)) {
            envPath = tryPath;
            break;
          }
        }
      }
      
      if (envPath && fs.existsSync(envPath)) {
        // Load dotenv
        const dotenv = await import('dotenv');
        dotenv.config({ path: envPath });
        
        // Register all environment variables as resources
        for (const [key, value] of Object.entries(process.env)) {
          this.register(`env.${key}`, value);
        }
      }
    } catch (error) {
      // Silently fail if .env file cannot be loaded
      // This is okay as .env files are optional
    }
  }

  /**
   * Register a resource by name
   * @param {string} name - The name of the resource
   * @param {*} resource - The resource to register (can be any type)
   */
  register(name, resource) {
    this.resources.set(name, resource);
  }

  /**
   * Get a resource by name
   * @param {string} name - The name of the resource
   * @returns {*} The registered resource
   * @throws {Error} If the resource is not found
   */
  get(name) {
    if (!this.resources.has(name)) {
      throw new Error(`Resource '${name}' not found`);
    }
    return this.resources.get(name);
  }

  /**
   * Check if a resource exists
   * @param {string} name - The name of the resource
   * @returns {boolean} True if the resource exists
   */
  has(name) {
    return this.resources.has(name);
  }
}

export { ResourceManager };