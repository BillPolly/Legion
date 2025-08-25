/**
 * Todo App Configuration
 * Simple configuration-driven actor server example
 */

export default {
  name: 'todo-app',
  port: 8081,
  routes: [
    {
      path: '/todos',
      serverActor: './actors/ServerTodoActor.js',
      clientActor: './actors/ClientTodoActor.js'
    }
  ],
  static: {
    '/assets': './public'
  }
};