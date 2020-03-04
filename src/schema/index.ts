import { Base, BaseOptions } from '../base';
import { COMPONENT_DEF_ID, EntityEvent } from '../types';
import { isComponent, isObject } from '../util/is';

import { Collection } from '../util/collection';
import { Component } from '../component';
import { ComponentDef } from '../component_def';
import { Events } from '../util/events';
import { Registry } from '../registry';
import { createLog } from '../util/log';
import { propertyResult } from '../util/result';
import { stringify } from '../util/stringify';

const Log = createLog('ComponentRegistry');



export type ComponentDefSearch = (Array<number> | number | Array<ComponentDef> | ComponentDef);

export type ComponentDefIDs = (string|number|Array<string>|Array<number>);

export interface ComponentRegistryOptions extends BaseOptions {

}


interface GetComponentDefOptions {
    // if true, any non null results will be returned in an array
    forceArray?:boolean;

    // // return only IDs not instances
    // returnIDs?:boolean;

    // if a componentDef is not found, throw an error
    throwOnNotFound?:boolean;
}

/**
 * 
 * @param {*} models 
 * @param {*} options 
 */
export class ComponentDefCollection extends Collection<ComponentDef> {

    model = ComponentDef;

    constructor(models?, options={}){
        super(models,options);
        // Collection.prototype.initialize.call(this, models, options );
    }

    getByHash(hash:number) : ComponentDef {
        return <ComponentDef>this.find(cdef => cdef.hash() == hash);
    }

    getByUri(uri:string) : ComponentDef {
        return <ComponentDef>this.find(cdef => cdef.getUri() == uri);
    }
}


// ComponentDefCollection.prototype.model = ComponentDef;



/**
 * 
 * @param {*} definitions 
 * @param {*} options 
 */
export class ComponentRegistry extends Base {

    _componentIndex:number = 1;

    _componentDefs:ComponentDefCollection;

    _componentDefByUri:ComponentDefCollection;

    _componentTypes:object;


    constructor(definitions?, options:ComponentRegistryOptions={}){
        super(options);
        this.initialize( definitions, options );
    }

    initialize(definitions, options:ComponentRegistryOptions = {}) {
        this._componentIndex = 1;
        this._componentDefs = new ComponentDefCollection();
        this._componentDefByUri = new ComponentDefCollection(null, { idAttribute: 'uri' });
        this._componentTypes = {};
        if (definitions) {
            definitions.forEach(def => this.register(def));
        }
    }

    toJSON(options:any = {}) {
        return this._componentDefs.reduce((result, def) => {
            if (options.expanded) {
                result[def.id] = def;
            } else {
                result[def.id] = def.getUri();
            }
            return result;
        }, []);
    }

    /**
     * Returns the registered component defs as an array of def ids
     * to def uris
     */
    getComponentDefUris() : Map<number,string> {
        return this._componentDefs.models.reduce((result, def) => {
            result[def.id] = def.getUri();
            return result;
        }, new Map<number,string>() );
    }

    /**
     * Adds a component definition to the registry
     *
     * @param {*} def
     * @param {*} options
     */
    register(def, options:any = {}) {
        let componentDef;
        let throwOnExists = options.throwOnExists === void 0 ? true : options.throwOnExists;

        if (def.isComponentDef) {
            componentDef = def;
        } else if (Array.isArray(def)) {
            return def.map(d => this.register(d, options));
        } else if ( def.prototype && def.prototype.isComponent === true ){ // isComponent(def)) {
            const defOptions = { registering: true, registry: this.getRegistry() };
            let inst = new def(null, defOptions);
            const properties = propertyResult(inst, 'properties');
            if (properties) {
                def.properties = properties;
            }
            const type = propertyResult(inst, 'type');
            this._componentTypes[type] = def;
            this.trigger(EntityEvent.ComponentAdd, type, def);

            const uri = propertyResult(inst, 'uri');
            if (uri) {
                this.register({ uri, type });
            }

            return def;
        } else if (!isObject(def) || !def.uri) {
            Log.error('def', typeof def, def);
            throw new Error('invalid component def: ' + stringify(def));
        } else {
            // Log.info('register', def, Object.keys(options), throwOnExists );
            componentDef = new ComponentDef({ ...def });
        }

        const existing = <ComponentDef>this.getComponentDef(componentDef.hash());

        if (existing) {
            if (throwOnExists) {
                // Log.debug('existing', JSON.stringify(existing));
                // Log.debug('incoming', JSON.stringify(def));
                // Log.debug( this._componentDefByUri.toJSON() );
                throw new Error('def ' + existing.getUri() + ' (' + existing.hash() + ') already exists');
            }
            return existing;
        }

        componentDef.id = this._componentIndex++;

        const type = componentDef.getType();

        if (type) {
            let ComponentType = this._componentTypes[type] || Component;

            // ensure we have this type registered
            if (!ComponentType) {
                if (throwOnExists) {
                    throw new Error(`could not find type ${type} for def ${componentDef.getUri()}`);
                } else {
                    return null;
                }
            }

            // if (ComponentType.properties) {
            def.properties = { ...ComponentType.properties, ...def.properties };

            componentDef = new ComponentDef({ ...def, id: componentDef.id });
            // }
        }

        // if( !componentDef.getUri() ){
        //     throw new Error(`invalid component def`);
        // }
        this._componentDefs.add(componentDef);

        this._componentDefByUri.remove(componentDef.getUri());
        this._componentDefByUri.add(componentDef);

        this.trigger(EntityEvent.ComponentDefAdd, componentDef.getUri(), componentDef.hash(), componentDef);

        return componentDef;
    }

    /**
     * Removes a definition from the registry
     *
     * @param {*} def
     */
    unregister(def) {
        let componentDef = <ComponentDef>this.getComponentDef(def);
        if (!componentDef) {
            return null;
        }

        let removed = this._componentDefByUri.remove(componentDef.getUri(), true);

        this._componentDefs.remove(componentDef.id);

        this.trigger(EntityEvent.ComponentDefRemove, componentDef.getUri(), componentDef.hash(), componentDef);

        return componentDef;
    }

    /**
     * Returns an array of the registered componentdefs
     *
     * @param {*} options
     */
    getComponentDefs(options:{all?:boolean} = {}) {
        if (options.all) {
            return this._componentDefs.models;
        }
        return this._componentDefByUri.models;
    }

    /**
     * Creates a new component instance
     *
     * @param {*} defUri
     * @param {*} attrs
     * @param {*} options
     * @param {*} cb
     */
    createComponent(defUri:string|number, attrs?, options:{throwOnNotFound?:boolean} = {}) {
        let throwOnNotFound = options.throwOnNotFound === undefined ? true : options.throwOnNotFound;
        
        let def = <ComponentDef>this.getComponentDef(defUri, { throwOnNotFound });

        if (!def) {
            // if (cb) {
            //     return cb('could not find componentDef ' + defUri);
            // }
            return null;
        }

        const type = def.getType();
        let ComponentType = type ? this._componentTypes[type] : Component;

        //

        if (attrs === undefined && isObject(defUri)) {
            attrs = defUri;
        }

        // we create with attrs from the def, not properties -
        // since the properties describe how the attrs should be set
        const defAttrs = def.getAttrs();
        // console.log('[Schema][createComponent]', defAttrs );
        attrs = { ...defAttrs, ...attrs };

        // NOTE: no longer neccesary to pass parse:true as the component constructor calls component.parse
        const defOptions = def.options || {};
        const createOptions = { ...defOptions, registry: this.getRegistry() };
        let result = new ComponentType(attrs, createOptions);

        if (type) {
            result['is' + type] = true;
        }

        result.setDefDetails(def.id, def.getUri(), def.hash(), def.getName());

        this.trigger(EntityEvent.ComponentCreate, result.defUri, result);

        // console.log('result:', result);
        // if (cb) {
        //     return cb(null, result);
        // }
        return result;
    }

    /**
     * Returns Def IDs of the given component defs
     * Most commonly used for converting string uris into number ids
     */
    getIID(defIDentifiers:ComponentDefIDs, options:GetComponentDefOptions = { throwOnNotFound: true }) : number| Array<number> {
        return this.getComponentDefIDs(defIDentifiers, options);
    }

    
    /**
     *
     */
    getComponentDef(identifiers:ComponentDefIDs, options:GetComponentDefOptions = {}) : Array<ComponentDef> | ComponentDef {
        let ii = 0,
            len = 0,
            cDef,
            ident;
        // const debug = options.debug === void 0 ? false : options.debug;
        const forceArray = options.forceArray === void 0 ? false : options.forceArray;
        // const returnIDs = options.returnIDs === void 0 ? false : options.returnIDs;
        const throwOnNotFound = options.throwOnNotFound === void 0 ? false : options.throwOnNotFound;
        let result;

        let identifiersArray:[] = <[]>(Array.isArray(identifiers) ? identifiers : [identifiers]);

        for (ii = 0, len = identifiersArray.length; ii < len; ii++) {
            ident = identifiersArray[ii];

            if (isObject(ident)) {
                ident = ident.id || ident.hash || ident.uri || ident[COMPONENT_DEF_ID];
            }

            if (!ident) {
                continue;
            }

            cDef = this._componentDefByUri.get(ident);

            if (!cDef) {
                cDef = this._componentDefs.get(ident);
            }

            if (!cDef) {
                cDef = this._componentDefs.getByHash(ident);
            }

            if (!cDef) {
                cDef = this._componentDefs.findWhere({ uri: ident });
            }

            if (!cDef) {
                cDef = this._componentDefs.findWhere({ name: ident });
            }

            if (!cDef) {
                if (throwOnNotFound) {
                    throw new Error(`could not find componentDef '${ident}'`);
                }
                if (len === 1 && !forceArray) {
                    return null;
                }
                return null;
            }

            if (len === 1 && !forceArray) {
                // if (returnIDs) {
                //     return cDef.id;
                // }
                return cDef;
            }

            if (!result) {
                result = [];
            }

            result.push(cDef);
        }

        if (!result || (result.length === 0 && !forceArray)) {
            return undefined;
        }

        return result;
    }

    getComponentDefIDs(identifiers:ComponentDefIDs, options:GetComponentDefOptions = {}) : number| Array<number> {
        let result = this.getComponentDef( identifiers, options );

        if( Array.isArray(result) ){
            return result.map( c => c.id );
        }

        return result.id;
    }

    
}

// ComponentRegistry.create = function(definitions, options = {}) {
//     let result = new ComponentRegistry(definitions, options);

//     return result;
// }
