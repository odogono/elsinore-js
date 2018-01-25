import Base from './base';
import { setEntityIdFromId, getEntityIdFromId, getEntitySetIdFromId } from './util/id';
import stringify from './util/stringify';
import extend from './util/extend';
import omit from './util/omit';
import hash from './util/hash';
import uniqueId from './util/unique_id';
import { deepEqual } from './util/deep_equal';
import { deepExtend } from './util/deep_extend';

// const COMPONENT_ID = '@i';
// const ENTITY_ID = '@e';



/**
 * Components contain data
 * @type {[type]}
 */

export default function Component(attrs, options) {
    this.id = 0;

    this.cid = uniqueId('c');

    this._entity = null;

    this._entitySet = null;

    this._registry = null;

    this._defId = 0;

    this._defUri = null;

    this.entityId = 0;

    this.attributes = {};

    this.preinitialize.apply(this, arguments);

    if (attrs !== undefined) {
        this.set(attrs, options); //this.attributes = attrs || {};
    } else {
        this._hash = this.hash();
    }
}


Object.assign(Component.prototype, Base.prototype, {
    preinitialize(attrs, options) {},

    /**
     * Set a hash of attributes on this component
     *
     * @param {*} attrs
     * @param {*} options
     */
    set(attrs, options = {}) {
        if (attrs == null) {
            return this;
        }
        const unset = options.unset;
        const silent = options.silent;

        let esId = undefined;
        let eId = undefined;

        let existing = this.attributes;
        // attrs = this.parse(attrs);

        if (attrs['id'] !== undefined) {
            this.id = attrs['id'];
            delete attrs['id'];
        }

        if (attrs[Component.ID] !== undefined) {
            this.id = attrs[Component.ID];
            delete attrs[Component.ID];
        }

        if (attrs[Component.DEF_ID] !== undefined) {
            this._defId = attrs[Component.DEF_ID];
            delete attrs[Component.DEF_ID];
        }

        if (attrs[Component.URI] !== undefined) {
            // this._defId = attrs[Component.URI];
            delete attrs[Component.URI];
        }

        if (attrs[Component.ENTITY_ID] !== undefined) {
            this.entityId = attrs[Component.ENTITY_ID];
            delete attrs[Component.ENTITY_ID];
        }

        if (attrs[Component.ENTITY_SET_ID]) {
            esId = attrs[Component.ENTITY_SET_ID];
            delete attrs[Component.ENTITY_SET_ID];
        }

        if (esId !== undefined) {
            eId = attrs[Component.ENTITY_ID] === undefined ? 0 : attrs[Component.ENTITY_ID];
            this.entityId = setEntityIdFromId(eId, esId);
        }

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
            this.emit('component:update', changes);
        }

        return this;
    },

    /**
     *
     * @param {*} name
     */
    get(name) {
        return this.attributes[name];
    },

    /**
     * Applies the attributes of the first argument to this component
     *
     * @param {*} other
     * @param {*} options
     */
    apply(other, options) {
        let attrs = other;
        if (Component.isComponent(other)) {
            attrs = other.attributes;
        }

        let setting = omit(attrs, Component.ENTITY_ID, Component.ENTITY_SET_ID, Component.DEF_ID, Component.URI);
        this.set(setting, options);
    },

    /**
     *
     * @param {boolean} total
     */
    getEntityId(total = true) {
        if (total) {
            return this.entityId;
        }
        return getEntityIdFromId(this.entityId);
    },

    getEntitySetId() {
        return getEntitySetIdFromId(this.entityId);
    },

    setEntityId(id, internalId) {
        this.entityId = id;
        // this.attributes[Component.ENTITY_ID] = id;
    },

    setEntity(entity) {
        if (!entity || !entity.isEntity) {
            this._entity = null;
            this._entitySet = null;
            this.entityId = 0;
            // this.attributes[Component.ENTITY_ID] = undefined;
            return;
        }

        this.entityId = entity.id;
        this._entity = entity;
        if (entity._entitySet) {
            this._entitySet = entity._entitySet;
        }
    },

    getDefId() {
        return this._defId; // this.attributes['@s']; // this.get('@s');
    },

    getDefUri() {
        return this._defUri; // this.attributes['@c']; // return this.get('@c');
    },

    getUri() {
        return this._defUri; //this.attributes['@c']; // return this.get('@c');
    },
    // setDefHash: function(hash:string){
    //     this._defHash = hash;
    // },
    getDefHash() {
        return this._defHash;
    },

    getDefName() {
        return this._defName;
    },

    // setDefName: function(name:string){
    //     this.name = this._defName = name;
    // },
    setDefDetails(defId, uri, hash, name) {
        this._defId = defId;
        this._defUri = uri;
        this._defHash = hash;
        this.name = this._defName = name;
    },

    /**
     *
     */
    hash(asString) {
        let result = stringify(this.attributes); //omit(this.attributes, Component.ENTITY_ID, Component.ENTITY_SET_ID, '@s', '@c', 'id'));
        return hash(result, asString);
    },

    /**
     *
     */
    clone() {
        // const clone = Object.assign( {}, this );
        // Object.setPrototypeOf( clone, Object.getPrototypeOf(this) );
        // return clone;
        let clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        clone.attributes = deepExtend( {}, this.attributes );
        return clone;
        // return Object.assign( Object.getPrototypeOf(this), deepExtend(this) );
    },

    /**
     * Compares this and another for equality
     *
     * @param {*} other
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
    },

    /**
     * Returns a JSON representation of this component
     * 
     * @param {*} options 
     */
    toJSON(options = {}) {
        let result = extend({}, this.attributes); //omit(this.attributes, Component.ENTITY_ID, Component.ENTITY_SET_ID, '@c', 'id');

        // NOTE - no actual need for a component to reveal its id - its uniqueness
        // comes from its defId and entityId
        // if (this.id !== 0) {
        //     result[Component.ID] = this.id;
        // }

        if (this.entityId > 0) {
            result[Component.ENTITY_ID] = this.entityId;
        }

        if (options && options.cdefMap) {
            result[Component.URI] = options.cdefMap[this.getDefId()];
        } else {
            result[Component.DEF_ID] = this.getDefId();
        }

        return result;
    }
});

Component.prototype.type = 'Component';
Component.prototype.isComponent = true;
Component.prototype.cidPrefix = 'c';

Component.isComponent = function(obj) {
    return obj && obj.isComponent;
};

Component.ID = '@i';
Component.URI = '@c';
Component.DEF_ID = '@s';
Component.ENTITY_ID = '@e';
Component.ENTITY_SET_ID = '@es';

Component.create = function(attrs, options) {
    const result = new Component(attrs);
    // result.set(result.parse(attrs));
    // attrs = Component.prototype.parse.apply(null,[attrs]);
    return result;
};
