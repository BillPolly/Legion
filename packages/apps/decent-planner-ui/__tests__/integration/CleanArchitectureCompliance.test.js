/**
 * Test to verify Clean Architecture compliance
 * Tests the refactored UI structure with DecentPlanner
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Clean Architecture Compliance for decent-planner-ui', () => {
  const srcPath = path.join(__dirname, '../../src');
  
  describe('Layer Structure', () => {
    test('should have all required layers', () => {
      const layers = ['domain', 'application', 'infrastructure'];
      
      layers.forEach(layer => {
        const layerPath = path.join(srcPath, layer);
        expect(fs.existsSync(layerPath)).toBe(true);
      });
    });
    
    test('domain layer should have correct structure', () => {
      const domainPath = path.join(srcPath, 'domain');
      const requiredDirs = ['entities', 'value-objects', 'services', 'errors'];
      
      requiredDirs.forEach(dir => {
        const dirPath = path.join(domainPath, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      });
    });
    
    test('application layer should have correct structure', () => {
      const appPath = path.join(srcPath, 'application');
      const requiredDirs = ['use-cases', 'ports', 'errors'];
      
      requiredDirs.forEach(dir => {
        const dirPath = path.join(appPath, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      });
    });
    
    test('infrastructure layer should have adapters', () => {
      const infraPath = path.join(srcPath, 'infrastructure');
      const requiredDirs = ['adapters', 'errors'];
      
      requiredDirs.forEach(dir => {
        const dirPath = path.join(infraPath, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      });
    });
  });
  
  describe('Domain Entities', () => {
    test('should have core domain entities', () => {
      const entitiesPath = path.join(srcPath, 'domain/entities');
      const requiredEntities = [
        'PlanningSession.js',
        'ToolSearchQuery.js',
        'ExecutionState.js'
      ];
      
      requiredEntities.forEach(entity => {
        const entityPath = path.join(entitiesPath, entity);
        expect(fs.existsSync(entityPath)).toBe(true);
      });
    });
    
    test('should have value objects', () => {
      const voPath = path.join(srcPath, 'domain/value-objects');
      const requiredVOs = [
        'PlanningGoal.js',
        'PlanningMode.js',
        'SearchType.js',
        'ExecutionStatus.js'
      ];
      
      requiredVOs.forEach(vo => {
        const voFilePath = path.join(voPath, vo);
        expect(fs.existsSync(voFilePath)).toBe(true);
      });
    });
  });
  
  describe('Application Layer', () => {
    test('should have use cases', () => {
      const useCasesPath = path.join(srcPath, 'application/use-cases');
      const requiredUseCases = [
        'StartPlanningUseCase.js',
        'CancelPlanningUseCase.js',
        'DiscoverToolsUseCase.js',
        'SearchToolsUseCase.js',
        'SavePlanUseCase.js',
        'LoadPlanUseCase.js'
      ];
      
      requiredUseCases.forEach(useCase => {
        const useCasePath = path.join(useCasesPath, useCase);
        expect(fs.existsSync(useCasePath)).toBe(true);
      });
    });
    
    test('should have port interfaces', () => {
      const portsPath = path.join(srcPath, 'application/ports');
      const requiredPorts = [
        'PlannerService.js',
        'ActorCommunication.js',
        'UIRenderer.js',
        'PlanStorage.js'
      ];
      
      requiredPorts.forEach(port => {
        const portPath = path.join(portsPath, port);
        expect(fs.existsSync(portPath)).toBe(true);
      });
    });
  });
  
  describe('Infrastructure Adapters', () => {
    test('should have DecentPlannerAdapter', () => {
      const adapterPath = path.join(
        srcPath, 
        'infrastructure/adapters/DecentPlannerAdapter.js'
      );
      expect(fs.existsSync(adapterPath)).toBe(true);
    });
    
    test('should have ServerPlannerActor', () => {
      const actorPath = path.join(
        srcPath,
        'actors/ServerPlannerActor.js'
      );
      expect(fs.existsSync(actorPath)).toBe(true);
    });
  });
  
  describe('Dependency Rules', () => {
    test('domain layer should not import from other layers', () => {
      const domainFiles = getAllFiles(path.join(srcPath, 'domain'));
      
      domainFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for imports from application or infrastructure
        expect(content).not.toMatch(/from ['"].*application/);
        expect(content).not.toMatch(/from ['"].*infrastructure/);
        expect(content).not.toMatch(/require\(['"].*application/);
        expect(content).not.toMatch(/require\(['"].*infrastructure/);
      });
    });
    
    test('application layer should not import from infrastructure', () => {
      const appFiles = getAllFiles(path.join(srcPath, 'application'));
      
      appFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for imports from infrastructure
        expect(content).not.toMatch(/from ['"].*infrastructure/);
        expect(content).not.toMatch(/require\(['"].*infrastructure/);
      });
    });
  });
  
  describe('Error Hierarchy', () => {
    test('should have proper error classes', () => {
      const errorFiles = [
        'domain/errors/DomainError.js',
        'application/errors/ApplicationError.js',
        'infrastructure/errors/InfrastructureError.js'
      ];
      
      errorFiles.forEach(errorFile => {
        const errorPath = path.join(srcPath, errorFile);
        expect(fs.existsSync(errorPath)).toBe(true);
      });
    });
  });
  
  describe('MVVM Pattern Preservation', () => {
    test('UI components should maintain MVVM structure', () => {
      const componentsPath = path.join(srcPath, 'components');
      
      if (fs.existsSync(componentsPath)) {
        const componentFiles = fs.readdirSync(componentsPath);
        
        componentFiles.forEach(file => {
          if (file.endsWith('.js')) {
            const content = fs.readFileSync(path.join(componentsPath, file), 'utf-8');
            
            // Check for model property
            expect(content).toMatch(/this\.model\s*=/);
            
            // Check for render or createView method (MVVM pattern)
            expect(content.match(/render\s*\(/) || content.match(/createView\s*\(/)).toBeTruthy();
          }
        });
      }
    });
  });
  
  describe('Actor Pattern Integration', () => {
    test('ServerPlannerActor should use DecentPlanner', () => {
      const actorPath = path.join(srcPath, 'actors/ServerPlannerActor.js');
      const content = fs.readFileSync(actorPath, 'utf-8');
      
      // Should import DecentPlanner
      expect(content).toMatch(/DecentPlanner/);
      
      // Should not import old DecentPlanner
      expect(content).not.toMatch(/from ['"].*DecentPlanner['"];?\s*$/m);
      
      // Should have proper initialization
      expect(content).toMatch(/new DecentPlanner/);
    });
    
    test('should maintain actor messaging protocol', () => {
      const actorPath = path.join(srcPath, 'actors/ServerPlannerActor.js');
      const content = fs.readFileSync(actorPath, 'utf-8');
      
      // Should have receive method
      expect(content).toMatch(/receive\s*\(/);
      
      // Should have setRemoteActor method
      expect(content).toMatch(/setRemoteActor/);
      
      // Should handle key messages
      const requiredMessages = [
        'plan-informal',
        'plan-formal',
        'discover-tools',
        'cancel'
      ];
      
      requiredMessages.forEach(msg => {
        expect(content).toMatch(new RegExp(`['"]${msg}['"]`));
      });
    });
  });
});

// Helper function to get all files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.js')) {
      arrayOfFiles.push(filePath);
    }
  });
  
  return arrayOfFiles;
}