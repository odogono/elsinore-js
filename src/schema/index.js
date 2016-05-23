import _ from 'underscore';
import Backbone from 'backbone';
// import Jsonpointer from 'jsonpointer';

import Component from '../component';
import * as Utils from '../util'
// import SchemaProperties from './properties';



export default class ComponentRegistry {
    constructor( definitions ){
        _.extend(this, Backbone.Events);
        this._componentIndex = 1;
        this._definitions = new Backbone.Collection();
        if( definitions ){
            _.each( definitions, def => this.register(def) );
        }
    }
    
    /**
     * Adds a component schema definition to the registry
     */
    register( def, options={} ){
        let throwOnExists = _.isUndefined(options.throwOnExists) ? true : options.throwOnExists;
        
        if( _.isArray(def) ){
            return _.each( def, d => this.register(d,options) );
        }
        
        // console.log('registering', def);
        
        if( !_.isObject(def) || !def.uri ){
            throw new Error('invalid component schema: ' + JSON.stringify(def) );
        }
        
        let existing = this.getSchema( def );
        
        if( existing ){
            // console.log('yep got back ', existing);
            if( throwOnExists ){
                throw new Error('schema ' + existing.uri + ' (' + existing.hash + ') already exists' );
            } else {
                return null;
            }
        }
        
        let hash = ComponentRegistry.hashSchema( def );
        // do we have this def already?
        
        let id = this._componentIndex++;
        let schema = new Backbone.Model( _.extend({},def,{id,hash}) );
        
        this._definitions.add( schema );
        
        this.trigger('schema:add', schema.get('uri'), schema.get('hash'), schema );
        
        return schema;
    }
    
    /**
     * Removes a schema definition from the registry
     */
    unregister( def ){
        let schema = this.getSchema( def );
        if( !schema ){
            return null;
        }
        
        this._definitions.remove( schema.id );
        
        this.trigger('schema:remove', schema.get('uri'), schema.get('hash'), schema );
        
        return schema;
    }
    
    /**
     * 
     */
    static hashSchema(def){
        if( !def ){ return '' };
        return def.hash || Utils.hash(JSON.stringify(def.properties) + ":" + def.Name, true );
    }
    
    
    createComponent( schemaUri, attrs, options={} ){
        let schema = this.getSchema( schemaUri, {throwOnNotFound:true} );
        // console.log('creating from', schemaUri, schema );
        let result = Component.create( schema.get('properties') );
        
        result.schemaUri = schema.get('uri');
        result.name = schema.get('name');
        result.hash = schema.get('hash');
        
        this.trigger('component:create', result.schemaUri, result );
        
        if( attrs ){
            result.set( attrs );
        }
        
        return result;
    }
    
    getIId( ...schemaIdentifiers ){
        schemaIdentifiers.push({ throwOnNotFound:true, returnIds:true });
        return this.getSchema.apply( this, schemaIdentifiers );
    }
    
    
    /**
     * 
     */
    getSchema( ...schemaIdentifiers ){
        let ii=0, len=0, schema;
        let forceArray = false;
        let returnIds = false;
        let throwOnNotFound = false;
        let result;
        
        let lastItem = schemaIdentifiers[schemaIdentifiers.length-1];
        
        if( _.isObject(lastItem) ){
            ({forceArray,returnIds,throwOnNotFound} = lastItem);
            schemaIdentifiers.pop();
        }
        
        
        for ( ii=0,len=schemaIdentifiers.length;ii<len;ii++ ){
            let ident = schemaIdentifiers[ii];
            
            if(_.isObject(ident) ){
                ident = ident.id || ident.hash;
            }
            
            if( !ident ){
                continue;
            }
            
            schema = this._definitions.get(ident);
            
            if( !schema ){
                schema = this._definitions.findWhere({hash:ident});
            }
            
            if( !schema ){
                schema = this._definitions.findWhere({uri:ident});
            }
            
            if( !schema ){
                schema = this._definitions.findWhere({name:ident});
            }
            
            if( !schema ){
                // console.log('RARR', ident, throwOnNotFound);
                if( throwOnNotFound ){
                    throw new Error('could not find schema ' + ident );
                }
                if( len === 1 && !forceArray ){ return null; }
                return null;
            }
            
            if( len === 1 && !forceArray ){
                if( returnIds ){
                    return schema.id;
                }
                return schema;
            }
            
            if( !result ){ result = [] };
            result.push( returnIds ? schema.id : schema );
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