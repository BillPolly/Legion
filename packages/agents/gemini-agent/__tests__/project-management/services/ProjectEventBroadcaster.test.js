/**
 * ProjectEventBroadcaster Tests
 * Unit tests for WebSocket-based project event broadcasting
 */

import { ProjectEventBroadcaster } from '../../../src/project-management/services/ProjectEventBroadcaster.js';

describe('ProjectEventBroadcaster', () => {
  let broadcaster;
  let mockRemoteActor;

  beforeEach(() => {
    // Mock actor for WebSocket communication
    mockRemoteActor = {
      receive: (messageType, data) => {
        mockRemoteActor.lastMessage = { messageType, data };
      },
      lastMessage: null
    };

    broadcaster = new ProjectEventBroadcaster({
      remoteActor: mockRemoteActor
    });
  });

  describe('constructor', () => {
    test('should create broadcaster with actor reference', () => {
      expect(broadcaster.remoteActor).toBe(mockRemoteActor);
      expect(broadcaster.eventQueue).toEqual([]);
      expect(broadcaster.subscribers).toBeInstanceOf(Map);
    });
  });

  describe('subscribe', () => {
    test('should subscribe client to project updates', async () => {
      const result = await broadcaster.subscribe('client-001', 'project-001');
      
      expect(result.success).toBe(true);
      expect(result.clientId).toBe('client-001');
      expect(result.projectId).toBe('project-001');
      expect(broadcaster.subscribers.has('client-001')).toBe(true);
    });

    test('should handle multiple subscriptions per client', async () => {
      await broadcaster.subscribe('client-001', 'project-001');
      await broadcaster.subscribe('client-001', 'project-002');

      const clientSub = broadcaster.subscribers.get('client-001');
      expect(clientSub.projectIds).toContain('project-001');
      expect(clientSub.projectIds).toContain('project-002');
      expect(clientSub.projectIds).toHaveLength(2);
    });
  });

  describe('unsubscribe', () => {
    test('should unsubscribe client from project updates', async () => {
      await broadcaster.subscribe('client-001', 'project-001');
      expect(broadcaster.subscribers.has('client-001')).toBe(true);

      const result = await broadcaster.unsubscribe('client-001', 'project-001');
      expect(result.success).toBe(true);
    });

    test('should remove client completely when no subscriptions remain', async () => {
      await broadcaster.subscribe('client-001', 'project-001');
      await broadcaster.unsubscribe('client-001', 'project-001');

      expect(broadcaster.subscribers.has('client-001')).toBe(false);
    });
  });

  describe('broadcastUpdate', () => {
    test('should broadcast update through actor framework', async () => {
      const updateData = {
        type: 'deliverable_completed',
        projectId: 'project-001',
        deliverableId: 'del-001',
        completion: 100
      };

      const result = await broadcaster.broadcastUpdate(updateData);
      
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(mockRemoteActor.lastMessage.messageType).toBe('project_update');
      expect(mockRemoteActor.lastMessage.data.type).toBe('deliverable_completed');
      expect(mockRemoteActor.lastMessage.data.projectId).toBe('project-001');
    });

    test('should add update to event queue', async () => {
      const updateData = {
        type: 'phase_transition',
        projectId: 'project-001',
        fromPhase: 'requirements',
        toPhase: 'domain'
      };

      await broadcaster.broadcastUpdate(updateData);
      
      expect(broadcaster.eventQueue).toHaveLength(1);
      expect(broadcaster.eventQueue[0].type).toBe('phase_transition');
      expect(broadcaster.eventQueue[0].projectId).toBe('project-001');
    });
  });

  describe('broadcastToSubscribers', () => {
    test('should broadcast only to subscribed clients for specific project', async () => {
      // Subscribe different clients to different projects
      await broadcaster.subscribe('client-001', 'project-001');
      await broadcaster.subscribe('client-002', 'project-002');
      await broadcaster.subscribe('client-003', 'project-001'); // Same project as client-001

      const updateData = {
        type: 'status_change',
        projectId: 'project-001',
        newStatus: 'active'
      };

      const result = await broadcaster.broadcastToSubscribers('project-001', updateData);
      
      expect(result.success).toBe(true);
      expect(result.subscriberCount).toBe(2); // client-001 and client-003
      expect(result.projectId).toBe('project-001');
    });
  });

  describe('getSubscriberCount', () => {
    test('should return correct subscriber count for project', async () => {
      await broadcaster.subscribe('client-001', 'project-001');
      await broadcaster.subscribe('client-002', 'project-001');
      await broadcaster.subscribe('client-003', 'project-002');

      const count1 = await broadcaster.getSubscriberCount('project-001');
      expect(count1).toBe(2);

      const count2 = await broadcaster.getSubscriberCount('project-002');
      expect(count2).toBe(1);

      const countNone = await broadcaster.getSubscriberCount('project-nonexistent');
      expect(countNone).toBe(0);
    });
  });

  describe('getEventHistory', () => {
    test('should return recent events from queue', async () => {
      // Broadcast several events
      await broadcaster.broadcastUpdate({
        type: 'event1',
        projectId: 'project-001'
      });

      await broadcaster.broadcastUpdate({
        type: 'event2', 
        projectId: 'project-001'
      });

      await broadcaster.broadcastUpdate({
        type: 'event3',
        projectId: 'project-002'
      });

      const allHistory = await broadcaster.getEventHistory();
      expect(allHistory).toHaveLength(3);

      const project1History = await broadcaster.getEventHistory('project-001');
      expect(project1History).toHaveLength(2);
      expect(project1History.map(e => e.type)).toEqual(['event1', 'event2']);

      const limitedHistory = await broadcaster.getEventHistory('project-001', 1);
      expect(limitedHistory).toHaveLength(1);
      expect(limitedHistory[0].type).toBe('event2'); // Most recent
    });
  });

  describe('clearEventQueue', () => {
    test('should clear event queue', async () => {
      await broadcaster.broadcastUpdate({
        type: 'test_event',
        projectId: 'project-001'
      });

      expect(broadcaster.eventQueue).toHaveLength(1);

      await broadcaster.clearEventQueue();
      expect(broadcaster.eventQueue).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    test('should return broadcaster statistics', async () => {
      await broadcaster.subscribe('client-001', 'project-001');
      await broadcaster.subscribe('client-002', 'project-001');
      await broadcaster.broadcastUpdate({
        type: 'test_event',
        projectId: 'project-001'
      });

      const stats = await broadcaster.getStatistics();
      
      expect(stats.totalSubscribers).toBe(2);
      expect(stats.totalEvents).toBe(1);
      expect(stats.uniqueProjects).toBe(1);
      expect(stats.eventQueueSize).toBe(1);
    });
  });
});