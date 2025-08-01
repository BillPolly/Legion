import { Actor } from './Actor.js';

/**
 * Temporary, lightweight actor implementations for the Transport mechanism.
 * These may be replaced or refined as the overall actor model evolves.
 * This actor uses a provided function to handle received messages.
 */
export class LocalActor extends Actor {
    /**
     * Creates a LocalActor instance.
     * @param {Function | null} [receiveFunction=null] - Optional function to handle received messages.
     */
    constructor(receiveFunction = null) { // Removed TypeScript type annotation
        super(); // Call the Actor base class constructor
        this.isRemote = false; // Specific to LocalActor
        // Bind the provided function to this instance, or use a default warning function
        this._receiveFn = receiveFunction
            ? receiveFunction.bind(this)
            : (payload) => {
                  console.warn('LocalActor received message but has no configured receive function. Payload:', payload);
              };
    }

    /**
     * Method called by the Transport when a message arrives for this actor.
     * Delegates to the configured receive function.
     * @param {*} payload - The message content.
     */
    receive(payload,...args) {
        try {
            this._receiveFn(payload);
        } catch (error) {
            console.error('Error executing LocalActor receive function:', error, 'Payload:', payload);
        }
    }
}
