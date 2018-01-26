import BitField from 'odgn-bitfield';
import { setEntityIdFromId } from './util/id';
import { isInteger, isString } from './util/is';
import uniqueId from './util/unique_id';
import readProperty from './util/read_property';
import hash from './util/hash';
import extend from './util/extend';

import Component from './component';
import Base from './base';

import { ENTITY_ID, ENTITY_SET_ID, COMPONENT_UPDATE } from './constants';


export default function Entity(options = {}) {
    this.id = 0;
    this._entitySet = null;

    this._registry = null;

    // a map of components to their def id
    this.components = {};

    this.cid = uniqueId('e');

    this._registry = readProperty(options, 'registry');

    // entity id
    this.id = readProperty(options, ENTITY_ID, 0);
    this.id = readProperty(options, 'id', this.id);

    // entityset id
    const esid = readProperty(options, ENTITY_SET_ID, 0);
    if (esid !== 0) {
        this.setEntitySetId(esid);
    }

    // bitfield indexes which components this entity has
    if (options.comBf) {
        this._bf = options.comBf;
        delete options.comBf;
    } else {
        this._bf = BitField.create();
    }
}

Object.assign(Entity.prototype, Base.prototype, {
    /**
     * Sets the id of this entity
     * @param {*} id
     */
    setEntityId(id, esId) {
        let eid = this.id;
        // // the entity id is set as the low 30 bits
        // // eid += (id & 0x3fffffff) - (eid & 0x3fffffff);
        // the entity id is set as the low 32 bits
        eid += (id & 4294967295) - (eid & 4294967295);
        this._setId(eid);

        if (esId !== undefined) {
            this.setEntitySetId(esId);
        }
    },

    /**
     * internally set the id, making sure referenced components also get updated
     *
     * @param {*} id
     */
    _setId(id) {
        this.id = id;
        Object.values(this.components).forEach(c => c.setEntityId(this.id));
    },

    /**
     * Returns the id of this entity
     */
    getEntityId() {
        // return this.get('eid') & 0x3fffffff;
        return this.id & 4294967295;
    },

    /**
     *
     * @param {*} id
     */
    setEntitySetId(id) {
        let eid = this.id;
        // the es id is set as the high 21 bits
        // this.set( 'eid', (id & 0x3fffff) * 0x40000000 + (eid & 0x3fffffff) );
        eid = (id & 2097151) * 4294967296 + (eid & 4294967295);
        this._setId(eid);
    },

    /**
     *
     */
    getEntitySetId() {
        let id = this.id;
        // return (id - (id & 0x3fffffff))  / 0x40000000;
        return (id - (id & 4294967295)) / 4294967296;
    },

    /**
     *
     * @param {*} es
     * @param {*} setId
     */
    setEntitySet(es, setId = true) {
        this._entitySet = es;
        this.setRegistry(es.getRegistry());
        if (setId) {
            this.setEntitySetId(es.id);
        }
    },

    /**
     *
     */
    getEntitySet() {
        return this._entitySet;
    },

    /**
     * Returns a hash value for this entity
     * @param {*} asString
     */
    hash(asString) {
        let result = 0;
        for (let sid in this.components) {
            result += this.components[sid].hash(true);
        }
        if (result === 0) {
            return 0;
        }
        return hash(result, asString);
    },

    /**
     * Returns a JSON representation of the entity
     * @param {*} options
     */
    toJSON(options = {}) {
        let components = this.getComponents();

        if (components) {
            components = components.map(c => c.toJSON(options));
        }
        return components;
    },

    /**
     * Adds a component instance to this entity
     *
     * @param {*} component
     */
    addComponent(component, options) {
        const registry = this.getRegistry();
        if (component === undefined) {
            return this;
        }

        if (this._entitySet) {
            this._entitySet.addComponent(component, { ...options, ENTITY_ID: this.getEntityId() });
            return this;
        }
        
        // delegate parsing/creation of components to registry
        if (registry !== undefined) {
            component = registry.createComponent(component);
        }

        if (Array.isArray(component)) {
            component.forEach(c => this.addComponent(c));
            return this;
        }
        return this._addComponent(component);
    },

    /**
     * Internal add of component
     *
     * @param {*} component
     */
    _addComponent(component) {
        const defId = component.getDefId();
        let existing = this.components[defId];

        
        if (existing !== undefined ) {
            this._removeComponent(existing);
        }

        component.setEntity(this);

        this[component.name] = component;
        this.components[defId] = component;
        this.getComponentBitfield().set(defId, true);

        // component.on('all', this._onComponentEvent, this);

        if (typeof component.onAdded === 'function') {
            component.onAdded(this);
        }

        // console.log('[Entity][_addComponent]',defId, !!existing, this.components );

        return this;
    },

    /**
     * Returns an array of all the components associated with this entity
     *
     * @param {*} componentIds
     */
    getComponents(componentIds) {
        if (!this.components) {
            return [];
        }

        if (componentIds === undefined) {
            return Object.values(this.components);
        }
        // componentIds = componentIds || this.getComponentBitfield().toValues();

        return componentIds.reduce((result, id) => {
            const com = this.components[id];
            if (com) {
                result.push(com);
            }
            return result;
        }, []);
    },

    /**
     * Removes a component from the entity
     *
     * @param {*} component
     */
    removeComponent(component, options) {
        if (!component) {
            return this;
        }

        // remove a given component by its defId or uri
        if (isString(component) || isInteger(component)) {
            const registry = this.getRegistry();
            // convert to a def id
            component = registry.getIId(component);
            component = this.components[component];
        }

        if (this._entitySet) {
            this._entitySet.removeComponent(component, options);
        } else {
            this._removeComponent(component);
        }

        return this;
    },

    /**
     * Non-public means of removing a component from the entity
     *
     * @param {*} component
     */
    _removeComponent(component) {
        let defId = component.getDefId();
        let localComponent = this.components[defId];
        // console.log('[Entity][_removeComponent]', component.cid, localComponent.cid );
        if (!localComponent) {
            // console.log('[Entity][_removeComponent]', component.cid, localComponent.cid, 'not found' );
            return this;
        }
        // NOTE - the below is contentious
        // it was commented out to allow es events to continue to make sense
        // perhaps the old entity id should be retained somewhere else?
        localComponent.setEntity(null);

        delete this[localComponent.name];
        delete this.components[defId];
        this.getComponentBitfield().set(defId, false);
        component.off('all', this._onComponentEvent, this);

        if (typeof localComponent.onRemoved === 'function') {
            localComponent.onRemoved(this);
        }

        return this;
    },

    /**
     *
     * @param {*} componentIds
     */
    removeComponents(componentIds) {
        componentIds = componentIds || this.getComponentBitfield().toValues();

        return componentIds.reduce((result, id) => {
            const com = this.components[id];
            if (com) {
                this.removeComponent(com);
                result.push(com);
            }
            return result;
        }, []);
    },

    /**
     * Returns a component by its id
     * @param {*} componentIId
     */
    getComponentByIId(componentIId) {
        componentIId = this.getRegistry().getIId(componentIId);
        if (Array.isArray(componentIId)) {
            return componentIId.map(id => this.components[id]);
        }
        return this.components[componentIId];
    },

    /**
     *
     * @param {*} componentIId
     */
    hasComponent(componentIId) {
        if (Component.isComponent(componentIId)) {
            componentIId = componentIId.getDefId();
        } else if (isString(componentIId)) {
            componentIId = this.getRegistry().getIId(componentIId);
        }
        return this.getComponentBitfield().get(componentIId);
    },

    /**
     *
     */
    hasComponents() {
        return Object.keys(this.components).length > 0;
    },

    /**
     *
     */
    getComponentBitfield() {
        // let bf = this._bf;
        // if (bf === undefined) {
        //     // TODO: the size must be configured from somewhere - otherwise will run out of space
        //     bf = BitField.create();
        //     this.set('comBf', bf);
        // }
        return this._bf;
    },

    /**
     *   The number of components on this entity
     */
    getComponentCount() {
        return Object.keys(this.components).length;
        // return this.getComponentBitfield().count();
    },

    /**
     *
     * @param {*} args
     */
    triggerEntityEvent(...args) {
        let es = this.getRegistry();
        if (es) {
            args.splice(1, 0, this);
            // console.log(`[entity][triggerEntityEvent]`, JSON.stringify(args));
            // so we end up passing evtName, recipientEntity, ...
            es.triggerEntityEvent.apply(es, args);
        }
    },

    /**
     *   Reacts to events triggered by contained components
     */
    _onComponentEvent(event, component, options) {
        if (event === 'destroy') {
            this.removeComponent(component, options);
        }
        if (event === 'update') {
            event = COMPONENT_UPDATE;
            // log.debug('_onComponentEvent ' + ' '  + ' ' + JSON.stringify(arguments));
            this.trigger(event, component, options);
        }
    }
});

Entity.prototype.type = 'Entity';
Entity.prototype.isEntity = true;

Entity.create = function(options = {}) {
    let result = new Entity(options);
    return result;
};

Entity.prototype.clone = function(options = {}) {
    let result = Entity.create({
        [ENTITY_ID]: this.id,
        [ENTITY_SET_ID]: this.esid,
        registry: this._registry
    });

    return result;
};

Entity.isEntity = entity => entity && entity.isEntity;

Entity.toEntityId = function(entityId) {
    if (Entity.isEntity(entityId)) {
        return entityId.id;
    }
    return entityId;
};

Entity.getEntityId = function(entity) {
    if (entity && entity.getEntityId) {
        return entity.getEntityId();
    }
    return undefined;
};
