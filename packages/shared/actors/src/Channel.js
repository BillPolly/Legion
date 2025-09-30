import { RemoteActor } from "./RemoteActor.js";
/**
 * Represents a communication channel (e.g., wrapping a WebSocket)
 * connecting an ActorSpace to another endpoint.
 * 
 * it could provide a port for status messages, it could try to reconnect
 * 
 */
export class Channel {
    /**
     * Creates a new Channel.
     * @param {ActorSpace} actorSpace - The parent ActorSpace this channel belongs to.
     * @param {object} endpoint - The underlying communication endpoint (e.g., WebSocket instance or mock).
     *                            Must have `send(data)` method and `onmessage`, `onclose`, `onerror`, `onopen` properties.
     */
    constructor(actorSpace, endpoint) {

        this.actorSpace = actorSpace;
        this.endpoint = endpoint;
        // Attach handlers to the underlying endpoint
        this.endpoint.onmessage = this._handleEndpointMessage.bind(this);
        this.endpoint.onerror = this._handleEndpointError.bind(this);
        this.endpoint.onclose = this._handleEndpointClose.bind(this);
        this.endpoint.onopen = this._handleEndpointOpen.bind(this);

        console.log(`Channel  created for ActorSpace ${this.actorSpace.spaceId}.`);
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
        console.error(`Channel ${this.channelId}: Endpoint error:`, error);
        // Notify ActorSpace? Trigger cleanup?
        // this.actorSpace.handleChannelError(this, error);
    }

    _handleEndpointClose() {
        console.log(`Channel ${this.channelId}: Endpoint closed.`);
        // Notify ActorSpace so it can remove the channel and associated remote actors
        //this.actorSpace.removeChannel(this.channelId);
    }

    _handleEndpointOpen() {
        console.log(`Channel ${this.channelId}: Endpoint opened.`);
        // Notify ActorSpace?
        // this.actorSpace.handleChannelOpen(this);
    }
}

export default Channel;
