import fs from 'fs/promises';
import path from 'path';
import { SOPLoadError, SOPValidationError } from './errors/index.js';

export class SOPLoader {
  constructor({ sopStorage, packageRoot }) {
    if (!sopStorage) {
      throw new Error('sopStorage is required');
    }
    if (!packageRoot) {
      throw new Error('packageRoot is required');
    }
    
    this.sopStorage = sopStorage;
    this.packageRoot = packageRoot;
    this.dataDir = path.join(packageRoot, 'data', 'sops');
  }
  
  async discoverSOPFiles() {
    const files = [];
    await this._scanDirectory(this.dataDir, files);
    return files.filter(f => f.endsWith('.json'));
  }
  
  async _scanDirectory(dir, files) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this._scanDirectory(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }
  
  async loadFromFile(filePath) {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new SOPLoadError(
        `Failed to read file: ${error.message}`,
        filePath,
        error
      );
    }
    
    let sopDoc;
    try {
      sopDoc = JSON.parse(content);
    } catch (error) {
      throw new SOPLoadError(
        `Failed to parse JSON: ${error.message}`,
        filePath,
        error
      );
    }
    
    this.validateSOPStructure(sopDoc);
    
    this.assignStepIndices(sopDoc.steps);
    
    if (!sopDoc.toolsMentioned) {
      sopDoc.toolsMentioned = this.extractToolsMentioned(sopDoc);
    }
    
    this.addTimestamps(sopDoc);
    
    const savedSOP = await this.sopStorage.saveSOP(sopDoc);
    
    return savedSOP;
  }
  
  async loadAllFromDataDir() {
    const files = await this.discoverSOPFiles();
    
    const results = {
      loaded: 0,
      failed: 0,
      errors: []
    };
    
    for (const file of files) {
      try {
        await this.loadFromFile(file);
        results.loaded++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          file,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  validateSOPStructure(sopDoc) {
    const errors = [];
    
    if (!sopDoc.title || typeof sopDoc.title !== 'string' || sopDoc.title.trim() === '') {
      errors.push('title is required and must be non-empty string');
    }
    
    if (!sopDoc.intent || typeof sopDoc.intent !== 'string' || sopDoc.intent.trim() === '') {
      errors.push('intent is required and must be non-empty string');
    }
    
    if (!sopDoc.description || typeof sopDoc.description !== 'string' || sopDoc.description.trim() === '') {
      errors.push('description is required and must be non-empty string');
    }
    
    if (!Array.isArray(sopDoc.steps) || sopDoc.steps.length === 0) {
      errors.push('steps must be non-empty array');
    } else {
      sopDoc.steps.forEach((step, i) => {
        if (!step.gloss || typeof step.gloss !== 'string' || step.gloss.trim() === '') {
          errors.push(`step ${i}: gloss is required and must be non-empty string`);
        }
      });
    }
    
    if (errors.length > 0) {
      throw new SOPValidationError(
        'Invalid SOP structure',
        errors,
        sopDoc
      );
    }
  }
  
  assignStepIndices(steps) {
    if (!Array.isArray(steps)) {
      return;
    }
    
    steps.forEach((step, i) => {
      step.index = i;
    });
  }
  
  extractToolsMentioned(sop) {
    if (sop.toolsMentioned) {
      return sop.toolsMentioned;
    }
    
    if (!Array.isArray(sop.steps)) {
      return [];
    }
    
    const tools = new Set();
    
    for (const step of sop.steps) {
      if (Array.isArray(step.suggestedTools)) {
        step.suggestedTools.forEach(tool => tools.add(tool));
      }
    }
    
    return Array.from(tools);
  }
  
  addTimestamps(sop) {
    if (!sop.createdAt) {
      sop.createdAt = new Date();
    }
    sop.updatedAt = new Date();
  }
}