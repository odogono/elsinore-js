import { Base, BaseOptions } from './base';
import { Component, cloneComponent } from './component';
import { ComponentDefID, ComponentID, ENTITY_ID, ENTITY_SET_ID, EntityEvent, EntityID, EntitySetID } from './types';
// import { setEntityIDFromID } from './util/id';
import { isComponent, isEntity, isEntityID, isInteger, isString } from './util/is';

import { BitField } from 'odgn-bitfield';
import { ComponentDef } from './component_def';
import { EntitySet } from './entity_set';
import { Registry } from './registry';
import { arrayDifference } from './util/array/difference';
import { hash } from './util/hash';
import { readProperty } from './util/read_property';
import { uniqueID } from './util/unique_id';

export interface EntityOptions extends BaseOptions {
    [ENTITY_ID]?: EntityID;
    [ENTITY_SET_ID]?: EntitySetID;
    comBf?: BitField;
    registry?: Registry;
}

export interface ComponentMap {
    [id: number]: Component;
}

export interface ComponentNameMap {
    [name: string]: Component;
}

/**
 * processing of incoming options prior to construction
 */
function convertOptions(options:EntityOptions = {}){
    if( options[ENTITY_ID] ){
        options.id = options[ENTITY_ID];
    }
    // entityset id
    const esid = readProperty(options, ENTITY_SET_ID, 0);

    if (esid !== 0) {
        this.setEntitySetID(esid);
    }

    return options;
}


export class Entity extends Base {
    
    readonly type:string = 'Entity';
    
    readonly isEntity:boolean = true;

    _entitySet:EntitySet;
    
    components:ComponentMap;
    
    _bf: BitField;

    component: ComponentNameMap = {};

    // [key: string]: Component;

    // [key: string]: Component;

    static create( options:EntityID | EntityOptions = {} ){
        if( isEntityID(options) ){
            return new Entity({ [ENTITY_ID]:<EntityID>options } );
        }
        return new Entity(<EntityOptions>options);
    }


    static toEntityID( entityID:Entity|EntityID ) : EntityID {
        if( isEntity(entityID) ){
            return (<Entity>entityID).id;
        }
        return <EntityID>entityID;
    }

    static getEntityID( entity:any ) : EntityID {
        if( entity && entity.getEntityID ){
            return entity.getEntityID();
        }
        return undefined;
    }


    /**
     * 
     */
    constructor( options:EntityOptions = {} ){
        super( convertOptions(options) );
        
        this._entitySet = null;

        // a map of components to their def id
        this.components = {};

        // bitfield indexes which components this entity has
        if (options.comBf) {
            this._bf = options.comBf;
            delete options.comBf;
        } else {
            this._bf = BitField.create();
        }
    }

    /**
     * Returns a prefix which is attached to the instances cid
     */
    getCIDPrefix() : string {
        return 'e';
    }
    
    /**
     * Sets the id of this entity
     * @param {*} id
     */
    // setEntityID(id:number, esID?:number) {
    //     let eid = this.id;
    //     // // the entity id is set as the low 30 bits
    //     // // eid += (id & 0x3fffffff) - (eid & 0x3fffffff);
    //     // the entity id is set as the low 32 bits
    //     eid += (id & 4294967295) - (eid & 4294967295);
    //     this._setID(eid);

    //     if (esID !== undefined) {
    //         this.setEntitySetID(esID);
    //     }
    // }

    /**
     * internally set the id, making sure referenced components also get updated
     *
     * @param {*} id
     */
    // _setID(id) {
    //     this.id = id;
    //     Object.values(this.components).forEach(c => c.setEntityID(this.id));
    // }

    /**
     * Returns the id of this entity
     */
    getEntityID() {
        // return this.get('eid') & 0x3fffffff;
        return this.id & 4294967295;
    }

    /**
     *
     * @param {*} id
     */
    // setEntitySetID(id) {
    //     let eid = this.id;
    //     // the es id is set as the high 21 bits
    //     // this.set( 'eid', (id & 0x3fffff) * 0x40000000 + (eid & 0x3fffffff) );
    //     eid = (id & 2097151) * 4294967296 + (eid & 4294967295);
    //     this._setID(eid);
    // }

    /**
     *
     */
    getEntitySetID() {
        let id = this.id;
        // return (id - (id & 0x3fffffff))  / 0x40000000;
        return (id - (id & 4294967295)) / 4294967296;
    }

    /**
     *
     * @param {*} es
     * @param {*} setID
     */
    // setEntitySet(es, setID = true) {
    //     const registry = es.getRegistry();
    //     this._entitySet = es;
    //     this.setRegistry( registry );
    //     for (let sid in this.components) {
    //         this.components[sid].setEntity(this);
    //     }
    //     if (setID) {
    //         this.setEntitySetID(es.id);
    //     }
    // }

    /**
     *
     */
    getEntitySet() {
        return this._entitySet;
    }

    /**
     * Returns a hash value for this entity
     */
    hash() : number {
        let result:string = '';
        for (let sid in this.components) {
            result += this.components[sid].toJSON();
        }
        if (result === '') {
            return 0;
        }
        return <number>hash(result, false);
    }

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
    }

    /**
     * Adds a component instance to this entity
     *
     * @param {*} component
     */
    addComponent(component, options = {}) {
        const registry = this.getRegistry();
        if (component === undefined) {
            return this;
        }

        // DONT BE TEMPTED TO ADD DIRECTLY TO REFERENCED ENTITYSET
        
        // delegate parsing/creation of components to registry
        if (registry !== undefined) {
            component = registry.createComponent(component);
        }
        
        if (Array.isArray(component)) {
            component.forEach(c => this.addComponent(c));
            return this;
        }
        

        return this._addComponent(component);
    }

    /**
     * Internal add of component
     *
     * @param {*} component
     */
    _addComponent(component:Component) {
        const registry = this.getRegistry();
        const defID = component.getDefID();
        let existing = this.components[defID];

        if (existing !== undefined) {
            this._removeComponent(existing);
        }

        component.setEntity(this);

        let name = component.getDefName();
        if( isString(name) ){
            this.component[name] = component;
        } else if( registry ){
            const def = <ComponentDef>registry.getComponentDef( defID );
            this.component[def.getName()] = component;
        }

        this.components[defID] = component;
        
        this.getComponentBitfield().set(defID, true);

        if (typeof component['onAdded'] === 'function') {
            component['onAdded'](this);
        }

        return this;
    }

    /**
     * Returns an array of all the components associated with this entity
     *
     * @param {*} componentIDs
     */
    getComponents(componentIDs?:Array<string>) : Array<Component> {
        if (!this.components) {
            return [];
        }

        if (componentIDs === undefined) {
            return Object.values(this.components);
        }
        
        return componentIDs.reduce((result, id) => {
            const com = this.components[id];
            if (com) {
                result.push(com);
            }
            return result;
        }, []);
    }

    // getComponent( componentID ) : Component {
    //     return this.getRegistry().getIID(componentID);
    // }

    /**
     * Removes a component from the entity
     *
     * @param {*} component
     */
    removeComponent(component:(string|ComponentDefID|Component)) {
        if (!component) {
            return this;
        }

        // remove a given component by its defID or uri
        if (isString(component) || isInteger(component)) {
            const registry = this.getRegistry();
            // convert to a def id
            let defID = <number>registry.getIID( <string>component);
            component = this.components[defID];
        }

            this._removeComponent(component);

        return this;
    }

    /**
     * Non-public means of removing a component from the entity
     *
     * @param {*} component
     */
    _removeComponent(component) {
        let defID = component.getDefID();
        let localComponent = this.components[defID];
        // console.log('[Entity][_removeComponent]', component.cid, localComponent.cid );
        if (!localComponent) {
            // console.log('[Entity][_removeComponent]', component.cid, localComponent.cid, 'not found' );
            return this;
        }
        // NOTE - the below is contentious
        // it was commented out to allow es events to continue to make sense
        // perhaps the old entity id should be retained somewhere else?
        localComponent.setEntity(null);

        delete this.component[localComponent.getDefName()];

        delete this.components[defID];
        
        this.getComponentBitfield().set(defID, false);
        
        component.off('all', this._onComponentEvent, this);

        if (typeof localComponent['onRemoved'] === 'function') {
            localComponent['onRemoved'](this);
        }

        return this;
    }

    /**
     *
     * @param {*} componentIDs
     */
    removeComponents(componentIDs) {
        componentIDs = componentIDs || this.getComponentBitfield().toValues();

        return componentIDs.reduce((result, id) => {
            const com = this.components[id];
            if (com) {
                this.removeComponent(com);
                result.push(com);
            }
            return result;
        }, []);
    }

    /**
     * Returns a component by its id
     * @param {*} componentIID
     */
    getComponentByIID(componentIID:(string|number)) : Component {
        let defID = this.getRegistry().getIID(componentIID);
        return this.components[<number>defID];
    }

    /**
     * 
     */
    getComponentsByIID( componentIIDs:(Array<string>|Array<number>) ) : Array<Component> {
        let defID = this.getRegistry().getIID(componentIIDs);
        let iidArray = <Array<number>>defID;
        return iidArray.map(id => this.components[id]);
    }

    /**
     *
     * @param {*} componentIID
     */
    hasComponent(componentIID) {
        if (isComponent(componentIID)) {
            componentIID = componentIID.getDefID();
        } else if (isString(componentIID)) {
            componentIID = this.getRegistry().getIID(componentIID);
        }
        return this.getComponentBitfield().get(componentIID);
    }

    /**
     *
     */
    hasComponents() {
        return Object.keys(this.components).length > 0;
    }

    /**
     *
     */
    getComponentBitfield():BitField {
        // let bf = this._bf;
        // if (bf === undefined) {
        //     // TODO: the size must be configured from somewhere - otherwise will run out of space
        //     bf = BitField.create();
        //     this.set('comBf', bf);
        // }
        return this._bf;
    }

    /**
     *   The number of components on this entity
     */
    getComponentCount() {
        return Object.keys(this.components).length;
        // return this.getComponentBitfield().count();
    }

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
    }

    /**
     *   Reacts to events triggered by contained components
     */
    _onComponentEvent(event, component, options) {
        if (event === 'destroy') {
            this.removeComponent(component);
        }
        if (event === 'update') {
            event = EntityEvent.ComponentUpdate;
            this.trigger(event, component, options);
        }
    }

    clone( options:CloneOptions = {}) {
        let result = Entity.create( this.getEntityID() );

        // let result = Entity.create({
        //     [ENTITY_ID]: this.getEntityID(),
        //     [ENTITY_SET_ID]: this.getEntitySetID(),
        //     registry: this.getRegistry(),
        //     ...options
        // });
    
        return result;
    }

    
}


export interface CloneOptions extends EntityOptions {
    
    // remove components from dstEntity which are not present on the srcEntity
    delete?:boolean;

    returnChanged?:boolean;

    full?:boolean,

    debug?:boolean
}


/**
 * 
 * @param {*} srcEntity 
 * @param {*} dstEntity 
 * @param {*} options 
 */
export function cloneEntity(srcEntity:Entity, dstEntity?:Entity, options:CloneOptions = {}) : Entity | [Entity,boolean] {
    // const registry = srcEntity.getRegistry();
    let ii, len, component, srcComponent;
    const deleteMissing = options.delete;
    const returnChanged = options.returnChanged;
    const fullCopy = options.full;
    const debug = !!options.debug;
    let dstHasChanged = false;

    if (!srcEntity) {
        return returnChanged ? [null, false] : null;
    }

    if (!dstEntity) {
        dstEntity = srcEntity.clone();
    }

    if (!dstEntity && !fullCopy) {
        return dstEntity;
    }

    if (deleteMissing) {
        // removes components from dstEntity which are not present on the srcEntity

        const srcBitfield:BitField = srcEntity.getComponentBitfield();
        const dstBitfield:BitField = dstEntity.getComponentBitfield();
        const removeDefIDs = arrayDifference( <number[]>dstBitfield.toJSON(), <number[]>srcBitfield.toJSON() );

        // if( debug ) console.log('[cloneEntity]', 'removeDefIDs', removeDefIDs, dstBitfield.toJSON(), srcBitfield.toJSON() );

        for (ii = 0, len = removeDefIDs.length; ii < len; ii++) {
            dstEntity.removeComponent(dstEntity.components[ removeDefIDs[ii] ]);
            dstHasChanged = true;
        }
    }

    const srcComponents = srcEntity.getComponents();

    for (ii = 0, len = srcComponents.length; ii < len; ii++) {
        srcComponent = srcComponents[ii];
        component = dstEntity.components[srcComponent.getDefID()];

        // if( debug ) console.log('[cloneEntity]', srcComponent.toJSON(), component.toJSON(), srcComponent.hash(),component.hash() );
        if (component) {
            // the dst entity already has this component
            if (srcComponent.hash() == component.hash()) {
                continue;
            }
        }

        dstHasChanged = true;
        const cloned = cloneComponent(srcComponent);
        // if( debug ) console.log('[cloneEntity]', 'add comp', cloned.toJSON() );
        dstEntity.addComponent( cloned, {debug:true} );
        // if( debug ) console.log('[cloneEntity]', 'dst', dstEntity.toJSON() );
    }

    return returnChanged ? [dstEntity, dstHasChanged] : dstEntity;
}

