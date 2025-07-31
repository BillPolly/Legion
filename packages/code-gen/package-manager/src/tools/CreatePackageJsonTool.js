/**
 * CreatePackageJsonTool - Generate package.json files
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export class CreatePackageJsonTool extends Tool {
  constructor() {
    super({
      name: 'create_package_json',
      description: 'Generate a package.json file with dependencies and scripts',
      inputSchema: z.object({
      name: z.string().describe('Project name'),
      version: z.string().default('1.0.0').describe('Project version'),
      description: z.string().optional().describe('Project description'),
      main: z.string().default('index.js').describe('Main entry point'),
      scripts: z.record(z.string()).optional().describe('NPM scripts'),
      dependencies: z.record(z.string()).optional().describe('Production dependencies'),
      devDependencies: z.record(z.string()).optional().describe('Development dependencies'),
      keywords: z.array(z.string()).optional().describe('Project keywords'),
      author: z.string().optional().describe('Project author'),
      license: z.string().default('ISC').describe('Project license'),
      projectPath: z.string().describe('Path where package.json should be created')
      })
    });
    this.outputSchema = z.object({
      created: z.boolean(),
      path: z.string(),
      content: z.record(z.any()).optional(),
      message: z.string().optional(),
      error: z.string().optional()
    });
  }

  async execute(args) {
    try {
      this.progress('Validating project configuration...', 20);

      const {
        name,
        version = '1.0.0',
        description = '',
        main = 'index.js',
        scripts = { test: 'echo "Error: no test specified" && exit 1' },
        dependencies = {},
        devDependencies = {},
        keywords = [],
        author = '',
        license = 'ISC',
        projectPath
      } = args;

      const packageJsonPath = path.join(projectPath, 'package.json');

      this.progress('Checking if package.json already exists...', 40);

      // Check if package.json already exists
      try {
        await fs.access(packageJsonPath);
        return {
          created: false,
          path: packageJsonPath,
          message: 'package.json already exists'
        };
      } catch (error) {
        // File doesn't exist, create it
      }

      this.progress('Generating package.json content...', 60);

      // Create package.json content
      const packageJson = {
        name: this._sanitizePackageName(name),
        version,
        description,
        main,
        scripts: this._mergeWithDefaults(scripts, {
          test: 'echo "Error: no test specified" && exit 1'
        }),
        keywords,
        author,
        license,
        dependencies,
        devDependencies
      };

      // Add common fields if not provided
      if (!packageJson.scripts.start && main) {
        packageJson.scripts.start = `node ${main}`;
      }

      this.progress('Writing package.json file...', 80);

      // Ensure directory exists
      await fs.mkdir(projectPath, { recursive: true });

      // Write package.json file
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      this.progress('Package.json created successfully', 100);

      return {
        created: true,
        path: packageJsonPath,
        content: packageJson
      };

    } catch (error) {
      this.error(error.message);
      
      return {
        created: false,
        path: path.join(args.projectPath || '', 'package.json'),
        error: error.message
      };
    }
  }

  _sanitizePackageName(name) {
    // Convert to lowercase and replace invalid characters
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-_\.]/g, '-')
      .replace(/^[-_\.]+|[-_\.]+$/g, '') // Remove leading/trailing separators
      .replace(/[-_\.]{2,}/g, '-'); // Replace multiple separators with single dash
  }

  _mergeWithDefaults(provided, defaults) {
    return {
      ...defaults,
      ...provided
    };
  }

  /**
   * Generate package.json with common presets
   */
  async generateWithPreset(args, preset = 'basic') {
    const presets = {
      basic: {
        scripts: {
          test: 'echo "Error: no test specified" && exit 1',
          start: 'node index.js'
        }
      },
      express: {
        scripts: {
          start: 'node server.js',
          dev: 'nodemon server.js',
          test: 'jest'
        },
        dependencies: {
          express: '^4.18.0'
        },
        devDependencies: {
          nodemon: '^3.0.0',
          jest: '^29.0.0'
        }
      },
      library: {
        scripts: {
          build: 'tsc',
          test: 'jest',
          prepublishOnly: 'npm run build'
        },
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0',
          '@types/jest': '^29.0.0'
        }
      },
      frontend: {
        scripts: {
          build: 'webpack --mode production',
          dev: 'webpack serve --mode development',
          test: 'jest'
        },
        devDependencies: {
          webpack: '^5.0.0',
          'webpack-cli': '^5.0.0',
          'webpack-dev-server': '^4.0.0',
          jest: '^29.0.0'
        }
      }
    };

    const presetConfig = presets[preset] || presets.basic;
    
    const mergedArgs = {
      ...args,
      scripts: { ...presetConfig.scripts, ...args.scripts },
      dependencies: { ...presetConfig.dependencies, ...args.dependencies },
      devDependencies: { ...presetConfig.devDependencies, ...args.devDependencies }
    };

    return this.execute(mergedArgs);
  }

  /**
   * Validate package.json name according to npm rules
   */
  validatePackageName(name) {
    const errors = [];
    
    if (!name) {
      errors.push('Package name is required');
      return { valid: false, errors };
    }

    if (name.length > 214) {
      errors.push('Package name cannot be longer than 214 characters');
    }

    if (name !== name.toLowerCase()) {
      errors.push('Package name must be lowercase');
    }

    if (/[^a-z0-9\-_\.]/.test(name)) {
      errors.push('Package name can only contain lowercase letters, numbers, hyphens, underscores, and dots');
    }

    if (/^[._]/.test(name)) {
      errors.push('Package name cannot start with a dot or underscore');
    }

    // Check for reserved names
    const reservedNames = [
      'node_modules', 'favicon.ico', 'package.json', 'npm', 'node', 'js', 'javascript'
    ];
    
    if (reservedNames.includes(name)) {
      errors.push(`Package name "${name}" is reserved`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}