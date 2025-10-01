import { generateGuid as generateGuidUtil } from '../../utils/src/index.js';
import { Channel } from './Channel.js';
import { ActorSerializer } from './ActorSerializer.js';

// Dynamic import for WebSocket to support both Node.js and browser
let WebSocket;
let WebSocketServer;

/**
 * ActorSpace - Manages actors and provides space-to-space communication
 *
 * Spaces connect to other spaces via channels, hiding WebSocket implementation.
 * Each space can spawn actors and communicate with actors in remote spaces.
 *
 * IMPORTANT CONNECTION PROTOCOL:
 * - Client must be fully set up BEFORE opening WebSocket (it's ready to receive immediately)
 * - Server may still be setting up when connection opens (could miss early messages)
 * - Therefore: SERVER MUST SEND FIRST to signal it's ready
 * - Client waits for server's first message before sending anything
 */
export class ActorSpace {
    objectToGuid = new Map();
    guidToObject = new Map(); // GUID -> Actor instance

    /**
     * Initializes the ActorSpace.
     * @param {string} [spaceId] - An optional unique identifier for this actor space. Defaults to a generated GUID.
     */
    constructor(spaceId = generateGuidUtil()) {
        this.spaceId = spaceId;
        this.channels = new Map();     // channelId -> Channel instance
        this._guidCounter = 0;
        this.serializer = new ActorSerializer(this);
        this._wss = null; // WebSocket server for listen()

        console.log(`ActorSpace initialized with ID: ${this.spaceId}`);
    }

    /**
     * Registers a local actor with this space. Ensures it's tracked.
     * @param {Actor} actor
     * @param {string} key - The GUID to register the actor under
     */
    register(actor, key) {
        this.guidToObject.set(key, actor);
        this.objectToGuid.set(actor, key);
    }

    /**
     * Spawn an actor in this space and auto-register it
     * @param {Function|Object} factoryOrActor - Factory function that creates the actor, or the actor itself
     * @param {string} [id] - Optional ID for the actor, otherwise auto-generated
     * @returns {Object} { id, actor }
     */
    spawn(factoryOrActor, id = null) {
        const actor = typeof factoryOrActor === 'function' ? factoryOrActor() : factoryOrActor;
        const actorId = id || this._generateGuid();
        this.register(actor, actorId);
        return { id: actorId, actor };
    }

    /**
     * Connect this space to a remote space (client-side)
     *
     * CLIENT SIDE PROTOCOL:
     * 1. Spawn space actor FIRST (fully ready)
     * 2. Create WebSocket (still connecting)
     * 3. Create Channel with handlers (ready to receive)
     * 4. WebSocket opens -> channel fires 'channel_connected' to space actor
     * 5. Space actor receives 'channel_connected' event
     * 6. Space actor WAITS for server to send first (server signals ready)
     *
     * @param {Object} spaceActor - The actor that will manage this connection
     * @param {string} url - WebSocket URL to connect to
     * @returns {Promise<Channel>} The channel instance
     */
    async connect(spaceActor, url) {
        // Ensure WebSocket is loaded
        await this._ensureWebSocket();

        // Step 1: Auto-spawn the space actor FIRST (it's ready to receive)
        const { id: spaceActorId } = this.spawn(spaceActor, 'space-actor');

        // Step 2: Create WebSocket connection (will connect asynchronously)
        const ws = new WebSocket(url);

        // Step 3: Create channel with handlers BEFORE connection opens
        // This ensures we're ready when the connection completes
        const channel = new Channel(this, ws, spaceActor);
        this.channels.set(channel.id, channel);

        console.log(`ActorSpace ${this.spaceId}: Connecting to ${url}`);

        // Wait for connection to establish (Channel will handle 'channel_connected' event)
        return new Promise((resolve, reject) => {
            const openHandler = () => {
                ws.removeEventListener('error', errorHandler);
                resolve(channel);
            };
            const errorHandler = (error) => {
                ws.removeEventListener('open', openHandler);
                this.channels.delete(channel.id);
                reject(error);
            };
            ws.addEventListener('open', openHandler, { once: true });
            ws.addEventListener('error', errorHandler, { once: true });
        });
    }

    /**
     * Listen for incoming space connections (server-side)
     *
     * SERVER SIDE PROTOCOL:
     * 1. WebSocket connection arrives
     * 2. Create space actor via factory (may take time to initialize)
     * 3. Spawn it in ActorSpace
     * 4. Create Channel with handlers
     * 5. Channel fires 'channel_connected' to space actor when WebSocket is already open
     * 6. Space actor receives 'channel_connected' event
     * 7. Space actor MUST SEND FIRST MESSAGE to signal it's ready
     *    (client is waiting for this before sending anything)
     *
     * @param {number} port - Port to listen on
     * @param {Function} spaceActorFactory - Factory function that creates a new space actor for each connection
     */
    async listen(port, spaceActorFactory) {
        // Ensure WebSocket is loaded
        await this._ensureWebSocket();

        if (!WebSocketServer) {
            throw new Error('WebSocketServer not available (Node.js only)');
        }

        // Create WebSocket server
        this._wss = new WebSocketServer({ port });

        console.log(`ActorSpace ${this.spaceId}: Listening on port ${port}`);

        // Handle incoming connections
        this._wss.on('connection', (ws) => {
            console.log(`ActorSpace ${this.spaceId}: New connection`);

            // Step 1: Create space actor for this session (may need setup time)
            const spaceActor = spaceActorFactory();
            const { id: spaceActorId } = this.spawn(spaceActor);

            // Step 2: Create channel (WebSocket is already open at this point)
            const channel = new Channel(this, ws, spaceActor);
            this.channels.set(channel.id, channel);

            // Channel will fire 'channel_connected' to spaceActor
            // SpaceActor MUST send first message to signal ready
        });

        this._wss.on('error', (error) => {
            console.error(`ActorSpace ${this.spaceId}: WebSocket server error:`, error);
        });
    }

    /**
     * Add a channel with a websocket (legacy API for compatibility)
     * @param {object} websocket - WebSocket instance
     * @param {Object} [spaceActor] - Optional space actor to manage the channel
     * @returns {Channel}
     */
    addChannel(websocket, spaceActor = null) {
        const channel = new Channel(this, websocket, spaceActor);
        this.channels.set(channel.id, channel);
        return channel;
    }

    /**
     * Ensure WebSocket is loaded (lazy loading for environment compatibility)
     * @private
     */
    async _ensureWebSocket() {
        if (WebSocket) return;

        // Detect environment
        if (typeof window !== 'undefined' && window.WebSocket) {
            // Browser environment
            WebSocket = window.WebSocket;
        } else {
            // Node.js environment
            try {
                const ws = await import('ws');
                WebSocket = ws.default;
                WebSocketServer = ws.WebSocketServer;
            } catch (error) {
                throw new Error('WebSocket not available. Install "ws" package for Node.js: npm install ws');
            }
        }
    }

    /**
     * (Internal) Generates a unique actor GUID within this space.
     * @returns {string} The generated GUID (e.g., "ServerSpace-0").
     */
    _generateGuid() {
        const guid = `${this.spaceId}-${this._guidCounter++}`;
        // console.log(`ActorSpace ${this.spaceId} generated GUID: ${guid}`);
        return guid;
    }

    /**
     * Encodes a JavaScript object into a JSON string, handling Actors and circular references.
     * Uses the ActorSpace's knowledge of local actors.
     * @param {*} obj - The object to encode.
     * @returns {string} The JSON string representation.
     */
    encode(obj) {
        return this.serializer.serialize(obj);
    }

    // only a channel should make a remote
    makeRemote(guid, channel = this._channel) {
        const placeholder = this._channel.makeRemote(guid);
        this.guidToObject.set(guid, placeholder);
        this.objectToGuid.set(placeholder, guid);
        return placeholder;
    }

    /**
     * Decodes a JSON string back into a JavaScript object, reconstructing Actors.
     * Uses the ActorSpace's knowledge and registers remote actors/channels.
     * @param {string} str - The JSON string to decode.
                         * @param {Channel} [sourceChannel] - The channel this message arrived on (needed to map new remote actors).
                         * @returns {*} The decoded JavaScript object or value.
                         */
    decode(str, channel) {
        return this.serializer.deserialize(str, channel);
    }

    /**
     * Handles an incoming decoded message from a specific channel.
     * Routes the message payload to the target local actor.
     * @param {object} decodedMessage - The decoded message object (must have targetGuid, payload).
     * @param {Channel} sourceChannel - The channel the message arrived on.
     */
    async handleIncomingMessage(decodedMessage, channel) {
        const { targetGuid, payload, sourceGuid } = decodedMessage;

        let targetActor = this.guidToObject.get(targetGuid);

        if (targetActor) {
            const msgType = Array.isArray(payload) ? payload[0] : 'unknown';
            console.log(`ACTORSPACE ${this.spaceId}: Dispatching type="${msgType}" to actor ${targetGuid}`);

            // Check if this is a RemoteActor receiving a response
            if (targetActor.isRemote && typeof targetActor._handleResponse === 'function') {
                // This is a response to a RemoteActor's call
                console.log(`ACTORSPACE ${this.spaceId}: RemoteActor ${targetGuid} receiving response`);
                targetActor._handleResponse(payload);
                return; // Don't send response to a response
            }

            let response;
            if(Array.isArray(payload)){
                response = await targetActor.receive(...payload);
            } else {
                response = await targetActor.receive(payload);
            }
            if (response !== undefined) {
                console.log(`ACTORSPACE ${this.spaceId}: Actor ${targetGuid} returned response`);
            }

            // Phase 7: If receive() returns a response and message has sourceGuid, send response back
            if (response !== undefined && sourceGuid) {
                console.log(`ACTORSPACE ${this.spaceId}: Sending response back to ${sourceGuid}`);
                channel.send(sourceGuid, response);
            }
        } else {
            // Unknown GUID claims to be from *this* space, but we don't know it. Error.
            console.error(`ActorSpace ${this.spaceId}: Received message for unknown local target GUID: ${targetGuid}. Payload:`, payload);
        }
    }
    
    /**
     * Close all channels and stop listening
     * @returns {Promise<void>}
     */
    async close() {
        // Close all channels
        for (const channel of this.channels.values()) {
            if (channel.endpoint && typeof channel.endpoint.close === 'function') {
                channel.endpoint.close();
            }
        }

        // Close WebSocket server if listening
        if (this._wss) {
            await new Promise((resolve) => {
                this._wss.close(() => {
                    this._wss = null;
                    resolve();
                });
            });
        }
    }

    /**
     * Clean up the ActorSpace
     */
    async destroy() {
        // Close connections first
        await this.close();

        // Clear all mappings
        this.guidToObject.clear();
        this.objectToGuid.clear();
        this.channels.clear();
    }
}

export function makeActor(fn,state=null) {
    if(state){
        fn = fn.bind(state);
    }
    return { isActor: true, receive: fn }
}

// Export the class
export default ActorSpace;
