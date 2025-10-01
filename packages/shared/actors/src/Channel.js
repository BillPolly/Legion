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
     * Called by the ActorSpace.
     * @param {string} encodedData - The JSON string to send.
     */
    send(targetGuid, payload,...args) {
        if(args.length > 0){
            payload = [payload,...args];
        }
        const encodedData = this.actorSpace.encode({targetGuid,payload})
        const msgType = Array.isArray(payload) ? payload[0] : 'unknown';
        console.log("CHANNEL SEND: target=", targetGuid, "type=", msgType, "bytes=", encodedData.length);
        // it will not be encoded! the
        try {
            // TODO: Check endpoint readyState before sending?
            // The underlying endpoint (e.g. WebSocket) might handle this.
            this.endpoint.send(encodedData);
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
}

export default Channel;
