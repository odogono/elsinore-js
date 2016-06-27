/* @flow */

import _ from 'underscore';
import Backbone from 'backbone';
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



const ComponentDefCollection = Backbone.Collection.extend({
    model: ComponentDef,

    getByHash: function(hash:string){
        return this.find( cdef => cdef.hash() == hash );
    }
});



export default class ComponentRegistry {
    constructor( definitions ){
        _.extend(this, Backbone.Events);
        this._componentIndex = 1;
        this._componentDefs = new ComponentDefCollection();
        if( definitions ){
            _.each( definitions, def => this.register(def) );
        }
    }
    
    /**
     * Adds a component definition to the registry
     */
    register( def:ComponentDefRawType, options:Object={} ): Object|null {
        let throwOnExists = _.isUndefined(options.throwOnExists) ? true : options.throwOnExists;
        
        if( _.isArray(def) ){
            return _.map( def, d => this.register(d,options) );
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
        
        // let hash = def.hash();// ComponentRegistry.hashSchema( def );
        // do we have this def already?
        
        let id = this._componentIndex++;
        
        // def.attrs = this._createAttrsFromProperties( def.properties );

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
        return this._componentDefs.toJSON();
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

        // we create with attrs from the def, not properties -
        // since the properties describe how the attrs should be set

        attrs = _.extend( {}, def.getAttrs(), attrs );
        let result = Component.create( attrs, {parse:true} );
        
        result.setDefDetails( def.id, def.getUri(), def.hash(), def.getName() );
        
        this.trigger('component:create', result.defUri, result );
        
        
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
    
    static create( definitions ){
        let result = new ComponentRegistry(definitions);
        
        return result;
    }
}