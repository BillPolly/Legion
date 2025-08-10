/**
 * @fileoverview Basic Module mock for testing without Legion dependencies
 * This is a temporary implementation for TDD development
 */

export class Module {
  constructor(name, dependencies = {}) {
    this.name = name;
    this.dependencies = dependencies;
  }

  getTools() {
    return [];
  }
}