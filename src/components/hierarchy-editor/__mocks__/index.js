/**
 * Mock HierarchyEditor for testing
 */

export const HierarchyEditor = {
  create: jest.fn((config) => {
    const mockEditor = {
      render: jest.fn(),
      destroy: jest.fn(),
      setMode: jest.fn(),
      expandAll: jest.fn(),
      collapseAll: jest.fn(),
      loadContent: jest.fn(),
      setContent: jest.fn(),
      getContent: jest.fn(() => '{"test": "data"}'),
      addNode: jest.fn(),
      editNode: jest.fn(),
      deleteNode: jest.fn(),
      bulkOperation: jest.fn((fn) => fn()),
      getTreeData: jest.fn(() => ({ id: 'root', children: [] })),
      setTheme: jest.fn(),
      setEditable: jest.fn(),
      validate: jest.fn(() => ({ valid: true }))
    };
    
    // Call mount callback if provided
    if (config.onMount) {
      config.onMount(mockEditor);
    }
    
    return mockEditor;
  })
};