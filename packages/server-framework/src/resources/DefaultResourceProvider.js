/**
 * DefaultResourceProvider - Lightweight default resource provider
 * Provides minimal HTML, favicon, and client JavaScript
 */

import { ResourceProvider, ResourceResponse } from './ResourceProvider.js';
import { generateHTML } from '../htmlTemplate.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DefaultResourceProvider extends ResourceProvider {
  constructor(config = {}) {
    super();
    this.config = {
      title: config.title || 'Legion App',
      clientContainer: config.clientContainer || null, // e.g., 'app'
      clientActorPath: config.clientActorPath || '/client.js',
      wsEndpoint: config.wsEndpoint || 'ws://localhost:8080/ws',
      route: config.route || '/',
      ...config
    };
  }

  async getResource(path, req) {
    switch (path) {
      case '/':
        return new ResourceResponse({
          type: 'text/html',
          content: this.generateHTML(),
          cache: false
        });

      case '/favicon.ico':
        return new ResourceResponse({
          type: 'image/x-icon',
          file: this.getDefaultFaviconPath(),
          cache: '1 year'
        });

      case '/client.js':
        console.log('[DEBUG] /client.js requested, clientActorFile:', this.config.clientActorFile);
        if (this.config.clientActorFile) {
          return new ResourceResponse({
            type: 'application/javascript',
            file: this.config.clientActorFile,
            cache: false
          });
        } else {
          console.log('[DEBUG] No clientActorFile configured');
        }
        break;

      default:
        return null; // Not found
    }

    return null;
  }

  generateHTML() {
    return generateHTML({
      title: this.config.title,
      clientActorPath: this.config.clientActorPath,
      wsEndpoint: this.config.wsEndpoint,
      route: this.config.route,
      importMap: this.config.importMap || {}
    });
  }

  getDefaultFaviconPath() {
    // Return path to default favicon in framework assets
    return path.join(__dirname, '../assets/favicon.ico');
  }

  async listResources() {
    const resources = ['/', '/favicon.ico'];
    if (this.config.clientActorFile) {
      resources.push('/client.js');
    }
    return resources;
  }
}