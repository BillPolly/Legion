import { serialize as customSerialize, deserialize as customDeserialize } from '@legion/utils';

/**
 * An alternative ActorSerializer that uses the advanced custom-serializer.js
 * for robust handling of circular references, object identity, and class instances,
 * while also providing special handling for Actors.
 */
export class CustomActorSerializer {
  /**
   * @param {import('./ActorSpace.js').default} actorSpace - The ActorSpace instance.
   */
  constructor(actorSpace) {
    this.actorSpace = actorSpace;
  }

  /**
   * Serializes an object using the custom serializer with special handling for actors.
   * @param {*} obj - The object to serialize.
   * @returns {string} The JSON string.
   */
  serialize(obj) {
    const specialTypeHandler = (value, defaultProcessFn) => {
      if (value?.isActor === true) {
        let guid = this.actorSpace.objectToGuid.get(value);
        if (guid) {
          return { $specialType: 'Actor', guid: guid };
        } else {
          if (!value.isRemote) { // Local actor
            guid = this.actorSpace._generateGuid();
            this.actorSpace.objectToGuid.set(value, guid);
            this.actorSpace.guidToObject.set(guid, value);
            return { $specialType: 'Actor', guid: guid };
          } else { // Unknown RemoteActorPlaceholder
            const logPrefix = `[${this.actorSpace.spaceId} CustomSerialize Handler]`;
            console.error(`${logPrefix} Error: Encountered unknown RemoteActorPlaceholder.`, value);
            return null; // Or some other representation
          }
        }
      }
      return undefined; // Let defaultProcessFn handle it
    };

    // For now, we don't have other classes to pass to constructorMap for serialize
    // The custom-serializer will pick up constructor.name by default.
    return customSerialize(obj, { specialTypeHandler });
  }

  /**
   * Deserializes a JSON string using the custom deserializer with special handling for actors.
   * @param {string} str - The JSON string.
   * @param {import('./Channel.js').Channel} [channel] - The source channel for new remote actors.
   * @returns {*} The deserialized object.
   */
  deserialize(str, channel) {
    const specialTypeHandler = (value, defaultProcessFn) => {
      if (value?.$specialType === 'Actor' && value.guid) {
        const guid = value.guid;
        const existingObj = this.actorSpace.guidToObject.get(guid);
        if (existingObj) {
          return existingObj;
        } else {
          // Assumes channel is provided if new remote actors can be encountered
          return this.actorSpace.makeRemote(guid, channel);
        }
      }
      return undefined; // Let defaultProcessFn handle it
    };

    // For now, no other specific non-actor classes are expected from actor messages
    // that would require a constructorMap for deserialize.
    return customDeserialize(str, { specialTypeHandler });
  }
}
