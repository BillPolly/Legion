import { UmbilicalUtils, UmbilicalError } from '@legion/components';

/**
 * ImageViewer Component
 * 
 * Displays and manipulates images with pan, zoom, and controls.
 * Supports both URLs and base64 data URLs.
 */
export const ImageViewer = {
  /**
   * Create an ImageViewer instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element to contain the viewer');
      requirements.add('imageData', 'string', 'Image source URL or data URL (optional)');
      requirements.add('initialZoom', 'number', 'Initial zoom level (optional, defaults to 1.0)');
      requirements.add('minZoom', 'number', 'Minimum zoom level (optional, defaults to 0.1)');
      requirements.add('maxZoom', 'number', 'Maximum zoom level (optional, defaults to 5.0)');
      requirements.add('zoomStep', 'number', 'Zoom increment per step (optional, defaults to 0.1)');
      requirements.add('showControls', 'boolean', 'Show zoom/save controls (optional, defaults to false)');
      requirements.add('showInfo', 'boolean', 'Show image info overlay (optional, defaults to true)');
      requirements.add('infoFadeDelay', 'number', 'Milliseconds before info fades (optional, defaults to 3000)');
      requirements.add('onImageLoaded', 'function', 'Callback when image loads successfully (optional)');
      requirements.add('onZoomChanged', 'function', 'Callback when zoom level changes (optional)');
      requirements.add('onError', 'function', 'Callback when image fails to load (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidImageData: !umbilical.imageData || 
          (typeof umbilical.imageData === 'string' && 
           (umbilical.imageData.startsWith('data:') || umbilical.imageData.startsWith('http'))),
        hasValidZoomRange: (!umbilical.minZoom || !umbilical.maxZoom) || 
          (umbilical.minZoom < umbilical.maxZoom)
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ImageViewer');

    // Node.ELEMENT_NODE = 1 (avoid Node global for JSDOM compatibility)
    if (umbilical.dom.nodeType !== 1) {
      throw new UmbilicalError('ImageViewer requires a valid DOM element', 'ImageViewer');
    }

    // Initialize options with defaults
    const options = {
      initialZoom: umbilical.initialZoom || 1.0,
      minZoom: umbilical.minZoom || 0.1,
      maxZoom: umbilical.maxZoom || 5.0,
      zoomStep: umbilical.zoomStep || 0.1,
      showControls: umbilical.showControls !== undefined ? umbilical.showControls : false,
      showInfo: umbilical.showInfo !== undefined ? umbilical.showInfo : true,
      infoFadeDelay: umbilical.infoFadeDelay || 3000
    };

    // State
    let image = null;
    let imageInfo = null;
    let zoomLevel = options.initialZoom;
    let panOffset = { x: 0, y: 0 };
    let isPanning = false;
    let lastMousePos = { x: 0, y: 0 };
    let infoFadeTimer = null;

    // Create main container
    const element = document.createElement('div');
    element.className = 'umbilical-image-viewer';
    element.style.position = 'relative';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.overflow = 'hidden';
    element.style.backgroundColor = '#f0f0f0';
    element.style.userSelect = 'none';

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'umbilical-image-container';
    imageContainer.style.position = 'absolute';
    imageContainer.style.top = '0';
    imageContainer.style.left = '0';
    imageContainer.style.width = '100%';
    imageContainer.style.height = '100%';
    imageContainer.style.display = 'flex';
    imageContainer.style.alignItems = 'center';
    imageContainer.style.justifyContent = 'center';
    imageContainer.style.overflow = 'hidden';

    // Image element
    const imageElement = document.createElement('img');
    imageElement.className = 'umbilical-image-element';
    imageElement.style.maxWidth = '100%';
    imageElement.style.maxHeight = '100%';
    imageElement.style.transformOrigin = 'center center';
    imageElement.style.transition = 'transform 0.1s ease-out';
    imageElement.style.display = 'none';

    // Loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'umbilical-loading-indicator';
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.color = '#666';
    loadingIndicator.style.fontSize = '16px';
    loadingIndicator.textContent = 'Loading...';
    loadingIndicator.style.display = 'none';

    // Error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'umbilical-error-message';
    errorMessage.style.position = 'absolute';
    errorMessage.style.top = '50%';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translate(-50%, -50%)';
    errorMessage.style.color = '#d32f2f';
    errorMessage.style.fontSize = '16px';
    errorMessage.style.textAlign = 'center';
    errorMessage.style.display = 'none';

    // Controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'umbilical-image-controls';
    controlsContainer.style.position = 'absolute';
    controlsContainer.style.bottom = '10px';
    controlsContainer.style.left = '50%';
    controlsContainer.style.transform = 'translateX(-50%)';
    controlsContainer.style.display = options.showControls ? 'flex' : 'none';
    controlsContainer.style.gap = '10px';
    controlsContainer.style.padding = '5px 10px';
    controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    controlsContainer.style.borderRadius = '4px';
    controlsContainer.style.zIndex = '10';

    // Helper to create buttons
    const createButton = (text, onClick) => {
      const button = document.createElement('button');
      button.textContent = text;
      button.style.backgroundColor = 'transparent';
      button.style.color = 'white';
      button.style.border = '1px solid rgba(255, 255, 255, 0.5)';
      button.style.borderRadius = '3px';
      button.style.padding = '3px 8px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';
      
      button.addEventListener('click', onClick);
      
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      });
      
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = 'transparent';
      });
      
      return button;
    };

    // Control buttons
    const zoomOutBtn = createButton('-', () => instance.zoom(-options.zoomStep));
    
    const zoomLevelDisplay = document.createElement('span');
    zoomLevelDisplay.style.color = 'white';
    zoomLevelDisplay.style.minWidth = '60px';
    zoomLevelDisplay.style.textAlign = 'center';
    
    const zoomInBtn = createButton('+', () => instance.zoom(options.zoomStep));
    const resetBtn = createButton('Reset', () => instance.resetView());
    const saveBtn = createButton('Save', () => instance.saveImage());
    
    const closeBtn = createButton('×', () => instance.hideControls());
    closeBtn.style.marginLeft = 'auto';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.padding = '0 6px';

    // Add controls to container
    controlsContainer.appendChild(zoomOutBtn);
    controlsContainer.appendChild(zoomLevelDisplay);
    controlsContainer.appendChild(zoomInBtn);
    controlsContainer.appendChild(resetBtn);
    controlsContainer.appendChild(saveBtn);
    controlsContainer.appendChild(closeBtn);

    // Controls toggle button
    const controlsToggleBtn = document.createElement('button');
    controlsToggleBtn.className = 'umbilical-controls-toggle';
    controlsToggleBtn.style.position = 'absolute';
    controlsToggleBtn.style.bottom = '10px';
    controlsToggleBtn.style.right = '10px';
    controlsToggleBtn.style.width = '30px';
    controlsToggleBtn.style.height = '30px';
    controlsToggleBtn.style.borderRadius = '50%';
    controlsToggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    controlsToggleBtn.style.color = 'white';
    controlsToggleBtn.style.border = 'none';
    controlsToggleBtn.style.cursor = 'pointer';
    controlsToggleBtn.style.fontSize = '16px';
    controlsToggleBtn.style.display = 'flex';
    controlsToggleBtn.style.alignItems = 'center';
    controlsToggleBtn.style.justifyContent = 'center';
    controlsToggleBtn.style.zIndex = '10';
    controlsToggleBtn.innerHTML = '⚙️';
    controlsToggleBtn.title = options.showControls ? 'Hide controls' : 'Show controls';

    // Info container
    let infoContainer = null;
    if (options.showInfo) {
      infoContainer = document.createElement('div');
      infoContainer.className = 'umbilical-image-info';
      infoContainer.style.position = 'absolute';
      infoContainer.style.top = '10px';
      infoContainer.style.left = '10px';
      infoContainer.style.padding = '5px 10px';
      infoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      infoContainer.style.color = 'white';
      infoContainer.style.borderRadius = '4px';
      infoContainer.style.fontSize = '12px';
      infoContainer.style.zIndex = '10';
      infoContainer.style.display = 'none';
      infoContainer.style.transition = 'opacity 1s ease-out';
    }

    // Helper functions
    const updateImageTransform = () => {
      if (imageElement) {
        imageElement.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`;
      }
    };

    const updateZoomDisplay = () => {
      zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    };

    const getImageTypeFromSource = (source) => {
      if (source.startsWith('data:image/')) {
        const match = source.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
        return match ? match[1].toUpperCase() : 'Unknown';
      } else if (source.match(/\.(jpg|jpeg)$/i)) {
        return 'JPEG';
      } else if (source.match(/\.png$/i)) {
        return 'PNG';
      } else if (source.match(/\.gif$/i)) {
        return 'GIF';
      } else if (source.match(/\.svg$/i)) {
        return 'SVG';
      } else if (source.match(/\.webp$/i)) {
        return 'WEBP';
      } else {
        return 'Unknown';
      }
    };

    const updateInfoDisplay = () => {
      if (infoContainer && imageInfo) {
        infoContainer.innerHTML = `
          <div>${imageInfo.width} × ${imageInfo.height} px</div>
          <div>Type: ${imageInfo.type}</div>
        `;
        
        // Clear any existing timer
        if (infoFadeTimer) {
          clearTimeout(infoFadeTimer);
        }
        
        // Reset opacity
        infoContainer.style.opacity = '1';
        
        // Set up fade timer
        infoFadeTimer = setTimeout(() => {
          infoContainer.style.opacity = '0';
        }, options.infoFadeDelay);
      }
    };

    // Set up event listeners
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -options.zoomStep : options.zoomStep;
      instance.zoom(delta);
    });

    element.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        e.preventDefault();
        isPanning = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        element.style.cursor = 'grabbing';
      }
    });

    element.addEventListener('mousemove', (e) => {
      if (isPanning) {
        e.preventDefault();
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        
        panOffset.x += dx;
        panOffset.y += dy;
        
        lastMousePos = { x: e.clientX, y: e.clientY };
        updateImageTransform();
      }
    });

    const stopPanning = (e) => {
      e.preventDefault();
      isPanning = false;
      element.style.cursor = 'default';
    };

    element.addEventListener('mouseup', stopPanning);
    element.addEventListener('mouseleave', stopPanning);

    element.addEventListener('dblclick', () => {
      instance.resetView();
    });

    controlsToggleBtn.addEventListener('click', () => {
      instance.toggleControls();
    });

    if (infoContainer) {
      infoContainer.addEventListener('mouseenter', () => {
        if (infoFadeTimer) {
          clearTimeout(infoFadeTimer);
        }
        infoContainer.style.opacity = '1';
      });
      
      infoContainer.addEventListener('mouseleave', () => {
        infoFadeTimer = setTimeout(() => {
          infoContainer.style.opacity = '0';
        }, 1000);
      });
    }

    // Assemble the component
    imageContainer.appendChild(imageElement);
    element.appendChild(imageContainer);
    element.appendChild(controlsContainer);
    element.appendChild(controlsToggleBtn);
    if (infoContainer) {
      element.appendChild(infoContainer);
    }
    element.appendChild(loadingIndicator);
    element.appendChild(errorMessage);

    // Initial updates
    updateZoomDisplay();

    // Create instance interface
    const instance = {
      // DOM access
      get element() {
        return element;
      },

      get imageElement() {
        return imageElement;
      },

      // State access
      get zoomLevel() {
        return zoomLevel;
      },

      get imageInfo() {
        return imageInfo;
      },

      get isLoaded() {
        return image !== null;
      },

      // Image loading
      loadImage(source) {
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        imageElement.style.display = 'none';
        if (infoContainer) {
          infoContainer.style.display = 'none';
        }
        
        // Reset view
        instance.resetView(false);
        
        const img = new Image();
        
        img.onload = () => {
          loadingIndicator.style.display = 'none';
          
          image = img;
          imageElement.src = source;
          imageElement.style.display = 'block';
          
          imageInfo = {
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height,
            type: getImageTypeFromSource(source)
          };
          
          if (options.showInfo && infoContainer) {
            updateInfoDisplay();
            infoContainer.style.display = 'block';
          }
          
          if (umbilical.onImageLoaded) {
            umbilical.onImageLoaded(imageInfo, instance);
          }
          
          updateImageTransform();
        };
        
        img.onerror = () => {
          loadingIndicator.style.display = 'none';
          errorMessage.textContent = 'Failed to load image';
          errorMessage.style.display = 'block';
          
          if (umbilical.onError) {
            umbilical.onError('Failed to load image', instance);
          }
        };
        
        img.src = source;
      },

      // Zoom operations
      zoom(delta) {
        const newZoom = Math.max(
          options.minZoom,
          Math.min(options.maxZoom, zoomLevel + delta)
        );
        
        if (newZoom !== zoomLevel) {
          zoomLevel = newZoom;
          updateImageTransform();
          updateZoomDisplay();
          
          if (umbilical.onZoomChanged) {
            umbilical.onZoomChanged(zoomLevel, instance);
          }
        }
      },

      setZoom(newZoom) {
        const clampedZoom = Math.max(
          options.minZoom,
          Math.min(options.maxZoom, newZoom)
        );
        
        if (clampedZoom !== zoomLevel) {
          zoomLevel = clampedZoom;
          updateImageTransform();
          updateZoomDisplay();
          
          if (umbilical.onZoomChanged) {
            umbilical.onZoomChanged(zoomLevel, instance);
          }
        }
      },

      // View operations
      resetView(updateTransform = true) {
        zoomLevel = options.initialZoom;
        panOffset = { x: 0, y: 0 };
        
        if (updateTransform) {
          updateImageTransform();
          updateZoomDisplay();
          if (umbilical.onZoomChanged) {
            umbilical.onZoomChanged(zoomLevel, instance);
          }
        }
      },

      // Save functionality
      saveImage() {
        if (!imageElement.src) return;
        
        const link = document.createElement('a');
        link.href = imageElement.src;
        
        const extension = imageInfo?.type?.toLowerCase() || 'png';
        link.download = `image_${new Date().getTime()}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },

      // Controls management
      toggleControls() {
        if (controlsContainer.style.display === 'none') {
          instance.showControls();
        } else {
          instance.hideControls();
        }
      },

      showControls() {
        controlsContainer.style.display = 'flex';
        controlsToggleBtn.title = 'Hide controls';
      },

      hideControls() {
        controlsContainer.style.display = 'none';
        controlsToggleBtn.title = 'Show controls';
      }
    };

    // Append to parent DOM
    umbilical.dom.appendChild(element);

    // Load initial image if provided
    if (umbilical.imageData) {
      instance.loadImage(umbilical.imageData);
    }

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    instance.destroy = () => {
      if (infoFadeTimer) {
        clearTimeout(infoFadeTimer);
      }
      element.remove();
      
      if (umbilical.onDestroy) {
        umbilical.onDestroy(instance);
      }
    };

    return instance;
  }
};