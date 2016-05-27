/* @flow */

import _ from 'underscore';
import Backbone from 'backbone';
// import Jsonpointer from 'jsonpointer';

import Component from '../component';
import * as Utils from '../util'
// import SchemaProperties from './properties';


type T = number;

type ComponentDefObjectType = {uri: string; name?: string, hash?: string, properties?:Object };
type ComponentDefArrayType = Array<ComponentDefType>;
type ComponentDefType = ComponentDefArrayType | ComponentDefObjectType;

type SchemaObjectType = Object;


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
    register( def:ComponentDefType, options:Object={} ): Object|null {
        let throwOnExists = _.isUndefined(options.throwOnExists) ? true : options.throwOnExists;
        
        if( _.isArray(def) ){
            return _.each( def, d => this.register(d,options) );
        }
        
        if( !_.isObject(def) || !def.uri ){
            // console.log('def',def);
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
        if( !def.name ){
            def.name = ComponentRegistry.componentNameFromUri( def.uri );
        }

        def.attrs = this._createAttrsFromProperties( def.properties );

        let schema = new Backbone.Model( _.extend({},def,{id,hash}) );
        

        this._definitions.add( schema );
        
        this.trigger('schema:add', schema.get('uri'), schema.get('hash'), schema );
        
        return schema;
    }
    
    _createAttrsFromProperties( props ){
        let name, property, value;
        let result = {};
        if( !props ){
            return result;
        }

        for( name in props ){
            value = props[name];
            property = value;
            if( _.isObject(value) ){
                if( !_.isUndefined(value.default) ){
                    value = property.default;
                }
                else if( !_.isUndefined(value.type) ){
                    switch( value.type ){
                        case 'integer': value = 0; break;
                        case 'string': value = ''; break;
                        case 'boolean': value = false; break;
                        default: value = null; break;
                    }
                }
            }
            result[name] = value;
        }

        return result;
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

    static componentNameFromUri( schemaUri:string, suffix:string='' ){
        let name;
        // let schema = this.getSchema( schemaUri );

        // if( !schema ){
        //     throw new Error('unknown schema ' + schemaUri );
        // }

        // if( schema.obj.name ){
        //     name = schema.obj.name;
        // } else {
            name = schemaUri;
            name = name.split('/').pop();
        // }

        return Utils.toPascalCase( name + suffix );
    }
    
    
    createComponent( schemaUri, attrs, options={}, cb ){
        let throwOnNotFound = _.isUndefined(options.throwOnNotFound) ? true : options.throwOnNotFound;
        if( cb ){
            throwOnNotFound = false;
        }
        let schema = this.getSchema( schemaUri, {throwOnNotFound} );

        if( !schema && cb ){
            return cb('could not find schema ' + schemaUri);
        }

        // we create with attrs from the schema, not properties -
        // since the properties describe how the attrs should be set

        attrs = _.extend( {}, schema.get('attrs'), attrs );
        // if( attrs ){
        //     result.set( result.parse(attrs) );
        // }

        let result = Component.create( attrs, {parse:true} );
        
        result._schemaUri = schema.get('uri');
        result.name = result._schemaName = schema.get('name');
        result._schemaHash = schema.get('hash');
        result.setSchemaId( schema.id );
        
        this.trigger('component:create', result.schemaUri, result );
        
        
        if( cb ){ return cb( null, result ); }
        return result;
    }
    
    getIId( schemaIdentifiers, options={throwOnNotFound:true} ): Object|null|uint32 {
        options.returnIds = true;
        // schemaIdentifiers.push({ throwOnNotFound:true, returnIds:true });
        return this.getSchema( schemaIdentifiers, options );
    }
    
    
    /**
     * 
     */
    getSchema( schemaIdentifiers:string|SchemaObjectType, options:Object={} ): Object|null|uint32 {
        let ii=0, len=0, schema, ident;
        let forceArray = _.isUndefined(options.forceArray) ? false : options.forceArray;
        let returnIds = _.isUndefined(options.returnIds) ? false : options.returnIds;
        let throwOnNotFound = _.isUndefined(options.throwOnNotFound) ? false : options.throwOnNotFound;
        let result;
        
        schemaIdentifiers = _.isArray(schemaIdentifiers) ? schemaIdentifiers : [schemaIdentifiers];
        
        for ( ii=0,len=schemaIdentifiers.length;ii<len;ii++ ){
            ident = schemaIdentifiers[ii];
            
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