/**
 * HierarchyEditorDemoViewModel - ViewModel for the HierarchyEditor demo component
 * 
 * Coordinates between Model and View, handling user interactions
 */

import { BaseViewModel } from '@legion/components';
import { HierarchyEditor } from '../../hierarchy-editor/index.js';

// Mock HierarchyEditor for fallback (remove this once real component is working)
const MockHierarchyEditor = {
  create(config) {
    const editor = {
      _config: config,
      _content: config.content || '{"name": "Click to edit", "version": "1.0.0", "editable": true}',
      _mode: config.defaultMode || 'tree',
      _document: null, // Generic document structure
      _format: null,
      _editingElement: null,
      _expandedNodes: new Set(), // Track which nodes are expanded
      
      render() {
        if (!config.dom) return;
        
        const format = this._detectFormat(this._content);
        config.dom.innerHTML = `
          <div style="padding: 10px; background: #f9f9f9; border: 1px solid #ddd; height: 100%; overflow: auto;" class="real-editor">
            <div style="margin-bottom: 10px; padding: 5px; background: #e8f5e8; border-radius: 3px; font-size: 12px; border-left: 3px solid #4caf50;">
              <strong>✏️ Live Editor</strong> | Format: ${format} | Mode: ${this._mode} | <em>Click values to edit!</em>
            </div>
            <div class="editor-content">
              ${this._mode === 'tree' ? this._renderTree() : this._renderSource()}
            </div>
          </div>
        `;
        
        // Add click handlers for editing
        this._setupEditHandlers();
      },
      
      _detectFormat(content) {
        if (!content || typeof content !== 'string') {
          return 'json'; // Default fallback
        }
        
        try {
          const trimmed = content.trim();
          if (!trimmed) return 'json'; // Empty content defaults to JSON
          
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
          if (trimmed.startsWith('<')) return 'xml';
          if (trimmed.match(/^[\w-]+:\s*[\w\[\{]/) || trimmed.includes('\n  ')) return 'yaml';
          if (trimmed.startsWith('#')) return 'markdown';
          return 'text';
        } catch (e) {
          console.warn('Error detecting format:', e);
          return 'json'; // Safe fallback
        }
      },
      
      _parseToGenericDocument(content, format) {
        try {
          switch (format) {
            case 'json':
              return this._parseJsonToDocument(JSON.parse(content));
            case 'xml':
              return this._parseXmlToDocument(content);
            case 'yaml':
              return this._parseYamlToDocument(content);
            case 'markdown':
              return this._parseMarkdownToDocument(content);
            default:
              return this._parseTextToDocument(content);
          }
        } catch (e) {
          return { type: 'error', message: e.message, content: content };
        }
      },
      
      _parseJsonToDocument(data, path = '') {
        if (Array.isArray(data)) {
          return {
            type: 'array',
            path: path,
            children: data.map((item, i) => this._parseJsonToDocument(item, `${path}[${i}]`))
          };
        } else if (typeof data === 'object' && data !== null) {
          return {
            type: 'object',
            path: path,
            children: Object.entries(data).map(([key, value]) => ({
              type: 'property',
              key: key,
              keyEditable: true,
              path: path ? `${path}.${key}` : key,
              value: this._parseJsonToDocument(value, path ? `${path}.${key}` : key)
            }))
          };
        } else {
          return {
            type: 'value',
            dataType: typeof data,
            value: data,
            path: path,
            editable: true
          };
        }
      },
      
      _parseXmlToDocument(content) {
        // Simple XML parsing - in real implementation, use DOMParser
        const match = content.match(/<(\w+)([^>]*)>(.*?)<\/\1>/s);
        if (match) {
          const [, tagName, attributes, innerContent] = match;
          return {
            type: 'element',
            tag: tagName,
            tagEditable: true,
            attributes: this._parseXmlAttributes(attributes),
            children: this._parseXmlContent(innerContent),
            path: tagName
          };
        }
        return { type: 'text', value: content, editable: true, path: '' };
      },
      
      _parseXmlAttributes(attrString) {
        const attrs = [];
        const matches = attrString.matchAll(/(\w+)="([^"]*)"/g);
        for (const [, name, value] of matches) {
          attrs.push({
            type: 'attribute',
            name: name,
            nameEditable: true,
            value: value,
            valueEditable: true,
            path: `@${name}`
          });
        }
        return attrs;
      },
      
      _parseXmlContent(content) {
        const trimmed = content.trim();
        if (trimmed.includes('<')) {
          // Contains nested elements - parse recursively
          return [this._parseXmlToDocument(trimmed)];
        } else {
          // Text content
          return [{
            type: 'text',
            value: trimmed,
            editable: true,
            path: 'text()'
          }];
        }
      },
      
      _parseYamlToDocument(content) {
        // Simple YAML parsing - split by lines and analyze indentation
        const lines = content.split('\n').filter(line => line.trim());
        return this._parseYamlLines(lines, 0, '');
      },
      
      _parseYamlLines(lines, startIndex, path) {
        const children = [];
        let i = startIndex;
        const baseIndent = this._getIndentation(lines[startIndex] || '');
        
        while (i < lines.length) {
          const line = lines[i];
          const indent = this._getIndentation(line);
          
          if (indent < baseIndent) break; // End of this level
          if (indent > baseIndent) {
            i++; // Skip, will be handled by child
            continue;
          }
          
          const trimmed = line.trim();
          if (trimmed.includes(':')) {
            const [key, value] = trimmed.split(':', 2);
            const keyTrimmed = key.trim();
            const valueTrimmed = value?.trim();
            
            if (!valueTrimmed || valueTrimmed === '') {
              // Object with children
              const childPath = path ? `${path}.${keyTrimmed}` : keyTrimmed;
              const childResult = this._parseYamlLines(lines, i + 1, childPath);
              children.push({
                type: 'property',
                key: keyTrimmed,
                keyEditable: true,
                path: childPath,
                value: {
                  type: 'object',
                  children: childResult.children
                }
              });
              i = childResult.nextIndex;
            } else {
              // Simple key-value
              children.push({
                type: 'property',
                key: keyTrimmed,
                keyEditable: true,
                path: path ? `${path}.${keyTrimmed}` : keyTrimmed,
                value: {
                  type: 'value',
                  dataType: 'string',
                  value: valueTrimmed,
                  editable: true
                }
              });
              i++;
            }
          } else if (trimmed.startsWith('-')) {
            // Array item
            const itemValue = trimmed.substring(1).trim();
            children.push({
              type: 'arrayItem',
              index: children.filter(c => c.type === 'arrayItem').length,
              value: {
                type: 'value',
                dataType: 'string',
                value: itemValue,
                editable: true
              }
            });
            i++;
          } else {
            i++;
          }
        }
        
        return { children, nextIndex: i };
      },
      
      _getIndentation(line) {
        return line.length - line.trimStart().length;
      },
      
      _parseMarkdownToDocument(content) {
        const lines = content.split('\n');
        const children = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#')) {
            const level = (line.match(/^#+/) || [''])[0].length;
            const text = trimmed.substring(level).trim();
            children.push({
              type: 'heading',
              level: level,
              text: text,
              editable: true,
              path: `h${level}`
            });
          } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const text = trimmed.substring(1).trim();
            children.push({
              type: 'listItem',
              text: text,
              editable: true,
              path: 'li'
            });
          } else if (trimmed) {
            children.push({
              type: 'paragraph',
              text: trimmed,
              editable: true,
              path: 'p'
            });
          }
        }
        
        return { type: 'document', children };
      },
      
      _parseTextToDocument(content) {
        return {
          type: 'text',
          value: content,
          editable: true,
          path: ''
        };
      },
      
      _renderTree() {
        try {
          this._format = this._detectFormat(this._content);
          
          if (this._format === 'json') {
            this._data = JSON.parse(this._content);
            
            // Initialize default expansion state for top-level keys
            if (this._expandedNodes.size === 0) {
              // Always expand the root level and first child level
              this._expandedNodes.add(''); // Expand root
              this._initializeDefaultExpansion(this._data, '', 3); // Expand first 3 levels by default
            }
            
            return `<div style="font-family: monospace; font-size: 13px; line-height: 1.6;" class="tree-view">${this._renderJsonNode(this._data, 0, '')}</div>`;
          } else {
            // For other formats, use generic approach (simplified for now)
            this._document = this._parseToGenericDocument(this._content, this._format);
            
            if (this._document.type === 'error') {
              return `<div style="color: #d32f2f; padding: 10px; background: #ffebee; border-radius: 4px;">
                <strong>Parse Error:</strong> ${this._document.message}<br>
                <small>Switch to Source mode to fix the syntax</small>
              </div>`;
            }
            
            return `<div style="font-family: monospace; font-size: 13px; line-height: 1.6;" class="tree-view">${this._renderGenericNode(this._document, 0)}</div>`;
          }
        } catch (e) {
          return `<div style="color: #d32f2f; padding: 10px; background: #ffebee; border-radius: 4px;">
            <strong>Parse Error:</strong> ${e.message}<br>
            <small>Switch to Source mode to fix the syntax</small>
          </div>`;
        }
      },
      
      _renderJsonNode(node, depth = 0, path = '') {
        // Use proper div-based indentation instead of &nbsp;
        const indentStyle = `margin-left: ${depth * 20}px;`;
        const childIndentStyle = `margin-left: ${(depth + 1) * 20}px;`;
        
        if (Array.isArray(node)) {
          if (node.length === 0) {
            return `<span style="color: #666;">[]</span>`;
          }
          
          const isExpanded = this._expandedNodes.has(path);
          const arrow = this._createExpandArrow(path, isExpanded);
          
          if (!isExpanded) {
            // Collapsed array - show just the arrow and summary
            return `<span>${arrow} <span style="color: #666; cursor: pointer;" data-expand-path="${path}" title="Click to expand">[${node.length} items...]</span></span>`;
          }
          
          const items = node.map((item, i) => {
            const itemPath = path ? `${path}[${i}]` : `[${i}]`;
            return `<div style="${childIndentStyle}"><span style="color: #666;">[${i}]</span> ${this._renderJsonNode(item, depth + 1, itemPath)}</div>`;
          });
          return `<div style="color: #333;">${arrow}[<br>${items.join('')}<div style="${indentStyle}">]</div></div>`;
        } else if (typeof node === 'object' && node !== null) {
          if (Object.keys(node).length === 0) {
            return `<span style="color: #666;">{}</span>`;
          }
          
          const isExpanded = this._expandedNodes.has(path);
          const arrow = this._createExpandArrow(path, isExpanded);
          
          if (!isExpanded) {
            // Collapsed object - show just the arrow and summary
            const keyCount = Object.keys(node).length;
            return `<span>${arrow} <span style="color: #666; cursor: pointer;" data-expand-path="${path}" title="Click to expand">{${keyCount} properties...}</span></span>`;
          }
          
          const entries = Object.entries(node).map(([key, value]) => {
            const keyPath = path ? `${path}.${key}` : key;
            const keyElement = `<span class="editable-key" data-path="${keyPath}" data-type="key" 
                                     style="color: #881391; font-weight: bold; cursor: pointer; 
                                            padding: 1px 3px; border-radius: 2px; background: #f8f8f8;
                                            border: 1px solid transparent;" 
                                     title="Click to edit key">"${key}"</span>`;
            return `<div style="${childIndentStyle}">${keyElement}: ${this._renderJsonNode(value, depth + 1, keyPath)}</div>`;
          });
          return `<div style="color: #333;">${arrow}{<br>${entries.join('')}<div style="${indentStyle}">}</div></div>`;
        } else {
          // Primitive value
          const isEditable = true;
          const color = typeof node === 'string' ? '#0d7d21' : typeof node === 'number' ? '#1976d2' : '#9c27b0';
          const displayValue = typeof node === 'string' ? `"${node}"` : String(node);
          
          if (isEditable) {
            return `<span class="editable-value" 
                          data-path="${path}" 
                          data-type="${typeof node}"
                          style="color: ${color}; 
                                 cursor: pointer; 
                                 padding: 2px 4px; 
                                 border-radius: 3px;
                                 background: #f5f5f5;
                                 border: 1px solid transparent;
                                 transition: all 0.2s;" 
                          title="Click to edit">${displayValue}</span>`;
          }
          return `<span style="color: ${color}">${displayValue}</span>`;
        }
      },
      
      _createExpandArrow(path, isExpanded) {
        const arrowSymbol = isExpanded ? '▼' : '▶';
        return `<span class="expand-arrow" 
                      data-expand-path="${path}" 
                      style="cursor: pointer; 
                             user-select: none; 
                             margin-right: 5px; 
                             color: #666; 
                             font-size: 10px; 
                             display: inline-block; 
                             width: 12px; 
                             text-align: center;
                             transition: transform 0.2s ease;" 
                      title="${isExpanded ? 'Click to collapse' : 'Click to expand'}">${arrowSymbol}</span>`;
      },
      
      _renderGenericNode(node, depth = 0) {
        const indent = '&nbsp;&nbsp;'.repeat(depth);
        const nextIndent = '&nbsp;&nbsp;'.repeat(depth + 1);
        
        switch (node.type) {
          case 'object':
            if (!node.children || node.children.length === 0) {
              return `<span style="color: #666;">{}</span>`;
            }
            const objectEntries = node.children.map(child => 
              `${nextIndent}${this._renderGenericNode(child, depth + 1)}`
            ).join(',<br>');
            return `<div style="color: #333;">{<br>${objectEntries}<br>${indent}}</div>`;
            
          case 'array':
            if (!node.children || node.children.length === 0) {
              return `<span style="color: #666;">[]</span>`;
            }
            const arrayItems = node.children.map((child, i) => 
              `${nextIndent}[${i}] ${this._renderGenericNode(child, depth + 1)}`
            ).join('<br>');
            return `<div style="color: #333;">[<br>${arrayItems}<br>${indent}]</div>`;
            
          case 'property':
            const keyElement = node.keyEditable 
              ? `<span class="editable-key" data-path="${node.path}" data-type="key" 
                       style="color: #881391; font-weight: bold; cursor: pointer; 
                              padding: 1px 3px; border-radius: 2px; background: #f8f8f8;
                              border: 1px solid transparent;" 
                       title="Click to edit key">"${node.key}"</span>`
              : `<span style="color: #881391; font-weight: bold;">"${node.key}"</span>`;
            return `${keyElement}: ${this._renderGenericNode(node.value, depth)}`;
            
          case 'value':
            if (!node.editable) {
              return `<span style="color: ${this._getValueColor(node.dataType)}">${this._formatValue(node.value, node.dataType)}</span>`;
            }
            return `<span class="editable-value" 
                          data-path="${node.path}" 
                          data-type="${node.dataType}"
                          style="color: ${this._getValueColor(node.dataType)}; 
                                 cursor: pointer; 
                                 padding: 2px 4px; 
                                 border-radius: 3px;
                                 background: #f5f5f5;
                                 border: 1px solid transparent;
                                 transition: all 0.2s;" 
                          title="Click to edit">${this._formatValue(node.value, node.dataType)}</span>`;
            
          case 'element':
            const tagElement = node.tagEditable
              ? `<span class="editable-tag" data-path="${node.path}" data-type="tag"
                       style="color: #e91e63; font-weight: bold; cursor: pointer;"
                       title="Click to edit tag">${node.tag}</span>`
              : `<span style="color: #e91e63; font-weight: bold;">${node.tag}</span>`;
            
            let result = `<${tagElement}`;
            if (node.attributes && node.attributes.length > 0) {
              const attrs = node.attributes.map(attr => {
                const nameEl = attr.nameEditable 
                  ? `<span class="editable-attr-name" data-type="attr-name" style="cursor: pointer; color: #ff9800;" title="Click to edit">${attr.name}</span>`
                  : attr.name;
                const valueEl = attr.valueEditable
                  ? `<span class="editable-attr-value" data-type="attr-value" style="cursor: pointer; color: #4caf50;" title="Click to edit">"${attr.value}"</span>`
                  : `"${attr.value}"`;
                return `${nameEl}=${valueEl}`;
              }).join(' ');
              result += ` ${attrs}`;
            }
            result += '>';
            
            if (node.children && node.children.length > 0) {
              const childContent = node.children.map(child => 
                `${nextIndent}${this._renderGenericNode(child, depth + 1)}`
              ).join('<br>');
              result += `<br>${childContent}<br>${indent}&lt;/${node.tag}&gt;`;
            } else {
              result += `&lt;/${node.tag}&gt;`;
            }
            return result;
            
          case 'text':
            return node.editable
              ? `<span class="editable-value" data-path="${node.path}" data-type="string"
                       style="color: #0d7d21; cursor: pointer; padding: 2px 4px; 
                              border-radius: 3px; background: #f5f5f5;"
                       title="Click to edit">${node.value}</span>`
              : `<span style="color: #0d7d21;">${node.value}</span>`;
              
          case 'heading':
            const hashes = '#'.repeat(node.level);
            return `<span style="color: #2196f3; font-weight: bold;">${hashes}</span> 
                    <span class="editable-value" data-path="${node.path}" data-type="string"
                          style="color: #2196f3; cursor: pointer; font-weight: bold;"
                          title="Click to edit">${node.text}</span>`;
                          
          case 'listItem':
            return `<span style="color: #666;">-</span> 
                    <span class="editable-value" data-path="${node.path}" data-type="string"
                          style="color: #333; cursor: pointer;"
                          title="Click to edit">${node.text}</span>`;
                          
          case 'paragraph':
            return `<span class="editable-value" data-path="${node.path}" data-type="string"
                          style="color: #333; cursor: pointer;"
                          title="Click to edit">${node.text}</span>`;
                          
          case 'arrayItem':
            return `[${node.index}] ${this._renderGenericNode(node.value, depth)}`;
            
          case 'document':
            if (!node.children || node.children.length === 0) {
              return '<span style="color: #666;">Empty document</span>';
            }
            return node.children.map(child => 
              `${indent}${this._renderGenericNode(child, depth)}`
            ).join('<br>');
            
          default:
            return `<span style="color: #f44336;">Unknown node type: ${node.type}</span>`;
        }
      },
      
      _getValueColor(dataType) {
        switch (dataType) {
          case 'string': return '#0d7d21';
          case 'number': return '#1976d2';
          case 'boolean': return '#9c27b0';
          default: return '#333';
        }
      },
      
      _formatValue(value, dataType) {
        if (dataType === 'string') {
          return `"${value}"`;
        }
        return String(value);
      },
      
      _renderSource() {
        return `<textarea style="width: 100%; height: 300px; margin: 0; padding: 10px; background: white; border: 1px solid #ddd; font-family: 'Courier New', monospace; font-size: 12px; resize: vertical;" class="source-editor">${this._content}</textarea>`;
      },
      
      _setupEditHandlers() {
        if (!config.dom) return;
        
        // Prevent duplicate event listeners
        if (this._editListenerAttached) return;
        this._editListenerAttached = true;
        
        // Handle clicks on editable elements and expand/collapse controls in tree mode
        config.dom.addEventListener('click', (e) => {
          // Handle expand/collapse arrows - be specific to only handle arrows or summary text
          if (e.target.classList.contains('expand-arrow')) {
            e.preventDefault();
            e.stopPropagation();
            const path = e.target.dataset.expandPath;
            console.log('🌳 Expand/collapse clicked for path:', path, 'currentTarget:', e.currentTarget, 'target:', e.target);
            this._toggleExpansion(path);
            return;
          }
          
          // Handle clicking on summary text (collapsed state info)
          if (e.target.dataset.expandPath && e.target.textContent.includes('...')) {
            e.preventDefault();
            e.stopPropagation();
            const path = e.target.dataset.expandPath;
            console.log('📄 Summary text clicked for path:', path);
            this._toggleExpansion(path);
            return;
          }
          
          // Handle editable elements
          if (e.target.classList.contains('editable-value') || 
              e.target.classList.contains('editable-key') ||
              e.target.classList.contains('editable-tag') ||
              e.target.classList.contains('editable-attr-name') ||
              e.target.classList.contains('editable-attr-value')) {
            console.log('🎯 Click detected on editable element:', e.target.textContent, 'type:', e.target.dataset.type, 'path:', e.target.dataset.path);
            this._startEditing(e.target);
          }
        });
        
        // Handle source mode editing
        const sourceEditor = config.dom.querySelector('.source-editor');
        if (sourceEditor) {
          sourceEditor.addEventListener('input', (e) => {
            this._content = e.target.value;
            if (config.onContentChange) {
              config.onContentChange({ content: this._content });
            }
          });
        }
      },
      
      _startEditing(element) {
        console.log('✏️ Starting edit for:', element.textContent, 'type:', element.dataset.type);
        
        if (this._editingElement) {
          this._finishEditing(false); // Cancel previous edit
        }
        
        this._editingElement = element;
        const path = element.dataset.path;
        const type = element.dataset.type;
        const isKeyEdit = type === 'key';
        const currentValue = this._getValueAtPath(path, isKeyEdit);
        
        console.log('📍 Path:', path, 'Current value:', currentValue, 'Is key edit:', isKeyEdit, 'Raw content length:', this._content?.length);
        
        // Create input element
        const input = document.createElement('input');
        input.type = type === 'number' ? 'number' : 'text';
        
        // Set input value, handling different data types
        let inputValue = '';
        if (currentValue !== null && currentValue !== undefined) {
          if (type === 'string') {
            // Remove quotes from string values for editing
            inputValue = typeof currentValue === 'string' ? currentValue : String(currentValue).replace(/^"|"$/g, '');
          } else {
            inputValue = String(currentValue);
          }
        }
        
        input.value = inputValue;
        input.style.cssText = element.style.cssText + '; min-width: 100px; background: #fff3e0; border: 2px solid #ff9800;';
        
        console.log('📝 Input created with value:', inputValue);
        
        // Replace the span with input
        element.style.display = 'none';
        element.parentNode.insertBefore(input, element.nextSibling);
        
        // Focus and select with slight delay for better browser compatibility
        setTimeout(() => {
          input.focus();
          input.select();
        }, 10);
        
        // Handle saving/canceling
        const save = () => this._finishEditing(true);
        const cancel = () => this._finishEditing(false);
        
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') cancel();
        });
        
        input._editTarget = element;
      },
      
      _finishEditing(save) {
        if (!this._editingElement) return;
        
        const element = this._editingElement;
        const input = element.nextSibling;
        const path = element.dataset.path;
        const type = element.dataset.type;
        
        if (save && input) {
          let newValue = input.value;
          const isKeyEdit = type === 'key';
          const oldValue = this._getValueAtPath(path, isKeyEdit);
          
          // Convert to correct type (only for values, not keys)
          if (!isKeyEdit) {
            if (type === 'number') {
              newValue = parseFloat(newValue);
              if (isNaN(newValue)) newValue = 0;
            } else if (type === 'boolean') {
              newValue = newValue.toLowerCase() === 'true';
            }
          }
          
          console.log('💾 Saving edit:', { path, oldValue, newValue, type, isKeyEdit });
          
          // Update the data
          this._setValueAtPath(path, newValue, isKeyEdit);
          
          // For JSON format, update the content string
          if (this._format === 'json' && this._data) {
            this._content = JSON.stringify(this._data, null, 2);
          }
          
          // Trigger events
          if (config.onNodeEdit) {
            config.onNodeEdit({ path, newValue, oldValue });
          }
          if (config.onContentChange) {
            config.onContentChange({ content: this._content });
          }
          
          // Re-render to show changes
          this.render();
        } else {
          // Just restore the original element
          if (input) input.remove();
          element.style.display = '';
        }
        
        this._editingElement = null;
      },
      
      _getValueAtPath(path, isKey = false) {
        if (!path) return null;
        
        // Always ensure we have parsed data for JSON
        if (this._format === 'json' && this._content && !this._data) {
          try {
            this._data = JSON.parse(this._content);
          } catch (e) {
            console.warn('Could not parse JSON for value retrieval:', e);
            return null;
          }
        }
        
        // If editing a key, extract the key name from the path
        if (isKey) {
          const parts = path.split(/[.\[\]]/).filter(p => p);
          const keyName = parts[parts.length - 1];
          return keyName;
        }
        
        // For JSON, use direct data access for values
        if (this._format === 'json' && this._data) {
          const parts = path.split(/[.\[\]]/).filter(p => p);
          let current = this._data;
          
          for (const part of parts) {
            if (current == null) return null;
            current = current[part];
          }
          
          return current;
        }
        
        // For generic document, we need to traverse the document structure
        if (this._document) {
          return this._getValueFromDocument(this._document, path);
        }
        
        return null;
      },
      
      _getValueFromDocument(doc, path) {
        // Simple implementation - for now just return the path for key editing
        if (!doc || !path) return null;
        
        // If editing a key, return the key name
        if (path.endsWith && (typeof path === 'string')) {
          const lastDot = path.lastIndexOf('.');
          const lastBracket = path.lastIndexOf('[');
          const lastIndex = Math.max(lastDot, lastBracket);
          
          if (lastIndex > -1) {
            return path.substring(lastIndex + 1).replace(/[\[\]]/g, '');
          }
          return path;
        }
        
        return null;
      },
      
      _setValueAtPath(path, value, isKeyEdit = false) {
        if (!path) return;
        
        // Always ensure we have parsed data for JSON
        if (this._format === 'json' && this._content && !this._data) {
          try {
            this._data = JSON.parse(this._content);
          } catch (e) {
            console.warn('Could not parse JSON for value setting:', e);
            return;
          }
        }
        
        if (!this._data) return;
        
        if (isKeyEdit) {
          // Handle key renaming - much more complex!
          this._renameKey(path, value);
        } else {
          // Handle value setting - simple case
          const parts = path.split(/[.\[\]]/).filter(p => p);
          let current = this._data;
          
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] == null) {
              current[part] = isNaN(parts[i + 1]) ? {} : [];
            }
            current = current[part];
          }
          
          const lastPart = parts[parts.length - 1];
          current[lastPart] = value;
        }
      },
      
      _renameKey(path, newKeyName) {
        console.log('🔄 Renaming key at path:', path, 'to:', newKeyName);
        
        const parts = path.split(/[.\[\]]/).filter(p => p);
        if (parts.length === 0) return;
        
        const oldKeyName = parts[parts.length - 1];
        if (oldKeyName === newKeyName) return; // No change needed
        
        // Navigate to the parent object
        let current = this._data;
        const parentPath = parts.slice(0, -1);
        
        for (const part of parentPath) {
          if (current == null || typeof current !== 'object') {
            console.warn('Cannot rename key: invalid parent path');
            return;
          }
          current = current[part];
        }
        
        if (!current || typeof current !== 'object') {
          console.warn('Cannot rename key: parent is not an object');
          return;
        }
        
        if (!(oldKeyName in current)) {
          console.warn('Cannot rename key: old key does not exist');
          return;
        }
        
        if (newKeyName in current && newKeyName !== oldKeyName) {
          console.warn('Cannot rename key: new key already exists');
          return;
        }
        
        // Store the value that needs to be moved
        const valueToMove = current[oldKeyName];
        
        // Create a new object with keys in the correct order
        const newObject = {};
        
        // Copy all entries, replacing the old key with the new key
        for (const [key, value] of Object.entries(current)) {
          if (key === oldKeyName) {
            newObject[newKeyName] = valueToMove;
          } else {
            newObject[key] = value;
          }
        }
        
        // Replace the parent object with the new object
        if (parentPath.length === 0) {
          // Renaming a top-level key
          this._data = newObject;
        } else {
          // Navigate to grandparent and replace the parent
          let grandparent = this._data;
          const grandparentPath = parentPath.slice(0, -1);
          
          for (const part of grandparentPath) {
            grandparent = grandparent[part];
          }
          
          const parentKey = parentPath[parentPath.length - 1];
          grandparent[parentKey] = newObject;
        }
        
        console.log('✅ Key renamed successfully from', oldKeyName, 'to', newKeyName);
      },
      
      _toggleExpansion(path) {
        if (this._expandedNodes.has(path)) {
          this._expandedNodes.delete(path);
          console.log('📉 Collapsed node:', path);
        } else {
          this._expandedNodes.add(path);
          console.log('📈 Expanded node:', path);
        }
        
        // Re-render to show the expansion change
        this.render();
        
        // Trigger expand/collapse events
        if (config.onExpand && this._expandedNodes.has(path)) {
          config.onExpand({ path });
        }
        if (config.onCollapse && !this._expandedNodes.has(path)) {
          config.onCollapse({ path });
        }
      },
      
      _collectAllPaths(node, currentPath) {
        const paths = [];
        
        if (Array.isArray(node)) {
          if (currentPath) paths.push(currentPath);
          node.forEach((item, i) => {
            const itemPath = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
            paths.push(...this._collectAllPaths(item, itemPath));
          });
        } else if (typeof node === 'object' && node !== null) {
          if (currentPath) paths.push(currentPath);
          Object.entries(node).forEach(([key, value]) => {
            const keyPath = currentPath ? `${currentPath}.${key}` : key;
            paths.push(...this._collectAllPaths(value, keyPath));
          });
        }
        
        return paths;
      },
      
      _initializeDefaultExpansion(node, currentPath, levelsToExpand) {
        if (levelsToExpand <= 0) return;
        
        console.log('🌱 Initializing expansion for path:', currentPath, 'levels remaining:', levelsToExpand);
        
        if (Array.isArray(node)) {
          if (currentPath) {
            this._expandedNodes.add(currentPath);
            console.log('📂 Added array to expanded nodes:', currentPath);
          }
          node.forEach((item, i) => {
            const itemPath = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
            this._initializeDefaultExpansion(item, itemPath, levelsToExpand - 1);
          });
        } else if (typeof node === 'object' && node !== null) {
          if (currentPath) {
            this._expandedNodes.add(currentPath);
            console.log('📂 Added object to expanded nodes:', currentPath);
          }
          Object.entries(node).forEach(([key, value]) => {
            const keyPath = currentPath ? `${currentPath}.${key}` : key;
            this._initializeDefaultExpansion(value, keyPath, levelsToExpand - 1);
          });
        }
      },
      
      // API methods
      destroy() {
        this._finishEditing(false);
        if (config.dom) config.dom.innerHTML = '';
        if (config.onDestroy) config.onDestroy(this);
      },
      
      setMode(mode) {
        this._finishEditing(false);
        this._mode = mode;
        this.render();
      },
      
      loadContent(content, format) {
        this._finishEditing(false);
        this._content = content;
        if (format) {
          this._format = format;
        }
        // Clear expansion state when new content is loaded
        this._expandedNodes.clear();
        this.render();
        if (config.onContentChange) config.onContentChange({ content, format });
      },
      
      setContent(content) {
        this._finishEditing(false);
        this._content = content;
        this.render();
      },
      
      getContent() { 
        return this._content; 
      },
      
      addNode(path, value) {
        // Simple implementation for demo
        try {
          const data = JSON.parse(this._content);
          if (path === 'items' && Array.isArray(data.items)) {
            data.items.push(value);
          } else if (typeof data === 'object') {
            data[path] = value;
          }
          this._content = JSON.stringify(data, null, 2);
          this._data = data;
          this.render();
          if (config.onNodeAdd) config.onNodeAdd({ parentPath: path, value });
        } catch (e) {
          console.warn('Could not add node:', e);
        }
      },
      
      editNode(path, value) {
        this._setValueAtPath(path, value);
        this._content = JSON.stringify(this._data, null, 2);
        this.render();
        if (config.onNodeEdit) config.onNodeEdit({ path, newValue: value });
      },
      
      expandAll() { 
        // Find all possible paths in the current data
        this._collectAllPaths(this._data, '').forEach(path => {
          if (path) this._expandedNodes.add(path);
        });
        this.render();
        console.log('📈 Expanded all nodes');
      },
      collapseAll() { 
        this._expandedNodes.clear();
        this.render();
        console.log('📉 Collapsed all nodes');
      },
      bulkOperation(fn) { fn(); },
      getTreeData() { return this._data || {}; },
      setTheme(theme) { /* Not implemented for demo */ },
      setEditable(editable) { /* Not implemented for demo */ },
      validate() { 
        try {
          JSON.parse(this._content);
          return { valid: true };
        } catch (e) {
          return { valid: false, error: e.message };
        }
      }
    };
    
    if (config.onMount) {
      config.onMount(editor);
    }
    
    return editor;
  }
};

export class HierarchyEditorDemoViewModel extends BaseViewModel {
  constructor(model, view, config = {}) {
    super(model, view, config);
    
    this.setupEventHandlers();
    // Don't initialize editors here - wait for render
  }
  
  render() {
    super.render();
    // Initialize editors after view has rendered
    setTimeout(() => {
      this.initializeEditors();
    }, 10);
  }
  
  setupEventHandlers() {
    // Handle button clicks
    this.view.container.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      
      const action = button.dataset.action;
      const editorName = button.dataset.editor;
      const sample = button.dataset.sample;
      
      this.handleAction(action, editorName, sample);
    });
    
    // Handle dropdown changes
    this.view.container.addEventListener('change', (e) => {
      if (e.target.dataset.action === 'load-server-file') {
        const filePath = e.target.value;
        const editorName = e.target.dataset.editor;
        if (filePath) {
          this.loadServerFile(filePath, editorName);
          // Reset dropdown to placeholder
          e.target.value = '';
        }
      }
    });
    
    // Handle format card clicks
    this.view.container.addEventListener('click', (e) => {
      const card = e.target.closest('.sample-data-card');
      if (!card) return;
      
      const format = card.dataset.format;
      this.loadSampleData(format);
    });
    
    // Handle file uploads
    this.view.container.addEventListener('change', (e) => {
      if (e.target.type === 'file') {
        const file = e.target.files[0];
        if (file) {
          const editorName = e.target.id.replace('-file-input', '');
          this.loadFile(file, editorName);
        }
      }
    });
    
    // Model event listeners
    this.model.on('themeChanged', (event) => {
      this.view.updateTheme(event.newTheme);
      this.updateAllEditorsTheme(event.newTheme);
    });
    
    this.model.on('readOnlyChanged', (event) => {
      this.updateAllEditorsReadOnly(event.readOnly);
      this.view.updateAdvancedInfo(this.model.getTheme(), !event.readOnly);
    });
    
    this.model.on('eventLogged', (event) => {
      this.view.addEventToLog(event);
    });
    
    this.model.on('nodeCountUpdated', (event) => {
      if (event.editorName === 'edit') {
        this.view.updateNodeCount(event.count);
      }
    });
  }
  
  initializeEditors() {
    // Initialize basic demo
    this.initBasicDemo();
    
    // Initialize format demo
    this.initFormatDemo();
    
    // Initialize edit demo
    this.initEditDemo();
    
    // Initialize event demo
    this.initEventDemo();
    
    // Initialize advanced demo
    this.initAdvancedDemo();
  }
  
  initBasicDemo() {
    const container = this.view.getEditorContainer('basic');
    if (!container) {
      console.warn('No container found for basic editor');
      return;
    }
    
    const basicDemo = HierarchyEditor.create({
      dom: container,
      content: this.model.getSampleData('json'),
      format: 'json',
      showToolbar: false,
      defaultMode: 'tree',
      onModeChange: (e) => {
        this.view.updateMode('basic', e.toMode || 'tree');
      },
      onChange: () => {
        this.view.updateStatus('basic', 'Modified');
      },
      onMount: (event) => {
        const instance = event.instance || event;
        this.model.registerEditor('basic', instance);
        this.view.updateStatus('basic', 'Ready - Sample JSON loaded');
      },
      onDestroy: () => {
        this.model.unregisterEditor('basic');
      }
    });
    
    basicDemo.render();
  }
  
  initFormatDemo() {
    const container = this.view.getEditorContainer('format');
    if (!container) return;
    
    const formatDemo = HierarchyEditor.create({
      dom: container,
      content: this.model.getSampleData('json'),
      format: 'json',
      showToolbar: true,
      onFormatChange: (e) => {
        this.view.updateFormatInfo(e.toFormat);
      },
      onContentChange: () => {
        this.view.updateStatus('format', 'Content loaded');
      },
      onMount: (event) => {
        console.log('Format editor onMount called with:', event);
        const instance = event.instance || event;
        this.model.registerEditor('format', instance);
      },
      onDestroy: () => {
        this.model.unregisterEditor('format');
      }
    });
    
    formatDemo.render();
  }
  
  initEditDemo() {
    const container = this.view.getEditorContainer('edit');
    if (!container) return;
    
    const sampleEditData = {
      "project": {
        "name": "My Project",
        "version": "1.0.0",
        "description": "Edit this data structure"
      },
      "items": [
        { "id": 1, "name": "Item 1", "status": "active" },
        { "id": 2, "name": "Item 2", "status": "pending" }
      ],
      "settings": {
        "theme": "light",
        "autoSave": true,
        "notifications": {
          "email": true,
          "push": false
        }
      }
    };
    
    const editDemo = HierarchyEditor.create({
      dom: container,
      content: JSON.stringify(sampleEditData, null, 2),
      format: 'json',
      showToolbar: false,
      editable: true,
      onChange: () => {
        this.updateEditNodeCount();
      },
      onNodeEdit: (e) => {
        this.view.updateStatus('edit', `Edited ${e.path}: ${e.oldValue} → ${e.newValue}`);
      },
      onNodeAdd: (e) => {
        this.view.updateStatus('edit', `Added node to ${e.parentPath}`);
      },
      onNodeRemove: (e) => {
        this.view.updateStatus('edit', `Removed ${e.path}`);
      },
      onMount: (event) => {
        const instance = event.instance || event;
        this.model.registerEditor('edit', instance);
        this.updateEditNodeCount();
        this.view.updateStatus('edit', 'Sample data loaded - Double-click to edit values');
      },
      onDestroy: () => {
        this.model.unregisterEditor('edit');
      }
    });
    
    editDemo.render();
  }
  
  initEventDemo() {
    const container = this.view.getEditorContainer('event');
    if (!container) return;
    
    const logEvent = (type, data) => {
      this.model.logEvent(type, data);
    };
    
    const eventDemo = HierarchyEditor.create({
      dom: container,
      content: '{"name": "John", "age": 30, "skills": ["JavaScript", "Python"]}',
      format: 'json',
      showToolbar: true,
      onMount: (event) => {
        const instance = event.instance || event;
        this.model.registerEditor('event', instance);
        logEvent('mount', { format: 'json', mode: 'tree' });
      },
      onReady: (e) => logEvent('ready', { nodeCount: e.nodeCount }),
      onModeChange: (e) => logEvent('modeChange', { from: e.fromMode, to: e.toMode }),
      onSelect: (e) => logEvent('select', { path: e.path, value: e.value }),
      onExpand: (e) => logEvent('expand', { path: e.path }),
      onCollapse: (e) => logEvent('collapse', { path: e.path }),
      onChange: (e) => logEvent('change', { type: e.type }),
      onNodeEdit: (e) => logEvent('nodeEdit', { path: e.path, newValue: e.newValue }),
      onNodeAdd: (e) => logEvent('nodeAdd', { parent: e.parentPath, value: e.value }),
      onNodeRemove: (e) => logEvent('nodeRemove', { path: e.path }),
      onError: (e) => logEvent('error', { type: e.type, message: e.message }),
      onDestroy: () => {
        this.model.unregisterEditor('event');
      }
    });
    
    eventDemo.render();
  }
  
  initAdvancedDemo() {
    const container = this.view.getEditorContainer('advanced');
    if (!container) return;
    
    const advancedDemo = HierarchyEditor.create({
      dom: container,
      content: this.model.getSampleData('json'),
      format: 'json',
      theme: 'light',
      editable: true,
      showToolbar: true,
      validators: {
        'stats.coverage': (value) => {
          if (typeof value !== 'number' || value < 0 || value > 100) {
            return { valid: false, error: 'Coverage must be 0-100' };
          }
          return { valid: true };
        }
      },
      onValidationError: (e) => {
        this.view.updateStatus('advanced', `Validation error: ${e.error}`);
      },
      onMount: (event) => {
        const instance = event.instance || event;
        this.model.registerEditor('advanced', instance);
      },
      onDestroy: () => {
        this.model.unregisterEditor('advanced');
      }
    });
    
    advancedDemo.render();
  }
  
  loadFile(file, editorName) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const editor = this.model.getEditor(editorName);
      if (editor) {
        editor.loadContent(content);
        this.view.updateStatus(editorName, `Loaded: ${file.name}`);
      }
    };
    reader.readAsText(file);
  }
  
  async loadServerFile(filePath, editorName) {
    try {
      this.view.updateStatus(editorName, 'Loading file...');
      
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status}`);
      }
      
      const content = await response.text();
      const editor = this.model.getEditor(editorName);
      
      if (editor) {
        // Detect format from file extension
        const format = this.detectFormatFromPath(filePath);
        editor.loadContent(content, format);
        
        const fileName = filePath.split('/').pop();
        this.view.updateStatus(editorName, `Loaded: ${fileName}`);
      }
    } catch (error) {
      console.error('Error loading file:', error);
      this.view.updateStatus(editorName, `Error: ${error.message}`);
    }
  }
  
  detectFormatFromPath(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const formatMap = {
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'markdown': 'markdown'
    };
    return formatMap[extension] || 'json';
  }
  
  handleAction(action, editorName, sample) {
    switch (action) {
      // Load sample data
      case 'load-sample':
        this.loadSampleForEditor(editorName, sample);
        break;
      // Basic demo actions
      case 'tree-mode':
        this.setEditorMode(editorName, 'tree');
        break;
      case 'source-mode':
        this.setEditorMode(editorName, 'source');
        break;
      case 'expand-all':
        this.expandAll(editorName);
        break;
      case 'collapse-all':
        this.collapseAll(editorName);
        break;
        
      // Edit demo actions
      case 'add-node':
        this.addNewNode();
        break;
      case 'delete-selected':
        this.deleteSelectedNode();
        break;
      case 'bulk-add':
        this.bulkAddNodes();
        break;
      case 'clear':
        this.clearEditDemo();
        break;
        
      // Event demo actions
      case 'clear-log':
        this.clearEventLog();
        break;
      case 'programmatic-edit':
        this.programmaticEdit(editorName);
        break;
      case 'programmatic-add':
        this.programmaticAdd(editorName);
        break;
        
      // Advanced demo actions
      case 'toggle-theme':
        this.toggleTheme();
        break;
      case 'toggle-readonly':
        this.toggleReadOnly();
        break;
      case 'export-data':
        this.exportData(editorName);
        break;
      case 'validate':
        this.validateContent(editorName);
        break;
      case 'large-dataset':
        this.loadLargeDataset(editorName);
        break;
      case 'download':
        this.downloadContent(editorName);
        break;
    }
  }
  
  loadSampleForEditor(editorName, sampleType) {
    const editor = this.model.getEditor(editorName);
    if (!editor) return;
    
    let sampleData;
    switch (sampleType) {
      case 'package':
        sampleData = this.model.getSampleData('json');
        break;
      default:
        sampleData = this.model.getSampleData('json');
    }
    
    editor.loadContent(sampleData, 'json');
    this.view.updateStatus(editorName, 'Sample data loaded');
  }
  
  // Action implementations
  
  setEditorMode(editorName, mode) {
    const editor = this.model.getEditor(editorName);
    if (editor && editor.setMode) {
      editor.setMode(mode);
    }
  }
  
  expandAll(editorName) {
    const editor = this.model.getEditor(editorName);
    if (editor && editor.expandAll) {
      editor.expandAll();
    }
  }
  
  collapseAll(editorName) {
    const editor = this.model.getEditor(editorName);
    if (editor && editor.collapseAll) {
      editor.collapseAll();
    }
  }
  
  loadSampleData(format) {
    const editor = this.model.getEditor('format');
    if (!editor) {
      console.error('No format editor found');
      return;
    }
    
    console.log('Loading sample data for format:', format);
    console.log('Editor instance:', editor);
    console.log('Editor methods:', Object.keys(editor));
    
    const sampleData = this.model.getSampleData(format);
    if (editor.loadContent) {
      editor.loadContent(sampleData, format);
    } else if (editor.setContent) {
      editor.setContent(sampleData);
    } else {
      console.error('Editor has no loadContent or setContent method');
    }
    this.view.highlightFormatCard(format);
  }
  
  addNewNode() {
    const editor = this.model.getEditor('edit');
    if (!editor || !editor.addNode) return;
    
    const timestamp = new Date().toISOString();
    editor.addNode('items', { id: Date.now(), created: timestamp });
  }
  
  deleteSelectedNode() {
    // In a real implementation, we'd track selection
    this.view.updateStatus('edit', 'Select a node first (click on it)');
  }
  
  bulkAddNodes() {
    const editor = this.model.getEditor('edit');
    if (!editor || !editor.bulkOperation) return;
    
    editor.bulkOperation(() => {
      for (let i = 0; i < 5; i++) {
        editor.addNode('items', `Item ${i + 1}`);
      }
    });
  }
  
  clearEditDemo() {
    const editor = this.model.getEditor('edit');
    if (editor && editor.setContent) {
      editor.setContent('{"items": []}');
    }
  }
  
  clearEventLog() {
    this.model.clearEventLog();
    this.view.clearEventLog();
  }
  
  programmaticEdit(editorName) {
    const editor = this.model.getEditor(editorName);
    if (editor && editor.editNode) {
      editor.editNode('name', 'Jane Doe');
    }
  }
  
  programmaticAdd(editorName) {
    const editor = this.model.getEditor(editorName);
    if (editor && editor.addNode) {
      editor.addNode('skills', 'TypeScript');
    }
  }
  
  toggleTheme() {
    this.model.toggleTheme();
  }
  
  toggleReadOnly() {
    this.model.toggleReadOnly();
  }
  
  exportData(editorName) {
    const editor = this.model.getEditor(editorName);
    if (!editor || !editor.getContent) return;
    
    const content = editor.getContent();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hierarchy-data.json';
    a.click();
    URL.revokeObjectURL(url);
    
    this.view.updateStatus(editorName, 'Data exported');
  }
  
  downloadContent(editorName) {
    const editor = this.model.getEditor(editorName);
    if (!editor || !editor.getContent) return;
    
    const content = editor.getContent();
    const format = editor._detectFormat ? editor._detectFormat(content) : 'json';
    const extension = format === 'yaml' ? 'yml' : format;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited-content.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.view.updateStatus(editorName, 'Content downloaded');
  }
  
  validateContent(editorName) {
    const editor = this.model.getEditor(editorName);
    if (!editor || !editor.validate) return;
    
    const content = editor.getContent();
    const result = editor.validate(content);
    this.view.updateStatus(
      editorName, 
      result.valid ? 'Content is valid' : `Invalid: ${result.error}`
    );
  }
  
  loadLargeDataset(editorName) {
    const editor = this.model.getEditor(editorName);
    if (!editor || !editor.loadContent) return;
    
    const largeData = this.model.generateLargeDataset(1000);
    editor.loadContent(largeData);
    this.view.updateStatus(editorName, 'Loaded 1000 items');
  }
  
  updateEditNodeCount() {
    const editor = this.model.getEditor('edit');
    if (!editor || !editor.getTreeData) return;
    
    const treeData = editor.getTreeData();
    const count = treeData ? this.countNodes(treeData) : 0;
    this.model.updateNodeCount('edit', count);
  }
  
  countNodes(node) {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }
  
  updateAllEditorsTheme(theme) {
    const editors = this.model.getAllEditors();
    for (const [name, editor] of editors) {
      if (editor && editor.setTheme) {
        editor.setTheme(theme);
      }
    }
  }
  
  updateAllEditorsReadOnly(readOnly) {
    const editors = this.model.getAllEditors();
    for (const [name, editor] of editors) {
      if (editor && editor.setEditable) {
        editor.setEditable(!readOnly);
      }
    }
  }
  
  // Public API methods
  
  getEditorInstance(name) {
    return this.model.getEditor(name);
  }
  
  getAllEditorInstances() {
    return this.model.getAllEditors();
  }
  
  getEventLog() {
    return this.model.getEventLog();
  }
  
  // Cleanup
  
  destroy() {
    // Destroy all editors
    const editors = this.model.getAllEditors();
    for (const [name, editor] of editors) {
      if (editor && editor.destroy) {
        editor.destroy();
      }
    }
    
    super.destroy();
  }
}