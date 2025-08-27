/**
 * Clean Architecture Compliance Tests
 * Verifies that the codebase follows Clean Architecture principles
 * Tests dependency rules and layer boundaries
 */

// Test functions are provided by the test runner as globals
import * as fs from 'fs';
import * as path from 'path';

describe('Clean Architecture Compliance', () => {
  const srcPath = path.join(process.cwd(), 'src');
  
  describe('Dependency Rule - Dependencies flow inward', () => {
    it('domain layer should not depend on application layer', () => {
      const domainFiles = getAllFiles(path.join(srcPath, 'domain'));
      
      domainFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Domain should not import from application
        expect(content).not.toMatch(/from ['"]\.\.\/\.\.\/application/);
        expect(content).not.toMatch(/from ['"].*\/application\//);
        
        // Domain should not import from infrastructure
        expect(content).not.toMatch(/from ['"]\.\.\/\.\.\/infrastructure/);
        expect(content).not.toMatch(/from ['"].*\/infrastructure\//);
        
        // Domain should not import from config
        expect(content).not.toMatch(/from ['"]\.\.\/\.\.\/config/);
        expect(content).not.toMatch(/from ['"].*\/config\//);
      });
    });
    
    it('domain layer should not depend on external packages', () => {
      const domainFiles = getAllFiles(path.join(srcPath, 'domain'));
      
      domainFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Domain should not import external packages (except Node built-ins)
        expect(content).not.toMatch(/from ['"]@legion/);
        expect(content).not.toMatch(/from ['"]@anthropic/);
        expect(content).not.toMatch(/from ['"]openai/);
        
        // Allow only domain imports and Node built-ins
        const imports = content.match(/from ['"][^'"]+['"]/g) || [];
        imports.forEach(imp => {
          const module = imp.match(/from ['"]([^'"]+)['"]/)[1];
          
          // Should be relative domain imports only
          if (!module.startsWith('.')) {
            // Only Node built-ins allowed
            expect(['fs', 'path', 'util', 'events']).toContain(module);
          }
        });
      });
    });
    
    it('application layer should not depend on infrastructure details', () => {
      const appFiles = getAllFiles(path.join(srcPath, 'application'));
      
      appFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Application should not import concrete infrastructure implementations
        expect(content).not.toMatch(/from ['"]\.\.\/infrastructure\/adapters/);
        
        // Should only import ports/interfaces from infrastructure if needed
        const infraImports = content.match(/from ['"].*infrastructure/g) || [];
        infraImports.forEach(imp => {
          expect(imp).toMatch(/\/ports\//);
        });
      });
    });
  });
  
  describe('Layer Isolation', () => {
    it('each layer should have clear boundaries', () => {
      const layers = ['domain', 'application', 'infrastructure', 'config'];
      
      layers.forEach(layer => {
        const layerPath = path.join(srcPath, layer);
        if (fs.existsSync(layerPath)) {
          expect(fs.statSync(layerPath).isDirectory()).toBe(true);
        }
      });
    });
    
    it('domain entities should be pure classes', () => {
      const entitiesPath = path.join(srcPath, 'domain', 'entities');
      if (fs.existsSync(entitiesPath)) {
        const entityFiles = getAllFiles(entitiesPath);
        
        entityFiles.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          
          // Should define classes
          expect(content).toMatch(/export class \w+/);
          
          // Should not have async methods (I/O operations)
          expect(content).not.toMatch(/async \w+\(/);
          
          // Should not use console.log directly
          expect(content).not.toMatch(/console\.(log|error|warn)/);
        });
      }
    });
    
    it('value objects should be immutable', () => {
      const valueObjectsPath = path.join(srcPath, 'domain', 'value-objects');
      if (fs.existsSync(valueObjectsPath)) {
        const voFiles = getAllFiles(valueObjectsPath);
        
        voFiles.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          
          // Should freeze objects in constructor
          expect(content).toMatch(/Object\.freeze\(this\)/);
          
          // Should not have setter methods
          expect(content).not.toMatch(/set \w+\(/);
        });
      }
    });
    
    it('use cases should orchestrate domain logic', () => {
      const useCasesPath = path.join(srcPath, 'application', 'use-cases');
      if (fs.existsSync(useCasesPath)) {
        const useCaseFiles = getAllFiles(useCasesPath);
        
        useCaseFiles.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          
          // Should have execute method
          expect(content).toMatch(/async execute\(/);
          
          // Should import domain entities
          expect(content).toMatch(/from ['"].*\/domain\//);
          
          // Should use dependency injection
          expect(content).toMatch(/constructor\(/);
        });
      }
    });
    
    it('ports should be abstract interfaces', () => {
      const portsPath = path.join(srcPath, 'application', 'ports');
      if (fs.existsSync(portsPath)) {
        const portFiles = getAllFiles(portsPath);
        
        portFiles.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          
          // Should throw "must be implemented" errors
          expect(content).toMatch(/throw.*must be implemented/);
          
          // Check that methods only throw, don't have other implementation
          // Look for methods that have code other than just throwing
          const methodBodies = content.match(/async \w+\([^)]*\) \{[^}]+\}/g) || [];
          methodBodies.forEach(body => {
            // Each method body should only contain a throw statement
            const withoutComments = body.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
            expect(withoutComments).toMatch(/throw/);
            // Should not have other statements (return, if, for, etc.)
            expect(withoutComments).not.toMatch(/\breturn\b(?!.*throw)/);
            expect(withoutComments).not.toMatch(/\bif\b/);
            expect(withoutComments).not.toMatch(/\bfor\b/);
            expect(withoutComments).not.toMatch(/\bwhile\b/);
            expect(withoutComments).not.toMatch(/\bconst\b(?!.*throw)/);
            expect(withoutComments).not.toMatch(/\blet\b(?!.*throw)/);
          });
        });
      }
    });
    
    it('adapters should implement ports', () => {
      const adaptersPath = path.join(srcPath, 'infrastructure', 'adapters');
      if (fs.existsSync(adaptersPath)) {
        const adapterFiles = getAllFiles(adaptersPath);
        
        adapterFiles.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          const fileName = path.basename(file);
          
          // Should extend from a port
          expect(content).toMatch(/extends \w+/);
          
          // Should call super() in constructor
          if (content.includes('constructor(')) {
            expect(content).toMatch(/super\(\)/);
          }
          
          // Should not throw "must be implemented"
          expect(content).not.toMatch(/throw.*must be implemented/);
        });
      }
    });
  });
  
  describe('Naming Conventions', () => {
    it('use cases should end with UseCase', () => {
      const useCasesPath = path.join(srcPath, 'application', 'use-cases');
      if (fs.existsSync(useCasesPath)) {
        const files = fs.readdirSync(useCasesPath);
        
        files.forEach(file => {
          if (file.endsWith('.js')) {
            expect(file).toMatch(/UseCase\.js$/);
          }
        });
      }
    });
    
    it('repositories should end with Repository', () => {
      const portsPath = path.join(srcPath, 'application', 'ports');
      if (fs.existsSync(portsPath)) {
        const files = fs.readdirSync(portsPath);
        
        files.filter(f => f.includes('Repository')).forEach(file => {
          expect(file).toMatch(/Repository\.js$/);
        });
      }
    });
    
    it('value objects should be in value-objects directory', () => {
      const voPath = path.join(srcPath, 'domain', 'value-objects');
      expect(fs.existsSync(voPath)).toBe(true);
      
      const files = fs.readdirSync(voPath);
      expect(files.length).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('each layer should have its own error types', () => {
      const layers = ['domain', 'application', 'infrastructure'];
      
      layers.forEach(layer => {
        const errorPath = path.join(srcPath, layer, 'errors');
        if (fs.existsSync(errorPath)) {
          const errorFiles = fs.readdirSync(errorPath);
          expect(errorFiles.length).toBeGreaterThan(0);
          
          // Each should have a base error (e.g., DomainError.js, ApplicationError.js)
          const hasBaseError = errorFiles.some(f => {
            // Check for files like DomainError.js, ApplicationError.js, etc.
            return f.endsWith('Error.js') && !f.includes('.test.');
          });
          expect(hasBaseError).toBe(true);
        }
      });
    });
  });
  
  describe('Configuration', () => {
    it('configuration should be centralized', () => {
      const configPath = path.join(srcPath, 'config');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const configFiles = fs.readdirSync(configPath);
      expect(configFiles).toContain('PlannerConfiguration.js');
    });
    
    it('configuration should validate itself', () => {
      const configFile = path.join(srcPath, 'config', 'PlannerConfiguration.js');
      const content = fs.readFileSync(configFile, 'utf8');
      
      // Should have validate method
      expect(content).toMatch(/validate\(/);
      
      // Should throw errors for invalid config
      expect(content).toMatch(/throw new Error/);
    });
  });
});

// Helper function to recursively get all files in a directory
function getAllFiles(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) return files;
  
  const entries = fs.readdirSync(dirPath);
  
  entries.forEach(entry => {
    const fullPath = path.join(dirPath, entry);
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  
  return files;
}