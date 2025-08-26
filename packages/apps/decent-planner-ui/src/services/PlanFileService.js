/**
 * Simple file service for saving and loading planning results
 * Handles JSON file I/O operations for plan persistence
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlanFileService {
  constructor() {
    // saved-plans directory is at package root
    this.plansDir = path.join(__dirname, '../../saved-plans');
    this.ensurePlansDirectory();
  }

  async ensurePlansDirectory() {
    try {
      await fs.access(this.plansDir);
    } catch {
      await fs.mkdir(this.plansDir, { recursive: true });
    }
  }

  /**
   * Save a plan with the given name
   */
  async savePlan(name, informalResult, formalResult) {
    if (!name || !name.trim()) {
      throw new Error('Plan name is required');
    }

    const sanitizedName = name.trim().replace(/[^a-zA-Z0-9\s\-_]/g, '');
    const filename = `${sanitizedName.replace(/\s+/g, '-')}.json`;
    const filepath = path.join(this.plansDir, filename);

    const planData = {
      name: name.trim(),
      savedAt: new Date().toISOString(),
      informalResult: informalResult || null,
      formalResult: formalResult || null,
      toolsUsed: this.extractToolsUsed(formalResult)
    };

    await fs.writeFile(filepath, JSON.stringify(planData, null, 2), 'utf8');
    return { success: true, filename, path: filepath };
  }

  /**
   * Load a plan by filename
   */
  async loadPlan(filename) {
    const filepath = path.join(this.plansDir, filename);
    
    try {
      const content = await fs.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load plan: ${error.message}`);
    }
  }

  /**
   * List all saved plans
   */
  async listPlans() {
    try {
      const files = await fs.readdir(this.plansDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const plans = [];
      for (const file of jsonFiles) {
        try {
          const planData = await this.loadPlan(file);
          plans.push({
            filename: file,
            name: planData.name,
            savedAt: planData.savedAt,
            toolsUsed: planData.toolsUsed || [],
            hasInformal: !!planData.informalResult,
            hasFormal: !!planData.formalResult
          });
        } catch (error) {
          console.warn(`Failed to read plan ${file}:`, error.message);
        }
      }

      return plans.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    } catch (error) {
      console.error('Failed to list plans:', error);
      return [];
    }
  }

  /**
   * Delete a saved plan
   */
  async deletePlan(filename) {
    const filepath = path.join(this.plansDir, filename);
    
    try {
      await fs.unlink(filepath);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete plan: ${error.message}`);
    }
  }

  /**
   * Extract tools used from formal result
   */
  extractToolsUsed(formalResult) {
    if (!formalResult?.behaviorTrees) return [];

    const tools = new Set();
    
    const extractFromNode = (node) => {
      if (node.tool) {
        tools.add(node.tool);
      }
      if (node.children) {
        node.children.forEach(extractFromNode);
      }
      if (node.child) {
        extractFromNode(node.child);
      }
    };

    formalResult.behaviorTrees.forEach(tree => {
      extractFromNode(tree);
    });

    return Array.from(tools);
  }
}

// Export singleton instance
export default new PlanFileService();