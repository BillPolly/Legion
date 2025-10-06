/**
 * LogStorage - MongoDB logging utilities for evaluation
 *
 * Manages hierarchical logging:
 * - Runs (evaluation_runs collection)
 * - Examples (examples collection)
 * - Turns (turns collection)
 */

export class LogStorage {
  constructor(mongoClient, runId) {
    this.client = mongoClient;
    this.db = mongoClient.db('convfinqa');
    this.runId = runId;

    // Collections
    this.runsCollection = this.db.collection('evaluation_runs');
    this.examplesCollection = this.db.collection('examples');
    this.turnsCollection = this.db.collection('turns');
  }

  /**
   * Create evaluation run record
   */
  async createRun(runData) {
    await this.runsCollection.insertOne({
      ...runData,
      _id: runData.runId
    });
  }

  /**
   * Update run with final results
   */
  async completeRun(updateData) {
    await this.runsCollection.updateOne(
      { _id: this.runId },
      { $set: updateData }
    );
  }

  /**
   * Create example record
   */
  async createExample(exampleData) {
    await this.examplesCollection.insertOne({
      ...exampleData,
      _id: `${exampleData.runId}-${exampleData.conversationId}`
    });
  }

  /**
   * Update example record
   */
  async updateExample(exampleData) {
    const { runId, conversationId, ...updates } = exampleData;

    await this.examplesCollection.updateOne(
      { _id: `${runId}-${conversationId}` },
      { $set: updates }
    );
  }

  /**
   * Log a turn
   */
  async logTurn(turnData) {
    await this.turnsCollection.insertOne({
      ...turnData,
      _id: `${turnData.runId}-${turnData.conversationId}-turn${turnData.turnNumber}`
    });
  }

  /**
   * Update turn record
   */
  async updateTurn(turnData) {
    const { runId, conversationId, turnNumber, ...updates } = turnData;

    await this.turnsCollection.updateOne(
      { _id: `${runId}-${conversationId}-turn${turnNumber}` },
      { $set: updates }
    );
  }

  /**
   * Log agent activity (for debugging)
   */
  async debug(message, data) {
    // Could log to separate agent_logs collection if needed
    console.log(`[DEBUG] ${message}`, data);
  }

  /**
   * Log agent info
   */
  async info(message, data) {
    console.log(`[INFO] ${message}`, data);
  }

  /**
   * Log agent error
   */
  async error(message, data) {
    console.error(`[ERROR] ${message}`, data);
  }

  /**
   * Get run results
   */
  async getRun(runId) {
    return await this.runsCollection.findOne({ _id: runId });
  }

  /**
   * Get all examples for a run
   */
  async getExamples(runId) {
    return await this.examplesCollection
      .find({ runId })
      .toArray();
  }

  /**
   * Get all turns for an example
   */
  async getTurns(runId, conversationId) {
    return await this.turnsCollection
      .find({ runId, conversationId })
      .sort({ turnNumber: 1 })
      .toArray();
  }

  /**
   * Get failed turns for analysis
   */
  async getFailedTurns(runId) {
    return await this.turnsCollection
      .find({ runId, correct: false })
      .toArray();
  }
}
