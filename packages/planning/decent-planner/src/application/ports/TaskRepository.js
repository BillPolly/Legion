/**
 * TaskRepository Interface - Port for task persistence
 * Following Clean Architecture - defines the contract for task storage
 */

export class TaskRepository {
  /**
   * Save a task
   * @param {Task} task - The task to save
   * @returns {Promise<Task>} The saved task
   */
  async save(task) {
    throw new Error('TaskRepository.save() must be implemented');
  }

  /**
   * Find a task by ID
   * @param {TaskId} taskId - The task ID
   * @returns {Promise<Task|null>} The task or null if not found
   */
  async findById(taskId) {
    throw new Error('TaskRepository.findById() must be implemented');
  }

  /**
   * Find tasks by parent ID
   * @param {TaskId} parentId - The parent task ID
   * @returns {Promise<Task[]>} Array of child tasks
   */
  async findByParentId(parentId) {
    throw new Error('TaskRepository.findByParentId() must be implemented');
  }

  /**
   * Find tasks by complexity
   * @param {TaskComplexity} complexity - The complexity to filter by
   * @returns {Promise<Task[]>} Array of tasks with the given complexity
   */
  async findByComplexity(complexity) {
    throw new Error('TaskRepository.findByComplexity() must be implemented');
  }

  /**
   * Update a task
   * @param {Task} task - The task to update
   * @returns {Promise<Task>} The updated task
   */
  async update(task) {
    throw new Error('TaskRepository.update() must be implemented');
  }

  /**
   * Delete a task
   * @param {TaskId} taskId - The task ID to delete
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async delete(taskId) {
    throw new Error('TaskRepository.delete() must be implemented');
  }

  /**
   * Save a complete task hierarchy
   * @param {Task} rootTask - The root task of the hierarchy
   * @returns {Promise<Task>} The saved hierarchy
   */
  async saveHierarchy(rootTask) {
    throw new Error('TaskRepository.saveHierarchy() must be implemented');
  }

  /**
   * Load a complete task hierarchy
   * @param {TaskId} rootTaskId - The root task ID
   * @returns {Promise<Task>} The complete hierarchy
   */
  async loadHierarchy(rootTaskId) {
    throw new Error('TaskRepository.loadHierarchy() must be implemented');
  }
}