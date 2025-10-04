import { RemoteActor } from "./RemoteActor.js";
import { generateGuid } from '../../utils/src/index.js';

/**
 * Channel - Represents a communication channel connecting two ActorSpaces
 *
 * Wraps a WebSocket and provides space-to-space messaging.
 * If a spaceActor is provided, it receives connection lifecycle events:
 *
 * LIFECYCLE EVENTS:
 * - 'channel_connected' { channel } - Fired when WebSocket opens (may be immediate on server)
 * - 'channel_error' { channel, error } - Fired on WebSocket errors
 * - 'channel_closed' { channel } - Fired when WebSocket closes
 *
 * IMPORTANT: On server side, WebSocket is already open when Channel is created,
 * so 'channel_connected' fires immediately in the constructor.
 */
export class Channel {
    /**
     * Creates a new Channel.
     * @param {ActorSpace} actorSpace - The parent ActorSpace this channel belongs to.
     * @param {object} endpoint - The underlying communication endpoint (e.g., WebSocket instance or mock).
     *                            Must have `send(data)` method and `onmessage`, `onclose`, `onerror`, `onopen` properties.
     * @param {Object} [spaceActor] - Optional actor that manages this channel and receives lifecycle events
     */
    constructor(actorSpace, endpoint, spaceActor = null) {
        this.id = generateGuid();
        this.actorSpace = actorSpace;
        this.endpoint = endpoint;
        this.spaceActor = spaceActor;

        // Message chunking support for large messages
        this.chunkBuffers = new Map(); // Stores incomplete chunked messages: messageId -> {chunks: [], totalChunks: N}
        this.CHUNK_SIZE = 200 * 1024;  // 200KB chunks (safe for all WebSocket implementations)

        // Attach handlers to the underlying endpoint
        this.endpoint.onmessage = this._handleEndpointMessage.bind(this);
        this.endpoint.onerror = this._handleEndpointError.bind(this);
        this.endpoint.onclose = this._handleEndpointClose.bind(this);
        this.endpoint.onopen = this._handleEndpointOpen.bind(this);

        console.log(`Channel ${this.id} created for ActorSpace ${this.actorSpace.spaceId}`);

        // On server side, WebSocket is already open when we create the Channel
        // Fire 'channel_connected' immediately if WebSocket is in OPEN state
        if (endpoint.readyState === 1) { // WebSocket.OPEN === 1
            console.log(`Channel ${this.id}: WebSocket already open, firing channel_connected immediately`);
            if (this.spaceActor && typeof this.spaceActor.receive === 'function') {
                // Use setImmediate/setTimeout to ensure constructor completes first
                setImmediate(() => {
                    this.spaceActor.receive('channel_connected', { channel: this });
                });
            }
        }
    }

    makeRemote(guid){ // decoder has delegated to you 
        const remote = new RemoteActor(this,guid);
        return remote;
    }

    /**
     * Sends pre-encoded data over the communication endpoint.
     * Called by the ActorSpace or RemoteActor.
     * @param {string} targetGuid - The GUID of the target actor.
     * @param {*} payload - The payload to send.
     * @param {...*} args - Additional arguments (will be combined with payload in array).
     * @param {string} [sourceGuid] - Optional source GUID for response routing.
     */
    send(targetGuid, payload, ...args) {
        // Extract sourceGuid if it was passed as last arg AND is a string starting with expected pattern
        let sourceGuid = undefined;
        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            // Check if last arg looks like a GUID (contains '-' and is a string)
            if (typeof lastArg === 'string' && lastArg.includes('-')) {
                sourceGuid = lastArg;
                args.pop(); // Remove sourceGuid from args
            }
        }

        if(args.length > 0){
            payload = [payload,...args];
        }

        const message = { targetGuid, payload };
        if (sourceGuid) {
            message.sourceGuid = sourceGuid;
        }

        const encodedData = this.actorSpace.encode(message);
        const msgType = Array.isArray(payload) ? payload[0] : 'unknown';
        console.log("CHANNEL SEND: target=", targetGuid, "type=", msgType, "source=", sourceGuid || 'none', "bytes=", encodedData.length);

        try {
            // Check if message needs chunking
            if (encodedData.length > this.CHUNK_SIZE) {
                console.log(`[CHUNK] Message too large (${encodedData.length} bytes), splitting into chunks`);
                this._sendChunked(encodedData);
            } else {
                // Send normally for small messages
                this.endpoint.send(encodedData);
            }
        } catch (error) {
            console.log(`Channel ${this.channelId}: Error sending data:`, error);
            // Optionally notify ActorSpace or attempt to close
            this._handleEndpointError(error); // Simulate an error event
        }
    }

    /**
     * Closes the underlying communication endpoint.
     */
    close() {
        if (this.endpoint && typeof this.endpoint.close === 'function') {
            console.log(`Channel ${this.channelId}: Closing endpoint.`);
            this.endpoint.close();
        }
    }

    // --- Internal Event Handlers ---

    _handleEndpointMessage(event) {
        // console.log(`Channel ${this.channelId}: Received raw message:`, event.data);
        try {
            const input = event.data;

            // Try to parse as JSON to check if it's a chunk
            let parsedInput;
            try {
                parsedInput = JSON.parse(input);
            } catch (e) {
                // Not JSON, treat as regular message
                parsedInput = null;
            }

            // Check if this is a chunked message
            if (parsedInput && parsedInput.isChunk) {
                console.log(`[CHUNK] Received chunk ${parsedInput.chunkIndex + 1}/${parsedInput.totalChunks} (${input.length} bytes)`);
                const reassembledData = this._handleChunk(parsedInput);
                if (reassembledData) {
                    // All chunks received, process the complete message
                    const decodedMessage = this.actorSpace.decode(reassembledData, this);
                    const msgType = Array.isArray(decodedMessage.payload) ? decodedMessage.payload[0] : 'unknown';
                    console.log("CHANNEL RECEIVE: target=", decodedMessage.targetGuid, "type=", msgType, "bytes=", reassembledData.length, "(reassembled from chunks)");
                    this.actorSpace.handleIncomingMessage(decodedMessage, this);
                }
                return; // Don't process chunk as normal message
            }

            // Decode using the ActorSpace's decoder, passing this channel as context
            const decodedMessage = this.actorSpace.decode(event.data, this);
            const msgType = Array.isArray(decodedMessage.payload) ? decodedMessage.payload[0] : 'unknown';
            console.log("CHANNEL RECEIVE: target=", decodedMessage.targetGuid, "type=", msgType, "bytes=", input.length);
            // Pass the decoded message AND this channel instance to the ActorSpace
            this.actorSpace.handleIncomingMessage(decodedMessage, this);
        } catch (error) {
            console.error(`Channel ${this.channelId}: Error decoding/handling message:`, error, "Raw data:", event.data);
            // Optionally notify ActorSpace about the error
        }
    }

    _handleEndpointError(error) {
        console.error(`Channel ${this.id}: Endpoint error:`, error);

        // Notify space actor if present
        if (this.spaceActor && typeof this.spaceActor.receive === 'function') {
            this.spaceActor.receive('channel_error', { channel: this, error });
        }
    }

    _handleEndpointClose() {
        console.log(`Channel ${this.id}: Endpoint closed.`);

        // Notify space actor if present
        if (this.spaceActor && typeof this.spaceActor.receive === 'function') {
            this.spaceActor.receive('channel_closed', { channel: this });
        }

        // Remove from ActorSpace
        this.actorSpace.channels.delete(this.id);
    }

    _handleEndpointOpen() {
        console.log(`Channel ${this.id}: Endpoint opened.`);

        // Notify space actor if present
        if (this.spaceActor && typeof this.spaceActor.receive === 'function') {
            this.spaceActor.receive('channel_connected', { channel: this });
        }
    }

    /**
     * Splits large message into chunks and sends them sequentially
     * @param {string} data - The encoded message data to chunk
     */
    _sendChunked(data) {
        const messageId = generateGuid();
        const totalChunks = Math.ceil(data.length / this.CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.CHUNK_SIZE;
            const end = Math.min(start + this.CHUNK_SIZE, data.length);
            const chunkData = data.substring(start, end);

            const chunk = {
                isChunk: true,
                messageId,
                chunkIndex: i,
                totalChunks,
                data: chunkData
            };

            const chunkStr = JSON.stringify(chunk);
            console.log(`[CHUNK] Sending chunk ${i + 1}/${totalChunks} (${chunkStr.length} bytes)`);
            this.endpoint.send(chunkStr);
        }
    }

    /**
     * Handles incoming chunk and reassembles message when complete
     * @param {object} chunk - The chunk object {messageId, chunkIndex, totalChunks, data}
     * @returns {string|null} - The reassembled message if complete, null otherwise
     */
    _handleChunk(chunk) {
        const { messageId, chunkIndex, totalChunks, data } = chunk;

        // Initialize buffer for this message if needed
        if (!this.chunkBuffers.has(messageId)) {
            this.chunkBuffers.set(messageId, {
                chunks: new Array(totalChunks),
                receivedCount: 0
            });
        }

        const buffer = this.chunkBuffers.get(messageId);

        // Store chunk
        buffer.chunks[chunkIndex] = data;
        buffer.receivedCount++;

        // Check if all chunks received
        if (buffer.receivedCount === totalChunks) {
            console.log(`[CHUNK] All ${totalChunks} chunks received for message ${messageId}, reassembling...`);
            const reassembled = buffer.chunks.join('');
            this.chunkBuffers.delete(messageId); // Clean up
            return reassembled;
        }

        return null; // Not complete yet
    }
}

export default Channel;
