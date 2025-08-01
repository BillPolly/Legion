# Actor Communication Architecture

This document outlines the design for an actor-based communication system. It enables location-transparent messaging between actors, potentially across different communication channels (like WebSockets), using `ActorSpace` instances to manage and route messages.

## Overview

The system is designed to facilitate communication between different parts of an application, or even between different applications, using an actor model. Actors are independent units of computation that communicate by exchanging messages. This architecture aims for location transparency, meaning an actor sending a message does not need to know if the recipient is in the same process or a remote one.

### Core Components:

*   **`Actor`**: The fundamental building block. Represents a local entity that can receive and process messages. It has its own state and behavior defined by a `receiveFunction`.
*   **`RemoteActor`**: A proxy or placeholder for an actor that resides in a different `ActorSpace` (potentially on a remote system). It allows local actors to send messages to remote actors seamlessly.
*   **`ActorSpace`**: A container and routing hub for actors. Each `ActorSpace` has a unique `spaceId` and manages the lifecycle, identity (via GUIDs), and message routing for actors within its scope. It handles the serialization and deserialization of messages, including the translation of actor references to and from GUIDs.
*   **`Channel`**: Represents a bi-directional communication link (e.g., wrapping a WebSocket connection) that connects one `ActorSpace` to another endpoint. It is responsible for the raw transmission of encoded messages.

### Key Concepts:

*   **GUIDs (Globally Unique Identifiers)**: Actors are identified by GUIDs (e.g., `"MySpace-0"`, `"AnotherSpace-12"`). This allows messages to uniquely target actors across different `ActorSpace` instances.
*   **Message Serialization/Deserialization**: When messages are sent, especially across `Channel`s, any `Actor` or `RemoteActor` instances within the message payload are converted into a special representation containing their GUID. Upon receipt, these are converted back into the appropriate `Actor` (if local) or `RemoteActor` (if the GUID points to an actor in another space) instances. This process is handled by the `CustomActorSerializer` within the `ActorSpace`. This serializer leverages the advanced `custom-serializer.js`, providing robust handling of complex circular structures (restoring them fully) and object identity, while correctly handling actor references via a `specialTypeHandler`. It also has the capability to preserve class instances if needed (though not currently used for basic actor messaging).
*   **Message Routing**:
    *   When an `ActorSpace` receives a message via a `Channel`, it decodes the message using the `CustomActorSerializer` and uses the `targetGuid` to deliver it to the correct local `Actor`.
    *   When a local `Actor` sends a message to a `RemoteActor`, the `RemoteActor` proxy uses its associated `Channel` to transmit the message to the remote system where the actual target actor resides.

## Detailed Implementation

The system is primarily implemented across the following JavaScript files:

### 1. `Actor.js` - The `Actor` Class

Represents an actor that resides locally within an `ActorSpace`.

*   **`constructor(receiveFunction = null)`**:
    *   Initializes the actor.
    *   `isActor = true` (marker property).
    *   `isRemote = false` (indicates it's a local actor).
    *   `_receiveFn`: Stores the function provided by the user to handle incoming messages. If none is provided, a default warning function is used.
*   **`receive(payload)`**:
    *   This method is invoked by the `ActorSpace` when a message arrives for this actor.
    *   It executes the `_receiveFn` with the given `payload`.
    *   Includes error handling for the `_receiveFn` execution.

### 2. `RemoteActor.js` - The `RemoteActor` Class

Acts as a placeholder or proxy for an actor that exists in a different `ActorSpace`, accessible via a `Channel`.

*   **`constructor(channel, guid)`**:
    *   `isActor = true` (marker property).
    *   `isRemote = true` (indicates it's a proxy for a remote actor).
    *   `_channel`: A reference to the `Channel` instance through which messages to this remote actor should be sent.
    *   `guid`: The globally unique identifier of the actual remote actor this placeholder represents.
*   **`receive(payload)`**:
    *   **Important Note**: Despite its name, this method is used to *send* a message *to* the remote actor this placeholder represents.
    *   It calls `this._channel.send(this.guid, payload)`, instructing the channel to transmit the payload to the target GUID.

### 3. `ActorSpace.js` - The `ActorSpace` Class

The central component for managing actors and orchestrating message flow.

*   **`constructor(spaceId = generateGuidUtil())`**:
    *   `spaceId`: A unique identifier for this actor space. Defaults to a generated GUID.
    *   `objectToGuid` (Map): Maps local `Actor` instances and `RemoteActor` proxies to their GUIDs.
    *   `guidToObject` (Map): Maps GUIDs back to their corresponding `Actor` or `RemoteActor` instances.
    *   `_guidCounter`: Used for generating unique GUID suffixes within this space.
    *   `_channel`: Stores a reference to the primary `Channel` instance associated with this space.
    *   `serializer`: An instance of `CustomActorSerializer` responsible for encoding and decoding messages.
*   **Key Methods**:
    *   **`register(actor, key)`**: Registers a local actor with a specific key (GUID) in the `guidToObject` map.
    *   **`addChannel(websocket)`**:
        *   Creates a new `Channel` instance, providing it with a reference to this `ActorSpace` and the underlying `websocket` endpoint.
        *   Assigns the newly created channel to `this._channel`.
        *   Returns the created `Channel` instance.
    *   **`_generateGuid()`**: Generates a unique GUID string prefixed with `this.spaceId`.
    *   **`encode(obj)`**: Delegates the serialization task to `this.serializer.serialize(obj)`.
    *   **`decode(str, channel)`**: Delegates the deserialization task to `this.serializer.deserialize(str, channel)`.
    *   **`makeRemote(guid, channel = this._channel)`**:
        *   Creates a new `RemoteActor` instance using the provided `guid` and `channel`. (Note: This is called internally by the deserialization logic when an unknown actor GUID is encountered).
        *   Stores mappings for this new `RemoteActor` in `guidToObject` and `objectToGuid`.
        *   Returns the created `RemoteActor` placeholder.
    *   **`handleIncomingMessage(decodedMessage)`**:
        *   Called by a `Channel` when a decoded message arrives.
        *   Extracts `targetGuid` and `payload` from the `decodedMessage`.
        *   Looks up the `targetGuid` in `guidToObject` to find the local `Actor`.
        *   If a local `Actor` is found, its `receive(payload)` method is called.
        *   Logs an error if the `targetGuid` refers to an unknown local actor.
*   **Exported Helper Function**:
    *   **`makeActor(fn)`**: A simple utility to create an object that conforms to the basic actor structure: `{ isActor: true, receive: fn }`.

### 4. `CustomActorSerializer.js` - The `CustomActorSerializer` Class

The serializer used by the system, leveraging the advanced `custom-serializer.js`.

*   Bound to an `ActorSpace` instance.
*   Uses `custom-serializer.js`'s `specialTypeHandler` mechanism to serialize/deserialize actors using a `{$specialType: 'Actor', guid: guid}` structure.
*   Inherits robust handling of circular references (full restoration) and object identity from `custom-serializer.js`.
*   Can potentially preserve other class instances if configured with appropriate `constructorMap` options.

### 5. `Channel.js` - The `Channel` Class

Represents a bi-directional communication link between an `ActorSpace` and another endpoint (e.g., a WebSocket server/client).

*   **`constructor(actorSpace, endpoint)`**:
    *   `actorSpace`: A reference to the parent `ActorSpace` this channel belongs to.
    *   `endpoint`: The underlying communication mechanism (e.g., a WebSocket instance). It's expected to have `send(data)` method and `onmessage`, `onclose`, `onerror`, `onopen` event handlers.
    *   Attaches internal handlers (`_handleEndpointMessage`, etc.) to the endpoint's events.
*   **Key Methods**:
    *   **`makeRemote(guid)`**:
        *   Called by `ActorSpace.decode()` when a new remote actor GUID is encountered.
        *   Creates and returns a new `RemoteActor` instance, associating it with this `Channel` and the given `guid`.
    *   **`send(targetGuid, payload)`**:
        *   Called by `RemoteActor.receive()` (or potentially other parts of the system needing to send a message through this channel).
        *   It first **encodes** the message object `{targetGuid, payload}` using `this.actorSpace.encode()` (which delegates to the configured serializer).
        *   Then, it sends the resulting `encodedData` string over the `this.endpoint.send()`.
    *   **`close()`**: Closes the underlying communication endpoint if available.
    *   **Internal Event Handlers**:
        *   `_handleEndpointMessage(event)`:
        *   Triggered when the underlying endpoint receives data.
        *   Decodes the `event.data` using `this.actorSpace.decode(event.data, this)` (which delegates to the configured serializer), crucially passing `this` (the channel instance) so that new `RemoteActor`s can be associated with it.
        *   Calls `this.actorSpace.handleIncomingMessage(decodedMessage)` to let the `ActorSpace` process the message.
        *   `_handleEndpointError(error)`: Logs endpoint errors.
        *   `_handleEndpointClose()`: Logs when the endpoint is closed.
        *   `_handleEndpointOpen()`: Logs when the endpoint is opened.

### Message Structure

Messages exchanged, especially those encoded for transmission over a `Channel`, typically follow this structure after encoding by `ActorSpace.encode` and before decoding by `ActorSpace.decode`:

```json
{
  "targetGuid": "some-spaceId-counter", // GUID of the recipient actor
  "payload": { /* The actual message content */ }
}
```
When actor references are part of the `payload`, they are replaced with `{"#actorGuid": "guid-of-actor"}` during encoding.
