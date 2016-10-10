/* @flow */

import _ from 'underscore';
import {Collection,Events,Model as BackboneModel} from 'odgn-backbone-model';
// import Jsonpointer from 'jsonpointer';

import Component from '../component';
import * as Utils from '../util'

import ComponentDef from '../component_def';

type T = number;

type ComponentDefRawObjectType = {uri: string; name?: string, hash?: string, properties?:Object };
type ComponentDefRawArrayType = Array<ComponentDefRawObjectType>;
type ComponentDefRawType = ComponentDefRawArrayType | ComponentDefRawObjectType;
type ComponentDefType = Object; // TODO: replace with proper backbone model
type ComponentDefIdentifierType = string | string[] | uint32 | ComponentDefRawType | ComponentDefType;


export const ComponentDefCollection = Collection.extend({
    model: ComponentDef,

    getByHash: function(hash:string){
        return this.find( cdef => cdef.hash() == hash );
    },

    getByUri: function(uri:string){
        return this.find( cdef => cdef.getUri() == uri );
    }

});



export default class ComponentRegistry {
    constructor( definitions, options={} ){
        _.extend(this, Events);
        this.registry = options.registry;
        this._componentIndex = 1;
        this._componentDefs = new ComponentDefCollection();
        this._componentTypes = {};
        if( definitions ){
            _.each( definitions, def => this.register(def) );
        }
    }

    toJSON(options={}){
        return this._componentDefs.reduce( (result,def) =>{
            if( options.expanded){
                result[def.id] = def;
            } else {
                result[def.id] = def.getUri();
            }
            return result;
        },[]);
    }

    /**
    * Returns the registered component defs as an array of def ids
    * to def uris
    */
    getComponentDefUris(){
        return this._componentDefs.reduce( (result,def) =>{
            result[def.id] = def.getUri();
            return result;
        },[]);    
    }
    
    /**
     * Adds a component definition to the registry
     */
    register( def:ComponentDefRawType|ComponentDefType, options:Object={} ): Object|null {
        let throwOnExists = _.isUndefined(options.throwOnExists) ? true : options.throwOnExists;
        
        if( _.isArray(def) ){
            return _.map( def, d => this.register(d,options) );
        }

        if( Component.isComponent(def) ){
            const defOptions = {registering:true, registry:this.registry};
            let inst = new def(null,defOptions);
            if( inst.properties ){
                def.properties = inst.properties;
            }
            this._componentTypes[ inst.type ] = def;
            // console.log('Component has properties', inst.properties);
            this.trigger('type:add', inst.type, def);
            return def;
        }
        
        if( !_.isObject(def) || !def.uri ){
            // console.log('def',def);
            throw new Error('invalid component def: ' + JSON.stringify(def) );
        }
        
        let existing = this.getComponentDef( def );
        
        if( existing ){
            // console.log('yep got back ', existing);
            if( throwOnExists ){
                throw new Error('def ' + existing.uri + ' (' + existing.hash + ') already exists' );
            } else {
                return null;
            }
        }

        let type = def['type'];

        if( type ){
            let ComponentType = this._componentTypes[type];
            // ensure we have this type registered
            if( !ComponentType ){
                if( throwOnExists ){
                    throw new Error('could not find type ' + type + ' for def ' + def['uri'] );
                } else {
                    return null;
                }
            }

            if( ComponentType.properties ){
                def = Utils.deepExtend( {}, {properties:ComponentType.properties}, def );
            }
        }
        
        // let hash = def.hash();// ComponentRegistry.hashSchema( def );
        // do we have this def already?
        
        let id = this._componentIndex++;
        
        // def.attrs = this._createAttrsFromProperties( def.properties );

        // console.log('creating with', def);
        let componentDef = ComponentDef.create( _.extend({},def,{id}) );
        
        this._componentDefs.add( componentDef );
        
        this.trigger('def:add', componentDef.get('uri'), componentDef.hash(), componentDef );

        // console.log('def:add', componentDef.get('uri'), componentDef.hash() );
        
        return componentDef;
    }
    

    

    /**
     * Removes a definition from the registry
     */
    unregister( def ){
        let componentDef = this.getComponentDef( def );
        if( !componentDef ){
            return null;
        }
        
        this._componentDefs.remove( componentDef.id );
        
        this.trigger('def:remove', componentDef.get('uri'), componentDef.hash(), componentDef );
        
        return componentDef;
    }

    getAll(){
        return this._componentDefs.models;//.toJSON();
    }
    
    /**
     * 
     */
    // static hashSchema(def){
    //     if( !def ){ return '' };
    //     return def.hash || Utils.hash(JSON.stringify(def.properties) + ":" + def.Name, true );
    // }

    
    
    
    createComponent( defUri, attrs, options={}, cb ){
        let throwOnNotFound = _.isUndefined(options.throwOnNotFound) ? true : options.throwOnNotFound;
        if( cb ){
            throwOnNotFound = false;
        }

        let def = this.getComponentDef( defUri, {throwOnNotFound} );

        if( !def && cb ){
            return cb('could not find componentDef ' + defUri);
        }

        let ComponentType = Component;
        let type = def.get('type');
        // console.log('createComponent...', def.get('type') );
        if( type ){
            // console.log('could not find component type ' + type );
            ComponentType = this._componentTypes[type];
            if( !ComponentType ){
                return cb('could not find component type ' + type );
            }

            // if( ComponentType.properties ){

            // }
            // console.log('create type', attrs);
        }

        // we create with attrs from the def, not properties -
        // since the properties describe how the attrs should be set

        attrs = _.extend( {}, def.getAttrs(), attrs );
        // NOTE: no longer neccesary to pass parse:true as the component constructor calls component.parse
        const createOptions = _.extend( {}, def.get('options'), {registry:this.registry});
        let result = new ComponentType( attrs, createOptions );

        if( type ){
            result['is'+type] = true;
        }
        
        result.setDefDetails( def.id, def.getUri(), def.hash(), def.getName() );
        
        this.trigger('component:create', result.defUri, result );
        
        // console.log('result:', result);
        if( cb ){ return cb( null, result ); }
        return result;
    }
    
    getIId( defIdentifiers, options={throwOnNotFound:true} ): Object|null|uint32 {
        options.returnIds = true;
        // defIdentifiers.push({ throwOnNotFound:true, returnIds:true });
        return this.getComponentDef( defIdentifiers, options );
    }
    
    
    /**
     * 
     */
    getComponentDef( identifiers:ComponentDefIdentifierType, options:Object={} ): Object|null|uint32 {
        let ii=0, len=0, cDef, ident;
        let forceArray = _.isUndefined(options.forceArray) ? false : options.forceArray;
        let returnIds = _.isUndefined(options.returnIds) ? false : options.returnIds;
        let throwOnNotFound = _.isUndefined(options.throwOnNotFound) ? false : options.throwOnNotFound;
        let result;
        
        identifiers = _.isArray(identifiers) ? identifiers : [identifiers];
        
        for ( ii=0,len=identifiers.length;ii<len;ii++ ){
            ident = identifiers[ii];
            
            if(_.isObject(ident) ){
                ident = ident.id || ident.hash;
            }
            
            if( !ident ){
                continue;
            }
            
            cDef = this._componentDefs.get(ident);
            
            if( !cDef ){
                cDef = this._componentDefs.getByHash(ident);
            }
            
            if( !cDef ){
                cDef = this._componentDefs.findWhere({uri:ident});
            }
            
            if( !cDef ){
                cDef = this._componentDefs.findWhere({name:ident});
            }
            
            if( !cDef ){
                // console.log('RARR', ident, throwOnNotFound);
                if( throwOnNotFound ){
                    throw new Error('could not find componentDef ' + ident );
                }
                if( len === 1 && !forceArray ){ return null; }
                return null;
            }
            
            if( len === 1 && !forceArray ){
                if( returnIds ){
                    return cDef.id;
                }
                return cDef;
            }
            
            if( !result ){ result = [] };
            result.push( returnIds ? cDef.id : cDef );
        }
        
        if( !result || (result.length === 0 && !forceArray) ){
            return undefined;
        }
        
        return result;
    }
    
    static create( definitions, options={} ){
        let result = new ComponentRegistry(definitions, options);
        
        return result;
    }
}