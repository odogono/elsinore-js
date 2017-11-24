import Model from './model';
import Base from './base';
import { setEntityIdFromId, getEntityIdFromId, getEntitySetIdFromId } from './util/id';
import stringify from './util/stringify';
import extend from './util/extend';
import omit from './util/omit';
import hash from './util/hash';
import uniqueId from './util/unique_id';

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
    }
}

// function applyFromObject( obj, attrs, name ){
//     let attr = attrs[name];
//     if( attr !== undefined ){
//         obj[name] = attr;
//         delete attrs[name];
//     }
//     return attrs;
// }

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

        if (attrs['@i'] !== undefined) {
            this.id = attrs['@i'];
            delete attrs['@i'];
        }

        if (attrs['@s'] !== undefined) {
            this._defId = attrs['@s'];
            delete attrs['@s'];
        }

        if (attrs['@c'] !== undefined) {
            // this._defId = attrs['@c'];
            delete attrs['@c'];
        }

        if (attrs['@e'] !== undefined) {
            this.entityId = attrs['@e'];
            delete attrs['@e'];
        }

        if (attrs['@es']) {
            esId = attrs['@es'];
            delete attrs['@es'];
        }

        if (esId !== undefined) {
            eId = attrs['@e'] === undefined ? 0 : attrs['@e'];
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
     */
    apply(other, options) {
        let attrs = other;
        if (Component.isComponent(other)) {
            attrs = other.attributes;
        }

        let setting = omit(attrs, '@e', '@es', '@s', '@c');
        // console.log('[apply]', setting, 'to', this.attributes);
        this.set(setting, options);
    },

    /**
     *
     * @param {*} resp
     */
    // parse(resp) {
    //     let esId = undefined,
    //         eId = undefined;
    //     if (!resp || Object.keys(resp).length <= 0) {
    //         return resp;
    //     }
    //     if (resp['@es']) {
    //         esId = resp['@es'];
    //         delete resp['@es'];
    //     }

    //     if (resp['@i']) {
    //         resp.id = resp['@i'];
    //         delete resp['@i'];
    //     }

    //     if (esId !== undefined) {
    //         eId = resp['@e'] === undefined ? 0 : resp['@e'];
    //         resp['@e'] = setEntityIdFromId(eId, esId);
    //     }

    //     return resp;
    // },

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
        // this.attributes['@e'] = id;
    },

    setEntity(entity) {
        if (!entity || !entity.isEntity) {
            this._entity = null;
            this._entitySet = null;
            this.entityId = 0;
            // this.attributes['@e'] = undefined;
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

        // this.set({ '@s': defId, '@c': uri });
        // this._defHash = hash;
        // this.name = this._defName = name;
    },

    /**
     *
     */
    hash(asString) {
        let result = stringify(this.attributes); //omit(this.attributes, '@e', '@es', '@s', '@c', 'id'));
        return hash(result, asString);
    },

    /**
     *
     */
    clone() {
        return new Component(this.toJSON());
    },

    /**
     *
     */
    toJSON(options = {}) {
        let result = extend({}, this.attributes); //omit(this.attributes, '@e', '@es', '@c', 'id');

        if (this.id !== 0) {
            result[Component.ID] = this.id;
        }

        if (this.entityId > 0) {
            result['@e'] = this.entityId;
        }

        if (options && options.cdefMap) {
            result['@c'] = options.cdefMap[this.getDefId()];
        } else {
            result['@s'] = this.getDefId();
        }

        return result;
    }
});

class OldComponent extends Model {
    constructor(attrs, options) {
        attrs = Component.prototype.parse.call(null, attrs);
        super(attrs, options);
    }

    parse(resp) {
        let esId = undefined,
            eId = undefined;
        if (!resp || Object.keys(resp).length <= 0) {
            return resp;
        }
        if (resp['@es']) {
            esId = resp['@es'];
            delete resp['@es'];
        }

        if (resp['@i']) {
            resp.id = resp['@i'];
            delete resp['@i'];
        }

        if (esId !== undefined) {
            eId = resp['@e'] === undefined ? 0 : resp['@e'];
            resp['@e'] = setEntityIdFromId(eId, esId);
        }

        return resp;
    }

    /**
     * Applies the attributes of the first argument to this component
     */
    apply(other, options) {
        let attrs = other;
        if (Component.isComponent(other)) {
            attrs = other.attributes;
        }

        this.set(omit(attrs, '@e', '@es', '@s', '@c'), options);
    }

    get entityId() {
        return this.attributes['@e'];
    }
    set entityId(id) {
        this.attributes['@e'] = id;
    }

    getEntityId(total = true) {
        if (total) {
            return this.get('@e');
        }
        return getEntityIdFromId(this.get('@e'));
    }

    getEntitySetId() {
        return getEntitySetIdFromId(this.get('@e'));
    }

    setEntityId(id, internalId) {
        this.attributes['@e'] = id;
    }

    setEntity(entity) {
        if (!entity || !entity.isEntity) {
            this._entity = null;
            this.attributes['@e'] = undefined;
            return;
        }

        this.attributes['@e'] = entity.id;
        this._entity = entity;
    }

    getDefId() {
        return this.attributes['@s']; // this.get('@s');
    }

    getDefUri() {
        return this.attributes['@c']; // return this.get('@c');
    }

    getUri() {
        return this.attributes['@c']; // return this.get('@c');
    }
    // setDefHash: function(hash:string){
    //     this._defHash = hash;
    // },
    getDefHash() {
        return this._defHash;
    }

    getDefName() {
        return this._defName;
    }

    // setDefName: function(name:string){
    //     this.name = this._defName = name;
    // },
    setDefDetails(defId, uri, hash, name) {
        this.set({ '@s': defId, '@c': uri });
        this._defHash = hash;
        this.name = this._defName = name;
    }

    /**
     *
     */
    hash(asString) {
        let result = stringify(omit(this.attributes, '@e', '@es', '@s', '@c', 'id'));
        return hash(result, asString);
    }

    /**
     *
     */
    toJSON(options) {
        let result = omit(this.attributes, '@e', '@es', '@c', 'id');
        if (this.id !== void 0) {
            result[Component.ID] = this.id;
        }
        if (this.entityId > 0) {
            result['@e'] = this.entityId;
        }

        if (options && options.cdefMap) {
            result['@c'] = options.cdefMap[result['@s']];
            delete result['@s'];
        }
        return result;
    }
}

Component.prototype.type = 'Component';
Component.prototype.isComponent = true;
Component.prototype.cidPrefix = 'c';

Component.isComponent = function(obj) {
    return obj && obj.isComponent;
};

Component.ID = '@i';
Component.URI = '@c';
Component.DEF_ID = '@s';
Component.ENTITY_SET_ID = '@es';

Component.create = function(attrs, options) {
    const result = new Component(attrs);
    // result.set(result.parse(attrs));
    // attrs = Component.prototype.parse.apply(null,[attrs]);
    return result;
};
