/* @flow */
import { Collection, Events } from 'odgn-backbone-model';

import Component from '../component';
import { isObject, result, stringify } from '../util';
import { createLog } from '../util/log';

import ComponentDef from '../component_def';

// type T = number;
type ComponentDefRawObjectType = { uri: string, name?: string, hash?: string, properties?: Object };
type ComponentDefRawArrayType = Array<ComponentDefRawObjectType>;
type ComponentDefRawType = ComponentDefRawArrayType | ComponentDefRawObjectType;
type ComponentDefType = Object;
// TODO: replace with proper backbone model
type ComponentDefIdentifierType = string | string[] | uint32 | ComponentDefRawType | ComponentDefType;

const Log = createLog('ComponentRegistry', false);

/**
 * 
 */
// export const ComponentDefCollection = Collection.extend({
//     model: ComponentDef,
//     getByHash: function(hash:string){
//         return this.find( cdef => cdef.hash() == hash );
//     },
//     getByUri: function(uri:string){
//         return this.find( cdef => cdef.getUri() == uri );
//     }
// });
export class ComponentDefCollection extends Collection {
    getByHash(hash: string) {
        return this.find(cdef => cdef.hash() == hash);
    }

    getByUri(uri: string) {
        return this.find(cdef => cdef.getUri() == uri);
    }
}
ComponentDefCollection.prototype.model = ComponentDef;

class ComponentDefUriCollection extends ComponentDefCollection {
    modelId(attrs) {
        return attrs.uri;
    }
}

/**
 * 
 */
export default class ComponentRegistry {
    constructor(definitions, options = {}) {
        Object.assign(this, Events);
        this.registry = options.registry;
        this._componentIndex = 1;
        this._componentDefs = new ComponentDefCollection();
        this._componentDefByUri = new ComponentDefUriCollection();
        this._componentTypes = {};
        if (definitions) {
            definitions.forEach(def => this.register(def));
        }
    }

    toJSON(options = {}) {
        return this._componentDefs.reduce(
            (result, def) => {
                if (options.expanded) {
                    result[def.id] = def;
                } else {
                    result[def.id] = def.getUri();
                }
                return result;
            },
            [],
        );
    }

    /**
    * Returns the registered component defs as an array of def ids
    * to def uris
    */
    getComponentDefUris() {
        return this._componentDefs.reduce(
            (result, def) => {
                result[def.id] = def.getUri();
                return result;
            },
            [],
        );
    }

    /**
     * Adds a component definition to the registry
     */
    register(def: ComponentDefRawType | ComponentDefType, options: Object = {}): Object | null {
        let componentDef;
        let throwOnExists = options.throwOnExists === void 0 ? true : options.throwOnExists;

        if (def.isComponentDef) {
            componentDef = def;
        } else if (Array.isArray(def)) {
            return def.map(d => this.register(d, options));
        } else if (Component.isComponent(def)) {
            const defOptions = { registering: true, registry: this.registry };
            let inst = new def(null, defOptions);
            const properties = result(inst, 'properties');
            if (properties) {
                def.properties = properties;
            }
            const type = result(inst, 'type');
            this._componentTypes[type] = def;
            this.trigger('type:add', type, def);

            const uri = result(inst, 'uri');
            if (uri) {
                this.register({ uri, type });
            }

            return def;
        } else if (!isObject(def) || !def.uri) {
            Log.error('def', def);
            throw new Error('invalid component def: ' + stringify(def));
        } else {
            // Log.info('register', def, Object.keys(options), throwOnExists );
            componentDef = new ComponentDef({ ...def });
        }

        const existing = this.getComponentDef(componentDef.hash());

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

        const type = componentDef.get('type');

        if (type) {
            let ComponentType = this._componentTypes[type];
            // ensure we have this type registered
            if (!ComponentType) {
                if (throwOnExists) {
                    throw new Error(`could not find type ${type} for def ${componentDef.getUri()}`);
                } else {
                    return null;
                }
            }

            if (ComponentType.properties) {
                def.properties = { ...ComponentType.properties, ...def.properties };
                componentDef = new ComponentDef({ ...def, id: componentDef.id });
            }
        }

        // if( !componentDef.getUri() ){
        //     throw new Error(`invalid component def`);
        // }
        this._componentDefs.add(componentDef);

        this._componentDefByUri.remove(componentDef.getUri());
        this._componentDefByUri.add(componentDef);

        this.trigger('def:add', componentDef.get('uri'), componentDef.hash(), componentDef);

        // console.log('def:add', componentDef.get('uri'), componentDef.hash() );
        return componentDef;
    }

    /**
     * Removes a definition from the registry
     */
    unregister(def) {
        let componentDef = this.getComponentDef(def);
        if (!componentDef) {
            return null;
        }

        this._componentDefByUri.remove(componentDef.getUri());
        this._componentDefs.remove(componentDef.id);

        this.trigger('def:remove', componentDef.get('uri'), componentDef.hash(), componentDef);

        return componentDef;
    }

    /**
     * Returns an array of the registered componentdefs
     */
    getComponentDefs(options = {}) {
        if (options.all) {
            return this._componentDefs.models;
        }
        return this._componentDefByUri.models;
    }

    /**
     * Creates a new component instance
     */
    createComponent(defUri, attrs, options = {}, cb) {
        let throwOnNotFound = options.throwOnNotFound === void 0 ? true : options.throwOnNotFound;
        if (cb) {
            throwOnNotFound = false;
        }
        // Log.debug('createComponent', defUri, attrs, options);
        let def = this.getComponentDef(defUri, { throwOnNotFound });

        if (!def) {
            if (cb) {
                return cb('could not find componentDef ' + defUri);
            }
            return null;
        }

        const type = def.get('type');
        let ComponentType = type ? this._componentTypes[type] : Component;

        if (attrs === void 0 && isObject(defUri)) {
            attrs = defUri;
        }

        // we create with attrs from the def, not properties -
        // since the properties describe how the attrs should be set
        const defAttrs = def.getAttrs();
        attrs = { ...defAttrs, ...attrs };

        // NOTE: no longer neccesary to pass parse:true as the component constructor calls component.parse
        const defOptions = def.get('options') || {};
        const createOptions = { ...defOptions, registry: this.registry };
        let result = new ComponentType(attrs, createOptions);

        if (type) {
            result['is' + type] = true;
        }

        result.setDefDetails(def.id, def.getUri(), def.hash(), def.getName());

        this.trigger('component:create', result.defUri, result);

        // console.log('result:', result);
        if (cb) {
            return cb(null, result);
        }
        return result;
    }

    getIId(defIdentifiers, options = { throwOnNotFound: true }): Object | null | uint32 {
        options.returnIds = true;
        // defIdentifiers.push({ throwOnNotFound:true, returnIds:true });
        return this.getComponentDef(defIdentifiers, options);
    }

    /**
     * 
     */
    getComponentDef(identifiers: ComponentDefIdentifierType, options: Object = {}): Object | null | uint32 {
        let ii = 0, len = 0, cDef, ident;
        // const debug = options.debug === void 0 ? false : options.debug;
        const forceArray = options.forceArray === void 0 ? false : options.forceArray;
        const returnIds = options.returnIds === void 0 ? false : options.returnIds;
        const throwOnNotFound = options.throwOnNotFound === void 0 ? false : options.throwOnNotFound;
        let result;

        identifiers = Array.isArray(identifiers) ? identifiers : [ identifiers ];

        for (ii = 0, len = identifiers.length; ii < len; ii++) {
            ident = identifiers[ii];

            if (isObject(ident)) {
                ident = ident.id || ident.hash || ident.uri || ident['@s'];
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
                    throw new Error('could not find componentDef ' + ident);
                }
                if (len === 1 && !forceArray) {
                    return null;
                }
                return null;
            }

            if (len === 1 && !forceArray) {
                if (returnIds) {
                    return cDef.id;
                }
                return cDef;
            }

            if (!result) {
                result = [];
            }

            result.push(returnIds ? cDef.id : cDef);
        }

        if (!result || result.length === 0 && !forceArray) {
            return undefined;
        }

        return result;
    }

    static create(definitions, options = {}) {
        let result = new ComponentRegistry(definitions, options);

        return result;
    }
}
