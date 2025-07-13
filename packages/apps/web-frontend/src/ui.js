/**
 * UI utilities for chat interface
 * Handles DOM manipulation and animations
 */

/**
 * Create a message element
 */
export function createMessageElement(content, type = 'user', timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'user' ? '👤' : '🤖';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = content;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(timestamp || new Date());
    
    messageContent.appendChild(bubble);
    messageContent.appendChild(time);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    
    return messageDiv;
}

/**
 * Add message to container with animation
 */
export function addMessage(container, content, type = 'user', timestamp = null) {
    const messageEl = createMessageElement(content, type, timestamp);
    container.appendChild(messageEl);
    
    // Scroll to bottom
    scrollToBottom(container);
    
    return messageEl;
}

/**
 * Remove welcome message if it exists
 */
export function removeWelcomeMessage(container) {
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (welcomeMsg.parentNode) {
                welcomeMsg.parentNode.removeChild(welcomeMsg);
            }
        }, 300);
    }
}

/**
 * Show typing indicator
 */
export function showTypingIndicator(indicator) {
    indicator.classList.add('visible');
}

/**
 * Hide typing indicator
 */
export function hideTypingIndicator(indicator) {
    indicator.classList.remove('visible');
}

/**
 * Update connection status
 */
export function updateConnectionStatus(statusElement, status) {
    const indicator = statusElement.querySelector('.status-indicator');
    const text = statusElement.querySelector('.status-text');
    
    // Remove all status classes
    indicator.classList.remove('connected', 'disconnected', 'connecting', 'reconnecting', 'error');
    
    switch (status) {
        case 'connected':
            indicator.classList.add('connected');
            text.textContent = 'Connected';
            break;
        case 'connecting':
            indicator.classList.add('connecting');
            text.textContent = 'Connecting...';
            break;
        case 'reconnecting':
            indicator.classList.add('connecting');
            text.textContent = 'Reconnecting...';
            break;
        case 'disconnected':
            indicator.classList.add('disconnected');
            text.textContent = 'Disconnected';
            break;
        case 'error':
            indicator.classList.add('disconnected');
            text.textContent = 'Connection Error';
            break;
        default:
            indicator.classList.add('disconnected');
            text.textContent = 'Unknown';
    }
}

/**
 * Enable/disable input controls
 */
export function setInputEnabled(input, button, enabled) {
    input.disabled = !enabled;
    button.disabled = !enabled;
    
    if (enabled) {
        input.focus();
    }
}

/**
 * Auto-resize textarea
 */
export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

/**
 * Scroll container to bottom smoothly
 */
export function scrollToBottom(container) {
    setTimeout(() => {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

/**
 * Format timestamp for display
 */
export function formatTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Show error message
 */
export function showErrorMessage(container, error) {
    const errorContent = `Sorry, there was an error: ${error.message || error}`;
    return addMessage(container, errorContent, 'agent');
}

/**
 * Get WebSocket URL based on current location
 */
export function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
}