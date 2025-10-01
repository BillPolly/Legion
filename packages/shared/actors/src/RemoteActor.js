
export class RemoteActor {
    /**
     * Creates a placeholder for a remote actor.
     * @param {Channel} channel - The Channel this placeholder belongs to.
     * @param {string} guid - The globally unique identifier for the remote actor.
     */
    constructor(channel, guid) {
        this.isActor = true;
        this.isRemote = true;
        this._channel = channel; // Store reference to the Channel
        this.guid = guid; // Store the GUID of the remote actor
        this._pendingCalls = new Map(); // Track pending calls waiting for responses
        this._localGuid = null; // Our local GUID for response routing
    }

    /**
     * Get or create our local GUID for response routing
     */
    _getLocalGuid() {
        if (!this._localGuid) {
            // Check if we're already registered in the ActorSpace
            this._localGuid = this._channel.actorSpace.objectToGuid.get(this);

            if (!this._localGuid) {
                // Register ourselves to get a GUID
                this._localGuid = this._channel.actorSpace._generateGuid();
                this._channel.actorSpace.register(this, this._localGuid);
            }
        }
        return this._localGuid;
    }

    /**
     * Send a message to the remote actor and optionally wait for response.
     * If the remote actor's receive() returns a value, this will return that value.
     * @param {*} payload
     * @param {...*} args - Additional arguments
     * @returns {Promise<*>} Response from remote actor (if any)
     */
    async receive(payload,...args) {
        const localGuid = this._getLocalGuid();

        // Create promise to wait for response
        const responsePromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._pendingCalls.delete(localGuid);
                resolve(undefined); // Timeout = no response (treat as fire-and-forget)
            }, 5000); // 5 second timeout

            this._pendingCalls.set(localGuid, { resolve, reject, timeoutId });
        });

        // Send message with our GUID as sourceGuid for response routing
        this._channel.send(this.guid, payload, ...args, localGuid);

        return responsePromise;
    }

    /**
     * Called by ActorSpace when a response arrives for us
     * @param {*} response - The response payload
     */
    _handleResponse(response) {
        const localGuid = this._getLocalGuid();
        const pending = this._pendingCalls.get(localGuid);

        if (pending) {
            clearTimeout(pending.timeoutId);
            this._pendingCalls.delete(localGuid);
            pending.resolve(response);
        }
    }

    // guid getter is removed as guid is now a direct property.
}
