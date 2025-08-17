/**
 * PackageDiscovery - Discovers Legion packages in monorepo
 * Scans the packages directory structure and identifies @legion/* packages
 */

import fs from 'fs/promises';
import path from 'path';

export class PackageDiscovery {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
  }

  /**
   * Discover all Legion packages in the monorepo
   * @param {string} monorepoRoot - Root directory of the monorepo
   * @returns {Map<string, Object>} Map of package name to package info
   */
  async discoverPackages(monorepoRoot) {
    const packages = new Map();
    
    try {
      const packagesDir = path.join(monorepoRoot, 'packages');
      
      // Check if packages directory exists
      try {
        await fs.access(packagesDir);
      } catch {
        console.log(`Packages directory not found at ${packagesDir}`);
        return packages;
      }
      
      // Read all entries in packages directory
      const entries = await fs.readdir(packagesDir);
      
      for (const entry of entries) {
        const entryPath = path.join(packagesDir, entry);
        
        try {
          const stat = await fs.stat(entryPath);
          
          if (!stat.isDirectory()) {
            continue;
          }
          
          // Check if this is a package itself
          if (await this.isLegionPackage(entryPath)) {
            const pkg = await this.loadPackage(entryPath);
            if (pkg) {
              packages.set(pkg.name, pkg);
            }
          } else {
            // Check subdirectories (e.g., shared/actors)
            const subEntries = await fs.readdir(entryPath);
            
            for (const subEntry of subEntries) {
              const subPath = path.join(entryPath, subEntry);
              
              try {
                const subStat = await fs.stat(subPath);
                
                if (subStat.isDirectory() && await this.isLegionPackage(subPath)) {
                  const pkg = await this.loadPackage(subPath);
                  if (pkg) {
                    packages.set(pkg.name, pkg);
                  }
                }
              } catch (error) {
                // Skip entries that can't be accessed
                console.debug(`Skipping ${subPath}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          // Skip entries that can't be accessed
          console.debug(`Skipping ${entryPath}: ${error.message}`);
        }
      }
      
      console.log(`Discovered ${packages.size} Legion packages`);
      return packages;
      
    } catch (error) {
      console.error(`Error discovering packages: ${error.message}`);
      return packages;
    }
  }

  /**
   * Check if a directory is a Legion package
   * @param {string} dirPath - Directory path to check
   * @returns {boolean} True if it's a Legion package
   */
  async isLegionPackage(dirPath) {
    try {
      const packageJsonPath = path.join(dirPath, 'package.json');
      await fs.access(packageJsonPath);
      
      // Read and parse package.json
      const content = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      // Check if it's a @legion scoped package
      return packageJson.name && packageJson.name.startsWith('@legion/');
      
    } catch {
      return false;
    }
  }

  /**
   * Load package information
   * @param {string} packagePath - Path to the package directory
   * @returns {Object|null} Package information or null if failed
   */
  async loadPackage(packagePath) {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      // Determine source directory
      let srcPath = path.join(packagePath, 'src');
      try {
        await fs.access(srcPath);
      } catch {
        // No src directory, use package root
        srcPath = packagePath;
      }
      
      return {
        name: packageJson.name,
        cleanName: packageJson.name.replace('@legion/', ''),
        version: packageJson.version,
        path: packagePath,
        srcPath: srcPath,
        main: packageJson.main || 'index.js'
      };
      
    } catch (error) {
      console.error(`Failed to load package at ${packagePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the monorepo root from ResourceManager
   * @returns {string|null} Monorepo root path or null
   */
  getMonorepoRoot() {
    return this.resourceManager.get('env.MONOREPO_ROOT');
  }
}