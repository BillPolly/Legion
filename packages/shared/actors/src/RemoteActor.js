
export class RemoteActor {
    /**
     * Creates a placeholder for a remote actor.
     * @param {Channel} channel - The ActorSpace this placeholder belongs to.
     * @param {string} guid - The globally unique identifier for the remote actor.
     */
    constructor(channel, guid) {
        this.isActor = true;
        this.isRemote = true;
        this._channel = channel; // Store reference to the ActorSpace
        this.guid = guid; // Store the GUID directly
    }


    /**
     * Remote placeholders shouldn't normally receive messages directly via this method.
     * Messages from the remote side are handled by the ActorSpace and delivered
     * to LocalActor instances.
     * @param {*} payload
     */
    receive(payload,...args) { // receive should accept tuple of args
        this._channel.send(this.guid,payload,...args);
    }

    // guid getter is removed as guid is now a direct property.
}
