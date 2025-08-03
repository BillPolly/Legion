import { generateGuid as generateGuidUtil } from '@legion/utils';
import { Channel } from './Channel.js';
//import { CustomActorSerializer as ActorSerializer } from './CustomActorSerializer.js';
import { ActorSerializer } from './ActorSerializer.js';

/**
 * Manages actors within a specific scope (space), handles serialization,
 * deserialization, and message routing across multiple communication channels.
 */
// should extend Actor
export class ActorSpace {
    objectToGuid = new Map();
    guidToObject = new Map(); // GUID -> Actor instance
    /**
     * Initializes the ActorSpace.
     * @param {string} [spaceId] - An optional unique identifier for this actor space. Defaults to a generated GUID.
     */
    constructor(spaceId = generateGuidUtil()) { // Use default parameter value
        this.spaceId = spaceId;
        this.channels = new Map();     // Map Remote Space ID -> Channel instance
        this._guidCounter = 0;
        this.serializer = new ActorSerializer(this); // Instantiate the serializer

        console.log(`ActorSpace initialized with ID: ${this.spaceId}`);
    }

     /**
     * Registers a local actor with this space. Ensures it's tracked.
     * @param {Actor} actor
     */
     register(actor, key) {
        this.guidToObject.set(key, actor);
    }

    addChannel(websocket) {
        // add a channel that looks after this web socket
        // and handle the conection handshake
        this._channel = new Channel(this, websocket);
        return this._channel;
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
    handleIncomingMessage(decodedMessage) {
        const { targetGuid, payload } = decodedMessage;

        let targetActor = this.guidToObject.get(targetGuid);

        if (targetActor) {
            if(Array.isArray(payload)){
                targetActor.receive(...payload)
            } else {
                targetActor.receive(payload);
            }
        } else {
            // Unknown GUID claims to be from *this* space, but we don't know it. Error.
            console.error(`ActorSpace ${this.spaceId}: Received message for unknown local target GUID: ${targetGuid}. Payload:`, payload);
        }
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
