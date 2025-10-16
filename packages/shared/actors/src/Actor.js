import {query} from "./Query.js";

/**
 * Base class for all actors.
 * Defines the fundamental actor contract.
 */

// REMOVED: Object.prototype pollution that breaks Playwright and other libraries
// These monkey patches were causing "headers[5].value: expected string, got function" errors
// because Object.prototype.receive was being inherited by all objects including Playwright's internal structures
//
// If you need receive() behavior, implement it explicitly in your classes instead of polluting prototypes!

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
