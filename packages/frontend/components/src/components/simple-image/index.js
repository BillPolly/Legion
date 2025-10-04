import { UmbilicalUtils, UmbilicalError } from '@legion/components';

/**
 * SimpleImage Component
 * 
 * A minimal image display component that simply shows an image with configurable
 * aspect ratio behavior - can maintain proportions or stretch to fill container.
 */
export const SimpleImage = {
  /**
   * Create a SimpleImage instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element to contain the image');
      requirements.add('src', 'string', 'Image source URL or data URL');
      requirements.add('alt', 'string', 'Alt text for accessibility (optional)');
      requirements.add('objectFit', 'string', 'CSS object-fit value: "contain", "cover", "fill", "scale-down", "none" (optional, defaults to "contain")');
      requirements.add('onLoad', 'function', 'Callback when image loads successfully (optional)');
      requirements.add('onError', 'function', 'Callback when image fails to load (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasSrc: typeof umbilical.src === 'string' && umbilical.src.length > 0,
        hasValidObjectFit: !umbilical.objectFit || 
          ['contain', 'cover', 'fill', 'scale-down', 'none'].includes(umbilical.objectFit)
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'src'], 'SimpleImage');

    if (umbilical.dom.nodeType !== Node.ELEMENT_NODE) {
      throw new UmbilicalError('SimpleImage requires a valid DOM element', 'SimpleImage');
    }

    // Initialize options with defaults
    const options = {
      src: umbilical.src,
      alt: umbilical.alt || 'Image',
      objectFit: umbilical.objectFit || 'contain'
    };

    // Create image element
    const imageElement = document.createElement('img');
    imageElement.src = options.src;
    imageElement.alt = options.alt;
    imageElement.style.width = '100%';
    imageElement.style.height = '100%';
    imageElement.style.objectFit = options.objectFit;
    imageElement.style.objectPosition = 'center';
    imageElement.style.display = 'block';

    // Handle image load
    const handleLoad = () => {
      if (umbilical.onLoad) {
        umbilical.onLoad(instance);
      }
    };

    // Handle image error
    const handleError = () => {
      if (umbilical.onError) {
        umbilical.onError(instance);
      }
    };

    // Add event listeners
    imageElement.addEventListener('load', handleLoad);
    imageElement.addEventListener('error', handleError);

    // Create instance interface
    const instance = {
      // DOM access
      get element() {
        return imageElement;
      },

      get container() {
        return umbilical.dom;
      },

      // Properties
      get src() {
        return imageElement.src;
      },

      get alt() {
        return imageElement.alt;
      },

      get objectFit() {
        return imageElement.style.objectFit;
      },

      // Methods
      setSrc(newSrc) {
        if (typeof newSrc !== 'string') {
          throw new UmbilicalError('Source must be a string', 'SimpleImage');
        }
        imageElement.src = newSrc;
      },

      setAlt(newAlt) {
        imageElement.alt = newAlt || '';
      },

      setObjectFit(fit) {
        if (!['contain', 'cover', 'fill', 'scale-down', 'none'].includes(fit)) {
          throw new UmbilicalError('Invalid object-fit value', 'SimpleImage');
        }
        imageElement.style.objectFit = fit;
      },

      // State
      get loaded() {
        return imageElement.complete && imageElement.naturalHeight !== 0;
      },

      get naturalWidth() {
        return imageElement.naturalWidth;
      },

      get naturalHeight() {
        return imageElement.naturalHeight;
      }
    };

    // Append to parent DOM
    umbilical.dom.appendChild(imageElement);

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    instance.destroy = () => {
      // Remove event listeners
      imageElement.removeEventListener('load', handleLoad);
      imageElement.removeEventListener('error', handleError);
      
      // Remove element from DOM
      imageElement.remove();
      
      // Call destroy callback if provided
      if (umbilical.onDestroy) {
        umbilical.onDestroy(instance);
      }
    };

    return instance;
  }
};