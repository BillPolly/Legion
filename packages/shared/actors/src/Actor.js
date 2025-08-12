import {query} from "./Query.js";

/**
 * Base class for all actors.
 * Defines the fundamental actor contract.
 */

// monkey patch object to default to normal dispatch for receive
Object.prototype.receive = function(payload, ...args) {
    if (typeof payload === 'string' && typeof this[payload] === 'function') {
        return this[payload](...args);
    }
    // console.warn('Object received message but has no specific receive implementation or method. Payload:', payload);
};

//
Object.prototype.CREATE = function(fn,state={}){
    return fn.bind(state); // state must always have the create function
}

// monkey patch function to accept Actor input, so it can work as a subscription to a port
Function.prototype.receive = function (...message) {
    return this(...message);
};

export class Actor {
    isActor = true;

    /**
     * Method to be called when a message is received by the actor.
     * Subclasses should override this to implement message handling logic.
     * @param {*} payload - The message content.
     */
    receive(payload,...args) {
        super.receive(payload, ...args);
    }

    // synchronous, you will always get a Actor back 
    call(payload,...args){
        // delegate to the pluggable query engine that defaults to this
        return this;
    }

    async query(payload, ...args) {
        // delegate to the pluggable query engine that defaults to this
        return this;
    }
}


// we should money patch
