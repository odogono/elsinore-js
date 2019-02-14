import { Base } from './base';
import {
    setEntityIDFromID,
    getEntityIDFromID,
    getEntitySetIDFromID
} from './util/id';
import { stringify } from './util/stringify';
import { extend } from './util/extend';
import { omit } from './util/omit';
import { hash } from './util/hash';
import { uniqueID } from './util/unique_id';
import { deepEqual } from './util/deep_equal';
import { deepExtend } from './util/deep_extend';
import { isComponent } from './util/is';
import { Entity } from './entity';
import { EntitySet } from './entity_set';

import {
    COMPONENT_ID,
    COMPONENT_URI,
    COMPONENT_DEF_ID,
    ENTITY_ID,
    ENTITY_SET_ID,
    EntityEvent,
    ComponentID,
    ComponentDefID,
    EntityID,
    EntitySetID
} from './types';

/**
 * Components contain data
 * @type {[type]}
 */

export class Component extends Base {
    _entity: Entity;

    _entitySet: EntitySet;

    _defID: number = 0;

    _defURI: string;

    _defName: string;

    entityID: number = 0;

    attributes: object = {};

    type: string = 'Component';

    _hash: number;

    isComponent: boolean = true;

    static create(attrs, options = {}) {
        return new Component(attrs, options);
    }

    constructor(attrs, options = {}) {
        super(options);

        this.preinitialize.apply(this, arguments);

        if (attrs !== undefined) {
            this.set(attrs, options); //this.attributes = attrs || {};
        } else {
            this._hash = this.hash();
        }
    }

    /**
     * Returns a prefix which is attached to the instances cid
     */
    getCIDPrefix(): string {
        return 'c';
    }

    preinitialize(attrs, options) {}

    /**
     * Set a hash of attributes on this component
     *
     */
    set(attrs, options = {}) {
        if (attrs == null) {
            return this;
        }
        // const unset = options.unset;
        // const silent = options.silent;

        let esID = undefined;
        let eID = undefined;

        let existing = this.attributes;
        // attrs = this.parse(attrs);

        // if (attrs['id'] !== undefined) {
        //     this.id = attrs['id'];
        //     delete attrs['id'];
        // }

        // if (attrs[COMPONENT_ID] !== undefined) {
        //     this.id = attrs[COMPONENT_ID];
        //     delete attrs[COMPONENT_ID];
        // }

        // if (attrs[COMPONENT_DEF_ID] !== undefined) {
        //     this._defID = attrs[COMPONENT_DEF_ID];
        //     delete attrs[COMPONENT_DEF_ID];
        // }

        // if (attrs[COMPONENT_URI] !== undefined) {
        //     // this._defID = attrs[COMPONENT_URI];
        //     delete attrs[COMPONENT_URI];
        // }

        // if (attrs[ENTITY_ID] !== undefined) {
        //     this.entityID = attrs[ENTITY_ID];
        //     delete attrs[ENTITY_ID];
        // }

        // if (attrs[ENTITY_SET_ID]) {
        //     esID = attrs[ENTITY_SET_ID];
        //     delete attrs[ENTITY_SET_ID];
        // }

        // if (esID !== undefined) {
        //     eID = attrs[ENTITY_ID] === undefined ? 0 : attrs[ENTITY_ID];
        //     this.entityID = setEntityIDFromID(eID, esID);
        // }

        // determine what changes (if any) have occured
        let changes = [];
        for (let attr in attrs) {
            let value = attrs[attr];
            if (existing[attr] != value) {
                changes.push(attr);
            }
        }

        // console.log('[set]', attrs, existing, changes);

        if (changes.length > 0) {
            extend(existing, attrs); // typeof attrs === 'function' ? attrs(existing) : attrs);
            this._hash = this.hash();
            this.trigger(EntityEvent.ComponentUpdate, changes);
        }

        return this;
    }

    /**
     *
     */
    get(name: string): any {
        return this.attributes[name];
    }

    /**
     * Applies the attributes of the first argument to this component
     *
     */
    apply(other, options) {
        let attrs = other;
        if (isComponent(other)) {
            attrs = other.attributes;
        }

        let setting = omit(
            attrs,
            ENTITY_ID,
            ENTITY_SET_ID,
            COMPONENT_DEF_ID,
            COMPONENT_URI
        );
        this.set(setting, options);
    }

    /**
     *
     */
    getEntityID(total = true): EntityID {
        if (total) {
            return this.entityID;
        }
        return getEntityIDFromID(this.entityID);
    }

    getEntitySetID() : EntitySetID {
        return getEntitySetIDFromID(this.entityID);
    }

    setEntityID(id, internalID) {
        this.entityID = id;
        // this.attributes[ENTITY_ID] = id;
    }

    setEntity(entity) {
        if (!entity || !entity.isEntity) {
            this._entity = null;
            this._entitySet = null;
            this.entityID = 0;
            // this.attributes[ENTITY_ID] = undefined;
            return;
        }

        this.entityID = entity.id;
        this._entity = entity;
        if (entity._entitySet) {
            this._entitySet = entity._entitySet;
            // this._registry = entity._registry;
        }
    }

    /**
     * Returns the identifier of what type of component this is
     */
    getDefID() {
        return this._defID;
    }

    /**
     * Returns the uri identifier of what type of component this
     * is
     */
    getDefUri() {
        return this._defURI;
    }

    // getDefHash() {
    //     return this._defHash;
    // }

    /**
     * Returns the name of this component type
     *
     */
    getDefName() {
        return this._defName;
    }

    /**
     * Convenient way of setting various identifiers for this component
     *
     * @param {*} defID
     * @param {*} uri
     * @param {*} hash
     * @param {*} name
     */
    setDefDetails(defID, uri, hash, name) {
        this._defID = defID;
        this._defURI = uri;
        // this._defHash = hash;
        this._defName = name;
    }

    /**
     *
     */
    clone() {
        // const clone = Object.assign( {}, this );
        // Object.setPrototypeOf( clone, Object.getPrototypeOf(this) );
        // return clone;
        let clone = Object.assign(
            Object.create(Object.getPrototypeOf(this)),
            this
        );
        clone.attributes = deepExtend({}, this.attributes);
        return clone;
        // return Object.assign( Object.getPrototypeOf(this), deepExtend(this) );
    }

    /**
     * Compares this and another for equality
     *
     */
    compare(other) {
        if (!other || !other.isComponent) {
            return false;
        }
        if (this == other) {
            return true;
        }
        if (this._hash == other._hash) {
            return true;
        }

        return deepEqual(this.attributes, other.attributes);
    }

    /**
     * Returns a JSON representation of this component
     *
     */
    toJSON(options: JSONOptions = {}) {
        let result = extend({}, this.attributes);

        // NOTE - no actual need for a component to reveal its id - its uniqueness
        // comes from its defID and entityID
        // if (this.id !== 0) {
        //     result[COMPONENT_ID] = this.id;
        // }

        if (this.entityID > 0) {
            result[ENTITY_ID] = this.entityID;
        }

        if (options && options.cdefMap) {
            result[COMPONENT_URI] = options.cdefMap[this.getDefID()];
        } else {
            result[COMPONENT_DEF_ID] = this.getDefID();
        }

        return result;
    }
}

interface JSONOptions {
    cdefMap?: Map<number, Component>;
}

/**
 *
 */
export function setComponentID(
    componentID: ComponentID,
    component: Component
): Component {
    let result = new Component(undefined, { id: componentID });
    result.attributes = component.attributes; //deepExtend({}, this.attributes)
    result._hash = component._hash; //result.hash();
    return result;
}

/**
 * Produces a copy of a component
 */

/**
 *
 */
export function cloneComponent(srcComponent, attrs?, options?) {
    const result = srcComponent.clone();

    if (attrs) {
        result.set(attrs, options);
    }

    return result;
}
