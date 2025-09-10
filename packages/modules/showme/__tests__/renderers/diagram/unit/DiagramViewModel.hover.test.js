/**
 * Unit tests for DiagramViewModel hover functionality
 */

import { DiagramViewModel } from '../../../../src/renderers/diagram/viewmodel/DiagramViewModel.js';
import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';
import { DiagramView } from '../../../../src/renderers/diagram/view/DiagramView.js';
import { 
  createTestDOM, 
  cleanupTestDOM,
  createSampleDiagramData 
} from '../test-setup.js';

describe('DiagramViewModel - Hover States', () => {
  let dom;
  let container;
  let viewModel;
  let view;
  let layoutEngine;

  beforeEach(() => {
    dom = createTestDOM();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    layoutEngine = new DiagramLayoutEngine();
    view = new DiagramView(container);
    viewModel = new DiagramViewModel({
      layoutEngine,
      view
    });
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Hover State Management', () => {
    test('should set hovered element', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');

      const state = viewModel.getState();
      expect(state.hoveredElement).toBe('node1');
    });

    test('should clear hovered element', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      expect(viewModel.getState().hoveredElement).toBe('node1');

      viewModel.clearHoveredElement();
      expect(viewModel.getState().hoveredElement).toBeNull();
    });

    test('should update hovered element', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      expect(viewModel.getState().hoveredElement).toBe('node1');

      viewModel.setHoveredElement('edge1');
      expect(viewModel.getState().hoveredElement).toBe('edge1');
    });

    test('should not set hover for non-existent elements', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('non-existent');
      expect(viewModel.getState().hoveredElement).toBeNull();
    });
  });

  describe('Hover Events', () => {
    test('should emit hover change event', (done) => {
      const data = createSampleDiagramData();
      
      let changeCount = 0;
      const onHoverChange = (elementInfo) => {
        changeCount++;
        if (changeCount === 1) {
          expect(elementInfo.id).toBe('node1');
          expect(elementInfo.type).toBe('node');
          done();
        }
      };

      viewModel = new DiagramViewModel({
        layoutEngine,
        view,
        onHoverChange
      });
      viewModel.setDiagramData(data);
      viewModel.setHoveredElement('node1');
    });

    test('should emit hover end event', (done) => {
      const data = createSampleDiagramData();
      
      const onHoverEnd = () => {
        done();
      };

      viewModel = new DiagramViewModel({
        layoutEngine,
        view,
        onHoverEnd
      });
      viewModel.setDiagramData(data);
      
      viewModel.setHoveredElement('node1');
      viewModel.clearHoveredElement();
    });

    test('should not emit event if hover unchanged', () => {
      const data = createSampleDiagramData();
      
      let changeCount = 0;
      const onHoverChange = () => { changeCount++; };

      viewModel = new DiagramViewModel({
        layoutEngine,
        view,
        onHoverChange
      });
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      expect(changeCount).toBe(1);

      // Setting same hover again should not trigger event
      viewModel.setHoveredElement('node1');
      expect(changeCount).toBe(1);
    });
  });

  describe('Hover Information', () => {
    test('should get hover info for node', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      const info = viewModel.getHoverInfo();

      expect(info).toBeDefined();
      expect(info.id).toBe('node1');
      expect(info.type).toBe('node');
      expect(info.data).toBeDefined();
      expect(info.data.label).toBe('User');
    });

    test('should get hover info for edge', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('edge1');
      const info = viewModel.getHoverInfo();

      expect(info).toBeDefined();
      expect(info.id).toBe('edge1');
      expect(info.type).toBe('edge');
      expect(info.data).toBeDefined();
      expect(info.data.source).toBe('node1');
      expect(info.data.target).toBe('node2');
    });

    test('should return null for no hover', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      const info = viewModel.getHoverInfo();
      expect(info).toBeNull();
    });
  });

  describe('Hover Interaction with Selection', () => {
    test('should maintain hover state during selection', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      viewModel.selectNode('node2');

      expect(viewModel.getState().hoveredElement).toBe('node1');
      expect(viewModel.getState().selection.has('node2')).toBe(true);
    });

    test('should clear hover when element is deleted', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      expect(viewModel.getState().hoveredElement).toBe('node1');

      // Remove the node
      const newData = {
        ...data,
        nodes: data.nodes.filter(n => n.id !== 'node1')
      };
      viewModel.setDiagramData(newData);

      expect(viewModel.getState().hoveredElement).toBeNull();
    });
  });

  describe('Hover Visual State', () => {
    test('should indicate if element is both hovered and selected', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.setHoveredElement('node1');

      expect(viewModel.isSelected('node1')).toBe(true);
      expect(viewModel.isHovered('node1')).toBe(true);
    });

    test('should get hover display properties', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.setHoveredElement('node1');
      const props = viewModel.getElementDisplayProperties('node1');

      expect(props.isHovered).toBe(true);
      expect(props.isSelected).toBe(false);
    });

    test('should get combined display properties', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.setHoveredElement('node1');
      const props = viewModel.getElementDisplayProperties('node1');

      expect(props.isHovered).toBe(true);
      expect(props.isSelected).toBe(true);
    });
  });
});