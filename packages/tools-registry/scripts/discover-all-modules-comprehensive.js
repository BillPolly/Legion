#!/usr/bin/env node

/**
 * Comprehensive Module Discovery
 * 
 * Finds ALL modules in the monorepo with complete details and stores them
 */

import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ComprehensiveModuleDiscovery {
  constructor() {
    this.monorepoRoot = this.findMonorepoRoot();
    this.results = {
      discovered: [],
      failed: [],
      statistics: {}
    };
  }

  findMonorepoRoot() {
    let currentPath = __dirname;
    while (currentPath !== '/') {
      const packagePath = path.join(currentPath, 'package.json');
      if (fsSync.existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(fsSync.readFileSync(packagePath, 'utf-8'));
          if (pkg.workspaces) {
            return currentPath;
          }
        } catch (e) {
          // Continue searching
        }
      }
      currentPath = path.dirname(currentPath);
    }
    throw new Error('Could not find monorepo root');
  }

  async discoverAllModules() {
    console.log('🔍 Comprehensive Module Discovery');
    console.log('═'.repeat(60));
    console.log(`📁 Scanning from: ${this.monorepoRoot}`);
    console.log('');

    // Find all *Module.js files
    const moduleFiles = await glob('packages/**/src/**/*Module.js', {
      cwd: this.monorepoRoot,
      ignore: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/test/**',
        '**/tests/**',
        '**/*.test.js',
        '**/*.spec.js',
        '**/dist/**',
        '**/build/**'
      ]
    });

    // Find all module.json files
    const jsonFiles = await glob('packages/**/module.json', {
      cwd: this.monorepoRoot,
      ignore: ['**/node_modules/**']
    });

    console.log(`📋 Found ${moduleFiles.length} JavaScript modules and ${jsonFiles.length} JSON modules`);
    console.log('');

    // Process JavaScript modules
    for (const file of moduleFiles) {
      await this.processJavaScriptModule(file);
    }

    // Process JSON modules  
    for (const file of jsonFiles) {
      await this.processJsonModule(file);
    }

    return this.results;
  }

  async processJavaScriptModule(filePath) {
    const fullPath = path.join(this.monorepoRoot, filePath);
    const relativePath = filePath;
    const dirPath = path.dirname(relativePath);
    const fileName = path.basename(filePath);
    
    try {
      // Read and analyze the file
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Extract class name
      const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+Module)/);
      const className = classMatch ? classMatch[1] : fileName.replace('.js', '');
      
      // Extract module name
      let moduleName = className.replace(/Module$/, '');
      
      // Look for explicit name in constructor
      const nameMatch = content.match(/this\.name\s*=\s*['"`]([^'"`]+)['"`]/);
      if (nameMatch) {
        moduleName = nameMatch[1];
      }
      
      // Extract description
      let description = '';
      const descMatch = content.match(/this\.description\s*=\s*['"`]([^'"`]+)['"`]/);
      if (descMatch) {
        description = descMatch[1];
      } else {
        // Try JSDoc
        const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\s*([^\n@]+)/);
        if (jsdocMatch) {
          description = jsdocMatch[1].trim();
        }
      }
      
      // Extract dependencies (imports)
      const dependencies = [];
      const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
      for (const match of importMatches) {
        const dep = match[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          dependencies.push(dep);
        }
      }
      
      // Extract environment variables
      const envVars = this.extractEnvVars(content);
      
      // Check if module has index.js
      const hasIndex = fsSync.existsSync(path.join(path.dirname(fullPath), 'index.js'));
      
      // Get package name
      const packageName = this.getPackageName(dirPath);
      
      // Check if file exists and is readable
      const stats = await fs.stat(fullPath);
      
      const moduleInfo = {
        name: moduleName,
        className: className,
        type: 'class',
        filePath: relativePath,
        dirPath: dirPath,
        packageName: packageName,
        hasIndex: hasIndex,
        description: description,
        dependencies: [...new Set(dependencies)],
        requiredEnvVars: envVars,
        fileSize: stats.size,
        lastModified: stats.mtime,
        discovered: true,
        discoveredAt: new Date()
      };
      
      this.results.discovered.push(moduleInfo);
      console.log(`✅ ${moduleName} (${className})`);
      console.log(`   📁 ${dirPath}`);
      console.log(`   📄 ${relativePath}`);
      console.log(`   📦 ${packageName}`);
      console.log(`   🔧 Index: ${hasIndex ? 'Yes' : 'No'}`);
      if (description) {
        console.log(`   📝 ${description}`);
      }
      if (envVars.length > 0) {
        console.log(`   🔐 Env vars: ${envVars.join(', ')}`);
      }
      console.log('');
      
    } catch (error) {
      this.results.failed.push({
        file: filePath,
        error: error.message
      });
      console.log(`❌ ${fileName}: ${error.message}`);
    }
  }

  async processJsonModule(filePath) {
    const fullPath = path.join(this.monorepoRoot, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const jsonModule = JSON.parse(content);
      const dirPath = path.dirname(filePath);
      
      const moduleInfo = {
        name: jsonModule.name,
        className: null,
        type: 'json',
        filePath: filePath,
        dirPath: dirPath,
        packageName: this.getPackageName(dirPath),
        hasIndex: false,
        description: jsonModule.description || '',
        dependencies: jsonModule.dependencies || [],
        requiredEnvVars: this.extractEnvVars(JSON.stringify(jsonModule)),
        fileSize: (await fs.stat(fullPath)).size,
        lastModified: (await fs.stat(fullPath)).mtime,
        discovered: true,
        discoveredAt: new Date()
      };
      
      this.results.discovered.push(moduleInfo);
      console.log(`✅ ${moduleInfo.name} (JSON module)`);
      console.log(`   📁 ${dirPath}`);
      console.log(`   📄 ${filePath}`);
      console.log(`   📦 ${moduleInfo.packageName}`);
      console.log('');
      
    } catch (error) {
      this.results.failed.push({
        file: filePath,
        error: error.message
      });
      console.log(`❌ ${path.basename(filePath)}: ${error.message}`);
    }
  }

  extractEnvVars(content) {
    const envVars = new Set();
    
    // Pattern 1: process.env.VARIABLE
    const processEnvMatches = content.matchAll(/process\.env\.(\w+)/g);
    for (const match of processEnvMatches) {
      envVars.add(match[1]);
    }
    
    // Pattern 2: resourceManager.get('env.VARIABLE')
    const rmEnvMatches = content.matchAll(/resourceManager\.get\(['"`]env\.(\w+)['"`]\)/g);
    for (const match of rmEnvMatches) {
      envVars.add(match[1]);
    }
    
    // Pattern 3: Common API key patterns
    const apiKeyPatterns = [
      /OPENAI_API_KEY/g,
      /ANTHROPIC_API_KEY/g,
      /GITHUB_PAT/g,
      /GITHUB_TOKEN/g,
      /SERPER_API_KEY/g,
      /RAILWAY_API_TOKEN/g,
      /MONGODB_URL/g
    ];
    
    for (const pattern of apiKeyPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        envVars.add(match[0]);
      }
    }
    
    return Array.from(envVars);
  }

  getPackageName(dirPath) {
    const parts = dirPath.split(path.sep);
    const packagesIndex = parts.indexOf('packages');
    
    if (packagesIndex !== -1 && packagesIndex < parts.length - 1) {
      const packageName = parts[packagesIndex + 1];
      return `@legion/${packageName}`;
    }
    
    return '@legion/unknown';
  }

  async storeInDatabase() {
    console.log('📝 Storing modules in database...');
    console.log('━'.repeat(40));
    
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Initialize database provider
    const provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
    
    let registered = 0;
    let updated = 0;
    let failed = 0;
    
    for (const moduleInfo of this.results.discovered) {
      try {
        // Check if module already exists
        const existing = await provider.databaseService.mongoProvider.findOne('modules', {
          $or: [
            { name: moduleInfo.name },
            { className: moduleInfo.className },
            { filePath: moduleInfo.filePath }
          ]
        });
        
        if (existing) {
          // Update existing module
          await provider.databaseService.mongoProvider.update(
            'modules',
            { _id: existing._id },
            { 
              $set: {
                ...moduleInfo,
                updatedAt: new Date(),
                validationStatus: existing.validationStatus || 'pending',
                loadable: true
              }
            }
          );
          updated++;
          console.log(`📝 Updated: ${moduleInfo.name}`);
        } else {
          // Create new module entry
          await provider.databaseService.mongoProvider.insert('modules', {
            ...moduleInfo,
            validationStatus: 'pending',
            validationErrors: [],
            validationWarnings: [],
            validationDate: null,
            loadable: true,
            executionStatus: 'untested',
            lastTestedDate: null,
            toolCount: 0,
            status: 'discovered',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          registered++;
          console.log(`✅ Registered: ${moduleInfo.name}`);
        }
      } catch (error) {
        failed++;
        console.log(`❌ Failed: ${moduleInfo.name} - ${error.message}`);
      }
    }
    
    return { registered, updated, failed };
  }

  printSummary(dbResults) {
    console.log('');
    console.log('📊 Discovery Summary');
    console.log('═'.repeat(60));
    console.log(`📁 Files processed: ${this.results.discovered.length + this.results.failed.length}`);
    console.log(`✅ Modules discovered: ${this.results.discovered.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log('');
    console.log('📝 Database Summary');
    console.log('━'.repeat(40));
    console.log(`✅ New registrations: ${dbResults.registered}`);
    console.log(`📝 Updates: ${dbResults.updated}`);
    console.log(`❌ Failed: ${dbResults.failed}`);
    console.log('');
    
    // Statistics by package
    const byPackage = {};
    this.results.discovered.forEach(m => {
      byPackage[m.packageName] = (byPackage[m.packageName] || 0) + 1;
    });
    
    console.log('📦 Modules by Package:');
    Object.entries(byPackage)
      .sort(([,a], [,b]) => b - a)
      .forEach(([pkg, count]) => {
        console.log(`   ${pkg}: ${count} modules`);
      });
    
    if (this.results.failed.length > 0) {
      console.log('');
      console.log('⚠️ Failed Files:');
      this.results.failed.forEach(f => {
        console.log(`   ${f.file}: ${f.error}`);
      });
    }
  }
}

// Main execution
async function main() {
  try {
    const discovery = new ComprehensiveModuleDiscovery();
    
    // Discover all modules
    await discovery.discoverAllModules();
    
    // Store in database
    const dbResults = await discovery.storeInDatabase();
    
    // Print summary
    discovery.printSummary(dbResults);
    
    console.log('');
    console.log('🎉 Comprehensive module discovery completed!');
    console.log(`Total modules found: ${discovery.results.discovered.length}`);
    
  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}