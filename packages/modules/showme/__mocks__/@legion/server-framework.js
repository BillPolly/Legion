/**
 * Mock for @legion/server-framework
 */

export class ConfigurableActorServer {
  constructor(config) {
    this.config = config;
    this.started = false;
    this.port = config.port || 3000;
    this.actors = new Map();
  }

  async initialize() {
    // Mock initialize
  }

  async start() {
    this.started = true;
    return { port: this.port };
  }

  async stop() {
    this.started = false;
  }

  registerActor(name, actor) {
    this.actors.set(name, actor);
  }

  getActor(name) {
    return this.actors.get(name);
  }
}