'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import Fs from 'fs';
import Path from 'path';
import Sh from 'shelljs';

import BitField  from 'odgn-bitfield';
import Component from '../component';
import Entity from '../entity';
import EntityFilter from '../entity_filter';
import EntitySet from '../entity_set';
import Query from './query';
import * as Utils from '../util'

import CmdBuffer from '../cmd_buffer/async';

const TEMP_ENTITY_PREFIX = 'te';

let FileSystemEntitySet = EntitySet.extend({
    type: 'FileSystemEntitySet',
    isFileSystemEntitySet: true,
    isAsync: true,

    initialize: function( entities, options ){
        this._cmdBuffer = CmdBuffer.create();
        this._componentCount = 0;
        this._entityCount = 0;
        this._entityArray = [];
        this.length = 0;
        this._path = options.path || '';
    },

    open: function( options ){
        var self = this;
        options = options || {};

        return new Promise( function(resolve,reject){
            var path = self.getPath();

            if( !path ){
                throw new Error('no path specified');
            }
            
            // Sh.mkdir('-p', path);
            return resolve( self );
        }).then( function(){
            return self._readSchemaIndex( options );
        }).then( function(){
            return self;
        })
    },

    close: function(){
        var self = this;
        return Promise.resolve(self);
    },

    size: function( sync ){
        if( sync ){
            return this._readEntityIndex( sync ).length;   
        }
        return this._readEntityIndex()
            .then( function(entityIndex){
                return entityIndex.size();
            });
    },

    getPath: function(){
        return this._path;
    },



    getEntity: function( entity, options ){
        var entityId;
        entityId = Entity.toEntityId(entity);
        return this._readEntityById( entityId );
    },


    /**
    *   Returns the entity at a given index.
    *   the entityset has an order of entities
    */
    at: function(index) {
        var self = this;

        return self._readEntityIndex()
            .then( function(entityIndex){
                var entityId = entityIndex[ index ];
                return self._readEntityById( entityId );
            });
    },

    iterator: function(options){
        var es = this;
        return {
            _nextIndex: 0,
            next: function(){
                var self = this;
                if( !this._entityIndex ){
                    return es._readEntityIndex()
                        .then( function(entityIndex){
                            self._entityIndex = entityIndex;
                            return self.next();
                        }, function(err){
                            return {done:true, err:err};
                        });
                }
                return new Promise( function(resolve, reject){
                    var entityId;
                    if( self._nextIndex < self._entityIndex.length ){
                        entityId = self._entityIndex[self._nextIndex++];
                        return es._readEntityById( entityId )
                            .then( function(e){
                                return resolve( {done:false,value:e} );        
                            });
                    }
                    return reject({done:true});
                });
            }
        };
    },


    query: function( query, options ){
        if( !query ){
            query = Query.root();
        }
        log.debug('fs query ' + JSON.stringify(query) + ' ' + query.hash() );
        return Query.execute( this, query, options );
    },

    // /**
    // *   Selects a number of entities from the entityset
    // */
    // where: function( entityFilter, attrs, options ){
    //     var result = EntitySet.create();
    //     var registry = this.getRegistry();
    //     var filters;
    //     var componentUri;

    //     options || (options={});

    //     result.setRegistry( registry );
    //     result.id = registry.createId();

    //     if( !entityFilter ){
    //     } else if( _.isString(entityFilter) ){
    //         componentUri = registry.getIId( entityFilter );
    //         if( attrs ){
    //             entityFilter = EntityFilter.create( EntityFilter.ATTRIBUTES, componentUri, attrs );
    //         } else {
    //             entityFilter = EntityFilter.create( EntityFilter.ALL, componentUri );
    //         }
    //     }
        
    //     result = FileSystemEntitySet.map( this, entityFilter, result );
        
    //     return result;
    // },

    _readEntityById: function( entityId, options, cb ){
        var self = this;
        var path = this._entityPath( entityId );

        // log.debug('reading entity from ' + path );
        
        return this._readFile( path )
            .then( function(data){
                if( !data ){ throw new Error( 'entity not found: ' + entityId); }
                return self._entityFromData(data);
            })
            // .catch(function(err){
            //     throw new Error( 'entity not found: ' + entityId + ' ' + err );
            // });
    },



    _entityFromData: function( entityData, options, cb ){
        var i,len;
        var data = entityData;
        var result = Entity.create( data.id );
        var self = this;

        // read each of the listed components in turn
        return _.reduce( data._components, function(current,com){
            return current.then(function(){
                com.entityId = result.getEntityId();
                return self._readComponent( com )
                    .then( function(com){
                        result.addComponent( com );
                    });
            });
        }, Promise.resolve() )
            .then( function(com){
                return result;
            })
    },

    _readEntityIndex: function( sync ){
        var self = this;
        var path = this._entityIndexPath();
        // log.debug('_readEntityIndex ' + path );
        return this._readFile( path, true, sync );
    },

    _writeEntityIndex: function( entityIndex, cb ){
        var path = this._entityIndexPath();
        return this._writeFile( path, entityIndex );

        // return new Promise( function(resolve, reject){
        //     var data = JSON.stringify( entityIndex );
        //     var path = self._entityIndexPath();
        //     Sh.mkdir('-p', Path.dirname(path) );

        //     Fs.writeFile( path, data, function(err){
        //         // log.debug('wrote entity index to ' + path + ' ' + err);
        //         if( err ){ return reject(err); }

        //         return resolve(self);
        //     });
        // });
    },

    _addEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        throw new Error('not implemented');
    },


    _removeEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        throw new Error('not implemented');
    },

    _entityIdToEntity: function( entityId ){
        var self = this;

        entityId = parseInt( entityId, 10 );

        if( self._cmdBuffer.isTempId(entityId) ){
            return Promise.resolve( createTempEntity() );
        }
        return self.getEntity( entityId )
            .then( function found(entity){
                return entity;
            }, function notFound(){
                var result = Entity.toEntity( entityId );
                // log.debug('didnt find existing entity ' + entityId + ' so created temp ' + result.getEntityId() + '/' + result.cid );
                return result;
            });
    },

    

    _createEntityId: function(){
        if( !this.entityIndex ){
            this.entityIndex = 1;
        }

        return this.entityIndex++;
    },

    _createComponentId: function(){
        if( !this.componentIndex ){
            this.componentIndex = 1;
        }

        return this.componentIndex++;
    },

    _updateEntities: function( entities ){
        var self = this;
        var savePath = self.getPath();
        var count = 0;
        return _.reduce( entities, function(current,entity){
            return current.then( function(){
                var data;
                var path;

                if( entity.isNew() || entity.isTemp ){
                    entity.set('id', self._createEntityId());
                }

                path = self._entityPath( entity );
                
                if( _.indexOf( self._entityArray, entity.id ) === -1 ){
                    self._entityArray.push( entity.id );
                    self.length = self._entityArray.length;
                }
                
                data = entityToData( entity );
                // log.debug('writing entity to ' + path);
                return self._writeFile( path, data );
            });
        }, Promise.resolve() )
            .then( function(){
                return self._writeEntityIndex( self._entityArray );
            });
    },

    _deleteEntities: function( entities ){
        var self = this;
        var savePath = self.getPath();
// log.debug('_deleteEntities');
        return _.reduce( entities, function(current,entity){
            return current.then( function(){
                return self._deleteComponents( entityComponents(entity) );
            })
            .then( function(){
                var path = self._entityPath( entity );

                var index = _.indexOf( self._entityArray, entity.id );
                if( index !== -1 ){
                    self._entityArray.splice( index, 1);
                    self.length = self._entityArray.length;
                }

                return self._deleteFile( path );
            });

        }, Promise.resolve() )
            .then( function(){
                return self._writeEntityIndex( self._entityArray );
            })
    },

    /**
    *
    */
    _updateComponents: function( components ){
        var self = this;
        var savePath = self.getPath();

        // write each of the components in turn
        return _.reduce( components, function(current,com){
            return current.then(function(){
                return self._writeComponent( com );
            });
        }, Promise.resolve() );
    },

    

    /**
        adding new component devolves into:
            - registering the component schema
                - create a folder for the component schema hash
                - write a schema.json file
                - update the component def index with the new schema
                - use the newly generated def id and assign to the incoming component
            - creating a new entity
                - create a new entity id/index
                - write a new file with the entity json
                - update the entity index file
            - creating a new component
                - generate a new (internal) id for the component
                - write the component JSON to a file named <id>.json within the componentDef folder

    */

    _registerComponentDef: function( component, options ){
        var schema = this._getComponentSchema( component );
        var path = Path.join( this.getPath(), 'com', schema.hash, 'schema.json' );

        // check whether we have already registered
        return new Promise( function(resolve, reject){
            if( Fs.existsSync( path ) ){
                return resolve(true);
            }

            Sh.mkdir( '-p', Path.dirname(path) );

            Fs.writeFile( path, JSON.stringify(schema), function(err){
                if( err ){ return reject(err); }
                return resolve(true); 
            } );
        });
    },

    _writeComponent: function( component, options ){
        var path;
        var self = this;
        var schema = this._getComponentSchema( component );

        return this._isComponentSchemaRegistered( component )
            .then( function(exists){
                if( !exists ){
                    return self._writeComponentSchema( component );
                }
                return true;
            })
            .then( new Promise( function(resolve, reject) {
                var data;
                if( component.isNew() ){
                    log.debug('assigning new id to component');
                    component.set({id: self._createComponentId() });
                }

                path = self._componentPath( component );
                data = component.toJSON();
                data._s = schema.hash;
                data._e = component.getEntityId();
                // log.debug('saving component to ' + path );

                return self._writeFile( path, data )
                    .then(function(){
                        return resolve( component );
                    })
            }));
    },

    _isComponentSchemaRegistered: function( component ){
        var schema = this._getComponentSchema( component );
        var path = this._componentSchemaPath( component );

        return this._pathExists( path );
    },


    /**
    *
    */
    retrieveEntitiesByComponent: function( componentIds, options ){
        var self = this;
        var returnFull;
        options = options || {};

        // for each of the entities referenced, return all of its components
        returnFull = options.full;


        return this._getComponentPaths( componentIds, true )
            .then( function(paths){
                log.debug('full component paths');
                printIns( paths );
            });
    },

    /**
    *   Registers a component schema
    */
    registerComponentDef: function( data ){
        var self = this;
        
        // log.debug('esf> registering ' + JSON.stringify(data) );
        var schema = self.getRegistry().registerComponent( data );

        schema = Utils.deepClone( _.pick(schema, 'uri', 'hash', 'obj') );
        schema.registered_at = Date.now();
        // find next index to insert
        var schemaId = self._schemaById.indexOf( null );
        if( schemaId === -1 ){
            schemaId = self._schemaById.length;
        }

        self._schemaById[schemaId] = schema;
        self._schemaByHash[ schema.hash ] = schemaId;
        self._schemaByUri[ schema.uri ] = schemaId;

        log.debug('esf> registered schema ' + schema.uri + ' ' + schema.hash );
        return self._writeSchemaIndex()
            .then( function(){ return self; });
            
    },

    getComponentDef: function( schemaId ){
        var result;
        if( (result = this._schemaById[schemaId]) ){ return result; }
        if( (result = this._schemaByHash[schemaId]) ){ 
            return this._schemaById[result]; }
        if( (result = this._schemaByUri[schemaId]) ){ 
            return this._schemaById[result]; }
        return null;
    },

    /**
    *   Reads the schema index and populates the in-memory cache
    */
    _readSchemaIndex: function( registerSchemas ){
        var self = this;
        var registry = this.getRegistry();
        return this._readFile( this._schemaIndexPath() )
            .then( function(data){
                if( !data ){
                    return self._initialiseSchemaIndex();
                }
                self._schemaById = data.schemaById;
                self._schemaByHash = data.schemaByHash;
                self._schemaByUri = data.schemaByUri;

                // register incoming schemas
                _.each( self._schemaById, function(schema){
                    if( !schema ){ return; }
                    // printIns( schema );
                    registry.registerComponent( schema );
                });
                return self;
            })
    },

    _writeSchemaIndex: function(){
        var data = {};
        data.schemaById = this._schemaById;
        data.schemaByHash = this._schemaByHash;
        data.schemaByUri = this._schemaByUri;

        return this._writeFile( this._schemaIndexPath(), data );
    },

    _initialiseSchemaIndex: function(){
        this._schemaById = [];
        this._schemaByHash = {};
        this._schemaByUri = {};
        return this._writeSchemaIndex();
    },


    /**
    *   Reads all the currently registered component schemas
    *   into an object and returns it
    */
    // _readComponentSchemas: function(options){
    //     var self = this;
    //     var path = this._componentSchemaPath();
    //     var registry = this.getRegistry();

    //     return this._readDir( path )
    //         .then( function(schemaPaths){
    //             // printIns( schemaPaths );
    //             return _.reduce( schemaPaths, function(current,schemaPath){
    //                 return current.then( function(){
    //                     // log.debug('load schema ' + schemaPath );
    //                     return self._readFile( schemaPath )
    //                         .then( function(data){
    //                             registry.registerComponent( data );
    //                         });
    //                     return true;
    //                 });
    //             }, Promise.resolve() );
    //         })
    //         .then( function(){
    //             return true;
    //         });
    // },

    // _readComponentSchema: function( component ){
    //     var path, self = this;
    //     var schema = this._getComponentSchema( component );

    //     if( !schema ){
    //         throw new Error('no schema found for component ' + JSON.stringify(component) );
    //     }

    //     path = self._componentSchemaPath( component );

    //     return this._pathExists( path )
    //         .then( function(exists){
    //             if( !exists ){
    //                 throw new Error('no schema found for component ' + JSON.stringify(component) );
    //             }
    //             return self._readFile( path );
    //         });
    // },

    // _writeComponentSchema: function( component ){
    //     var self = this;
    //     var path = self._componentSchemaPath( component );
    //     var schema = this._getComponentSchema( component );


    //     if( !schema ){
    //         throw new Error('no schema found for component ' + JSON.stringify(component) );
    //     }

    //     return this._writeFile( path, schema )
    //         .then( function(){
    //             return schema;
    //         });
    // },

    _readComponent: function( component ){//componentId, schemaHash, options ){
        var registry = this.getRegistry();
        var path = this._componentPath( component );
        // var path = Path.join( this.getPath(), 'c', schemaHash  );

        // path = Path.join( path, componentId + '.json'  );

        return this._readFile( path )
            .then( function(data){
                var com = registry.createComponent( data, null, {schemaKey:'_s'} );
                return com;
            })
        
    },

    _readFile: function( path, isJSON, readSync ){
        isJSON = (isJSON === undefined) ? true : isJSON;
        if( readSync ){

            if( !this._pathExists(path, true) ){
                return null;
            }
            var data = Fs.readFileSync( path, {encoding:'utf8'} );
            if( isJSON ){
                data = JSON.parse( data );
            }
            return data;
        }

        return this._pathExists( path )
            .then(function(exists){
                if( !exists ){ return null; } //throw new Error('could not find file ' + path); }
                return new Promise( function(resolve, reject){
                    Fs.readFile( path, {encoding:'utf8'}, function(err,data){
                        if( err ){ return reject( new Error(err) ); }
                        try{
                            data = JSON.parse( data );
                            return resolve( data );
                        } catch( parseError ){
                            throw new Error('error parsing file ' + path + ' ' + parseError );
                        }
                    });
                })
            });
    },

    _pathExists: function( path, isSync ){
        if( isSync ){
            return Fs.existsSync( path );
        }
        return new Promise( function(resolve, reject){
            Fs.exists( path, function(exists){
                return resolve( exists );
            })
        });
    },

    _readDir: function( path ){

        path = _.isArray(path) ? path : [path];

        return _.reduce( path, function(current,pathItem){
            
            pathItem = pathItem + '/';
            // log.debug('reading with ' + pathItem);

            return current.then( function(result){
                return new Promise( function(resolve, reject){

                    // Fs.exists( pathItem, function(exists){

                        // if( !exists ){ return resolve(result); }
                        
                        Fs.readdir( pathItem, function(err, files){
                            if( err ){ 
                                return resolve(result); 
                            }

                            result = result.concat( 
                                files.map(function(f){ return Path.join(pathItem, f); }) );
                            return resolve( result );
                        });
                    // });
                });
            });
        }, Promise.resolve([]) );
            // .then( function(result){
            //     return result;
            // });
    },

    _writeFile: function( path, data, toJSON ){
        toJSON = (toJSON === undefined) ? true : toJSON;
        return new Promise( function(resolve, reject){
            Sh.mkdir('-p', Path.dirname(path) );

            if( toJSON ){
                data = Utils.stringify( data, '\t' );
            }

            Fs.writeFile( path, data, function(err){
                if( err ){
                    throw new Error('could not write component schema to ' + path);
                }
                return resolve(true);
            });
        });
    },

    _deleteFile: function( path ){
        return this._pathExists( path )
            .then( function(exists){
                if( !exists ){ return path };
                return new Promise( function(resolve,reject){
                    Fs.unlink( path, function(){
                        return resolve(path);
                    });
                })
            });
    },

    _deleteComponents: function( components ){
        var self = this;
        var savePath = this.getPath();
        return _.reduce( components, function(current,com){
            return current.then( function(){
                var path = self._componentPath( com );
                return self._deleteFile( path )
                    .then( function(){ return com; });
            });
        }, Promise.resolve() );
    },


    _isComponentRegistered: function( component ){
        return false;
    },

    _getComponentSchema: function( component ){
        var uri;
        if( Utils.isInteger(component) ){
            uri = component;
        } else {
            uri = component.schemaUri;
        }
        return this.getRegistry().schemaRegistry.get( uri, null, {full:true} );
    },

    /**
    *   Returns an array of paths for each of the component ids passed
    */
    _getComponentPaths: function( componentIds, returnComponentPaths ){
        var self = this;
        var schemaRegistry = this.getRegistry().schemaRegistry;
        var path = Path.join(this.getPath(), 'c');
        componentIds = _.isArray( componentIds ) ? componentIds : [componentIds];

        var schemas = _.map( componentIds, function(cid){
            return schemaRegistry.get(cid,null,{full:true});
        })

        log.debug('_getComponentPaths: ' + JSON.stringify(componentIds) );

        // retrieve component hashes from ids
        var componentPaths = _.reduce( schemas, function(result,schema){
            log.debug('getting path for component ' + schema.uri );
            
            var componentPath = Path.join( path, schema.hash );

            if( path ){
                // result[ componentPath ] = true;
                result.push( componentPath );
            }
            return result;
        },[]);

        if( returnComponentPaths ){
            return this._readDir( componentPaths );
        }

        return componentPaths;
    },

    /**
    * the component filename is made from <component_id>-<entity_id>
    */
    _componentPath: function( component ){
        var path, schema;
        var entityId = component.entityId || component.getEntityId();
        var schemaHash = component.schemaHash;
        if( !schemaHash ){
            var schema = this._getComponentSchema( component );
            if( !schema ){
                log.debug('no schema for ' + JSON.stringify(component) );
                return null;
            }
        }
        
        path = Path.join( this.getPath(), 'c', schemaHash  );
        return Path.join( path, entityId+''  );
    },

    _schemaIndexPath: function(){
        return Path.join( this.getPath(), 'cs', 'index.json' );
    },

    // _componentSchemaPath: function( component ){
    //     var path, schema;
    //     path = Path.join( this.getPath(), 'cs' );
    //     if( !component ){
    //         return path;
    //     }
    //     schema = this._getComponentSchema( component );
    //     if( !schema ){
    //         return null;
    //     }
    //     path = Path.join( path, schema.hash + '.json' );
    //     return path;
    // },

    _entityPath: function( entityId ){
        entityId = Entity.isEntity(entityId) ? entityId.id : entityId;
        return Path.join( this.getPath(), 'e', entityId + '.json'  );
    },

    // returns the path to the entity index
    _entityIndexPath: function(){
        return Path.join( this.getPath(), 'e', 'index.json' );
    },
});


/**
*   Transfers entities from src to dst whilst applying the filter
*   The entityFilter is then set on the dstEntitySet
*/
FileSystemEntitySet.map = function( srcEntitySet, entityFilter, dstEntitySet, options ){
    var e,i,elen,len,it;
    var entity;
    options || (options = {});
    
    dstEntitySet.reset();

    if( entityFilter ){
        EntitySet.setQuery( dstEntitySet, entityFilter );
    }

    it = srcEntitySet.iterator();

    return Utils.reduceIterator( it, function(memo,item){
            memo.push( item );
        }, [])
        .then( function( entities ){
            dstEntitySet.addEntity( entities );
            return dstEntitySet;
        });
};


function componentFromData( componentData ){
    var data = JSON.parse( componentData );

    var result = Component.create();
    result.set( result.parse(data) );

    return result;
}

function entityToData( entity ){
    var component;
    var componentIId;
    var result;
    var data = entity.toJSON();

    // serialise the entities component references
    data._components = [];

    for( componentIId in entity.components ){
        component = entity.components[ componentIId ];
        data._components.push( {id:component.id, schemaHash:component.schemaHash} );
    }
    // if( !entity.components || entity.components.length <= 0 ){
        data.none = true;
    // }

    // result = JSON.stringify( data );
    return data;
}

/**
*   Returns an array of the components contained on the entity
*/
function entityComponents( entity ){
}

function createTempEntity( existingId ){
    var result = Entity.create();
    result.cid = _.uniqueId( TEMP_ENTITY_PREFIX );
    result.isTemp = true;
    return result;
}


FileSystemEntitySet.create = function( options ){
    var result;
    var tmpDir = Sh.tempdir();

    options || (options={});

    options = _.extend( {
        path: Path.join( tmpDir, 'fsEs_' + options.id )
    }, options );

    result = new FileSystemEntitySet( null, options );
    result.cid = _.uniqueId('es');
    
    return result;
}

module.exports = FileSystemEntitySet;