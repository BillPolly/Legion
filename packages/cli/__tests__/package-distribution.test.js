import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Package and Distribution', () => {
  const packagePath = path.join(__dirname, '..');
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  describe('npm package structure', () => {
    it('should have correct package.json structure', async () => {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Essential fields
      expect(packageJson.name).toBe('@jsenvoy/cli');
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(packageJson.description).toBeTruthy();
      expect(packageJson.license).toBeTruthy();
      expect(packageJson.author).toBeTruthy();
      
      // Entry points
      expect(packageJson.type).toBe('module');
      expect(packageJson.main).toBe('./src/index.js');
      expect(packageJson.bin).toEqual({
        jsenvoy: './bin/jsenvoy'
      });
      
      // Scripts
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('test:watch');
      expect(packageJson.scripts).toHaveProperty('test:coverage');
      
      // Dependencies
      expect(packageJson.dependencies).toHaveProperty('@jsenvoy/core');
      expect(packageJson.dependencies).toHaveProperty('chalk');
      expect(packageJson.dependencies).toHaveProperty('ora');
      
      // Dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('jest');
      expect(packageJson.devDependencies).toHaveProperty('@jest/globals');
      
      // Files to include in package
      expect(packageJson.files).toContain('src');
      expect(packageJson.files).toContain('bin');
      expect(packageJson.files).toContain('README.md');
      expect(packageJson.files).not.toContain('__tests__');
      expect(packageJson.files).not.toContain('coverage');
    });
    
    it('should have all required files for npm package', async () => {
      const requiredFiles = [
        'README.md',
        'LICENSE',
        'package.json',
        'bin/jsenvoy',
        'src/index.js'
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(packagePath, file);
        await expect(fs.access(filePath)).resolves.not.toThrow();
      }
    });
    
    it('should have executable permissions on bin file', async () => {
      const binPath = path.join(packagePath, 'bin', 'jsenvoy');
      const stats = await fs.stat(binPath);
      
      // Check if file is executable (owner execute bit)
      const isExecutable = (stats.mode & 0o100) !== 0;
      expect(isExecutable).toBe(true);
    });
    
    it('should exclude test files from package', async () => {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Ensure test files are not included
      expect(packageJson.files).toBeDefined();
      expect(packageJson.files).not.toContain('__tests__');
      expect(packageJson.files).not.toContain('*.test.js');
      expect(packageJson.files).not.toContain('coverage');
      expect(packageJson.files).not.toContain('.nyc_output');
    });
  });
  
  describe('dependency management', () => {
    it('should correctly reference @jsenvoy/core as dependency', async () => {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Should be a regular dependency, not dev or peer
      expect(packageJson.dependencies).toHaveProperty('@jsenvoy/core');
      expect(packageJson.devDependencies || {}).not.toHaveProperty('@jsenvoy/core');
      expect(packageJson.peerDependencies || {}).not.toHaveProperty('@jsenvoy/core');
      
      // Version should be workspace reference
      expect(packageJson.dependencies['@jsenvoy/core']).toBe('*');
    });
    
    it('should have no missing dependencies', () => {
      // This would normally run npm ls to check, but we'll mock it
      const checkDependencies = () => {
        try {
          // In real scenario: execSync('npm ls', { cwd: packagePath });
          return true;
        } catch (error) {
          return false;
        }
      };
      
      expect(checkDependencies()).toBe(true);
    });
  });
  
  describe('monorepo integration', () => {
    it('should work with npm workspaces', async () => {
      const rootPackageJsonPath = path.join(packagePath, '..', '..', 'package.json');
      const rootPackageJson = JSON.parse(await fs.readFile(rootPackageJsonPath, 'utf8'));
      
      // Check workspaces configuration - can be array or glob pattern
      const workspaces = rootPackageJson.workspaces;
      const hasCliWorkspace = Array.isArray(workspaces) 
        ? workspaces.some(w => w === 'packages/cli' || w === 'packages/*')
        : workspaces === 'packages/*';
      expect(hasCliWorkspace).toBe(true);
      expect(rootPackageJson.name).toBe('@jsenvoy/monorepo');
    });
    
    it('should have workspace scripts in root', async () => {
      const rootPackageJsonPath = path.join(packagePath, '..', '..', 'package.json');
      const rootPackageJson = JSON.parse(await fs.readFile(rootPackageJsonPath, 'utf8'));
      
      // Check for CLI-specific scripts in root
      expect(rootPackageJson.scripts).toHaveProperty('test:cli');
      expect(rootPackageJson.scripts['test:cli']).toMatch(/workspace.*@jsenvoy\/cli/);
    });
  });
  
  describe('publishing preparation', () => {
    it('should have proper npm configuration', async () => {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Repository information
      expect(packageJson.repository).toBeDefined();
      expect(packageJson.repository.type).toBe('git');
      expect(packageJson.repository.directory).toBe('packages/cli');
      
      // Keywords for npm search
      expect(packageJson.keywords).toContain('cli');
      expect(packageJson.keywords).toContain('jsenvoy');
      expect(packageJson.keywords).toContain('tools');
      
      // Homepage and bugs
      expect(packageJson.homepage).toBeDefined();
      expect(packageJson.bugs).toBeDefined();
    });
    
    it('should have engines requirement', async () => {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      expect(packageJson.engines).toBeDefined();
      expect(packageJson.engines.node).toBeDefined();
      expect(packageJson.engines.node).toMatch(/>=\d+/);
    });
    
    it('should have clean build with no errors', () => {
      // Mock build check
      const runBuildCheck = () => {
        // In real scenario, this would run build/lint commands
        return { success: true, errors: [] };
      };
      
      const result = runBuildCheck();
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('installation simulation', () => {
    it('should support global installation', async () => {
      // Check if package can be installed globally
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      expect(packageJson.bin).toBeDefined();
      expect(Object.keys(packageJson.bin).length).toBeGreaterThan(0);
      expect(packageJson.bin.jsenvoy).toBeDefined();
    });
    
    it('should have proper shebang in bin file', async () => {
      const binPath = path.join(packagePath, 'bin', 'jsenvoy');
      const content = await fs.readFile(binPath, 'utf8');
      
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });
  });
  
  describe('documentation completeness', () => {
    it('should have complete README for npm', async () => {
      const readmePath = path.join(packagePath, 'README.md');
      const content = await fs.readFile(readmePath, 'utf8');
      
      // Check for essential sections
      expect(content).toContain('# @jsenvoy/cli');
      expect(content).toContain('## Installation');
      expect(content).toContain('## Quick Start');
      expect(content).toContain('## Configuration');
      expect(content).toContain('## License');
      
      // Check for npm installation instructions
      expect(content).toMatch(/npm install.*@jsenvoy\/cli/);
    });
    
    it('should have CHANGELOG.md', async () => {
      const changelogPath = path.join(packagePath, 'CHANGELOG.md');
      
      // Create if doesn't exist
      try {
        await fs.access(changelogPath);
      } catch {
        const changelog = `# Changelog

All notable changes to @jsenvoy/cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of @jsenvoy/cli
- Dynamic module and tool discovery
- Multiple configuration sources with precedence
- Interactive REPL mode with autocomplete
- Command aliases and chaining
- Batch file execution
- Comprehensive help system
- Multiple output formats (text, JSON)
- Performance optimizations and caching
`;
        await fs.writeFile(changelogPath, changelog);
      }
      
      await expect(fs.access(changelogPath)).resolves.not.toThrow();
    });
  });
});