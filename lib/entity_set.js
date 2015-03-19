'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var Promise = require('bluebird');


var BitField = require('./bit_field');
var Component = require('./component');
var Entity = require('./entity');
var EntityFilter = require('./entity_filter');
var Utils = require('./utils');

var CmdBuffer = require('./cmd_buffer/sync');


/**
 * An EntitySet is a container for entities
 */
var EntitySet = Backbone.Collection.extend({
    type: 'EntitySet',
    isMemoryEntitySet: true,
    isEntitySet: true,
    isAsync: false,

    initialize: function( entities, options ){
        this._cmdBuffer = CmdBuffer.create();
        this.cid = _.uniqueId('c');
    },

    getEntitySetId: function(){
        return this.id;
    },

    hash: function(){
        return EntitySet.hash( this, this.entityFilter );
    },

    destroy: function(){
        this.stopListening();
        // this.entities = null;
        this.storage = null;
        this.registry = null;
    },

    size: function(){
        return this.length;
    },

    toJSON: function(){
        var result = { cid:this.cid };
        if( this.entityFilter ){
            result.entityFilter = this.entityFilter.toJSON();
        }
        return result;
    },


    // iterator: function(options){
    //     var self = this;
    //     var nextIndex = 0;
    //     return {
    //         next: function(){
    //             return new Promise( function(resolve, reject){
    //                 if( nextIndex < self.entities.length ){
    //                     return resolve( self.entities.at(nextIndex++) );
    //                 }
    //                 return reject({done:true});
    //             });
    //         }
    //     };
    // },

    iterator: function(options){
        var self = this, nextIndex = 0;
        return {
            next: function(){
                return nextIndex < self.length ?
                    { value: self.at(nextIndex++), done:false }:
                    { done:true };
            }
        }
    },

    setRegistry: function( registry, options ){
        this._registry = registry;
    },

    getRegistry: function(){
        return this._registry;
    },


    /**
    *   TODO: move out of here
    */
    attachTo: function( otherEntitySet, options ){
        // load the start state from this entity set
        otherEntitySet.reset( this );
        this.listenTo(otherEntitySet, 'all', this.onEntitySetEvent );
    },


    /**
    *   TODO: move out of here
    */
    onEntitySetEvent: function( evt ){
        var options;
        var args = Array.prototype.slice.call(arguments, 1);
        switch( evt ){
            // case 'entity:add':
                // return this.add.apply( this, args );
            case 'component:add':
                args[1] = _.extend({}, args[1], {clone:true});
                return this.addComponent.apply(this, args);
            case 'component:remove':
                return this.removeComponent.apply( this, args );
            // case 'entity:remove':
                // return this.remove.apply( this, args );
            case 'reset':
                return this.reset.apply( this.args );
        }
        return this;
    },


    /**
    * Adds a component to this set
    */
    addComponent: function(component, options ){
        return this._cmdBuffer.addComponent( this, component, options );
    },

    /**
    *
    */
    removeComponent: function( component, options ){
        return this._cmdBuffer.removeComponent( this, component, options );
    },

    /**
    *   Adds an entity with its components to the entityset
    - reject if filters do not pass
    - 
    */
    addEntity: function( entity, options){
        if( EntitySet.isEntitySet( entity ) ){
            entity = entity.models;
        }
        return this._cmdBuffer.addEntity( this, entity, options );
    },

    /**
    *
    */
    removeEntity: function(entity, options){
        return this._cmdBuffer.removeEntity( this, entity, options );
    },

    _createEntity: function( entityId, returnId ){
        var result;
        var entityId;

        if( !entityId || entityId <= 0 ){
            entityId = this.getRegistry().createId();    
        }
        if( returnId ){
            return entityId;
        }
        result = Entity.toEntity( entityId );
        result.setEntitySet( this );
        return result;
    },

    _createComponentId: function( ){
        return this.getRegistry().createId();// this._componentId++;
    },

    _addEntity: function(entity){
        this.add( entity );
        return entity;
    },

    _removeEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        this.remove( entity );
        return entity;
    },

    

    getEntity: function( entity, options ){
        return this.get( entity );
    },

    hasEntity: function(entity){
        return this.get( entity ) !== undefined;
    },

    /**
    *
    */
    /*reset: function(entities, options){
        options || (options = {});
        var opOptions = _.extend({silent: false, removeEmptyEntity:false},options);

        this.removeEntity( this.models, opOptions );
        this._reset();
        
        if( entities ){
            this.addEntity( entities, opOptions );
        }

        if (!options.silent) {
            this.trigger('reset', this, options);
        }
    },//*/

    /**
    *   
    */
    triggerEntityEvent: function( entity, name ){
        var args = _.toArray( arguments );
        args[0] = name;
        args[1] = entity;
        this._entityEvents || (this._entityEvents = _.clone(Backbone.Events));

        log.debug('trigger ' + JSON.stringify(args));
        return this._entityEvents.trigger.apply( this._entityEvents, args );
    },

    listenToEntityEvent: function( entityOrFilter, name, callback, context ){
        if( !this._entityEvents ){
            this._entityEvents = _.clone(Backbone.Events);
            // this._entityEvents.on('all', function(){
            //     log.debug('eevt: ' + JSON.stringify(arguments) );
            // })
        }

        this._entityEvents.listenTo( this._entityEvents, name, callback );
    },




    // TODO: remove
    doesEntityHaveComponent: function( entityId, componentId, options ){
        var entity;
        if( Utils.isInteger(entityId) ){
            entity = this.at(entityId);
        }

        if( !entity ){
            throw new Error('entity not found: ' + entityId);
        }

        var bf = entity.getComponentBitfield();
        if( BitField.isBitField(componentId) ){
            return BitField.and( componentDef, bf );
        }
        // var componentDefId = ComponentDef.getId( componentDef );
        return bf.get( componentId );

        // return entity.hasComponent( componentId );
    },

    // TODO: remove
    removeComponentFromEntity: function( component, entity, options ){
        var bf = entity.getComponentBitfield();

        if( !bf.get(component.schemaIId) ){
            log.debug('no component found for ' + component.name );
            return this;
        }

        bf.set( component.schemaIId, false );

        delete entity[ component.name ];
        delete entity.components[ component.schemaIId ];

        this.getRegistry().destroyComponent( component );

        return this;
    },

    // TODO: remove
    getComponentFromEntity: function( component, entity, options ){
        return entity.components[ component.schemaIId ];
    },

    // TODO: remove
    doesEntityHaveComponents: function( entity, options ){
        var bf = entity.getComponentBitfield();
        if( bf.count() > 0 ){
            return true;
        }
        var size = _.keys(entity.components).length;
        return size > 0;
    },


    applyEvents: function(){
        if( !this.listeners ){
            return;
        }
        _.each( this.listeners, function(listener){
            listener.applyEvents();
        });
    },


    /**
    *   Selects a number of entities from the entityset
    */
    where: function( entityFilter, attrs, options ){
        var result = EntitySet.create();
        var registry = this.getRegistry();
        var filters;
        var componentUri;
        result.setRegistry( registry );

        if( !entityFilter ){
        } else if( _.isString(entityFilter) ){
            // componentUri = entityFilter;
            componentUri = registry.getIId( entityFilter );

            filters = [
                EntityFilter.ALL, entityFilter
            ];
            if( attrs ){
                filters = [ filters, 
                    function accept(entity){
                        var key, com = entity.components[componentUri];
                        if( !com ){ return false; }
                        for (key in attrs) {
                            if (attrs[key] !== com.get(key)) { return false; }
                        }
                        return true;
                    } ];
            }
            entityFilter = registry.createEntityFilter( filters );
        }

        // log.debug('mapping with ' + entityFilter );
        result = EntitySet.map( this, entityFilter, result );

        return result;
    },

});



// EntitySet.prototype[Symbol.iterator] = function() {
//     let entities = this.entities;
//     return {
//         index: 0,
//         next: function(){
//             if( this.index < entities.length ){
//                 return { value: entities[this.index++], done:false };
//             }
//             return {done:true};
//         }
//     }
// };

// // NOTE - should really use iterator rather than these
// _.each( ['forEach', 'each', /*'map',*/ 'where', 'filter'], function(method){
//     EntitySet.prototype[method] = function(){
//         var args = Array.prototype.slice.call(arguments);
//         args.unshift( this.entities.models );
//         return _[method].apply( _, args );
//     };
// });


EntitySet.hash = function( entitySet, entityFilter ){
    var hash = entitySet.type;
    if( entityFilter ){
        hash += entityFilter.hash();
    }
    return Utils.hash( hash, true );
}


/**
*   Transfers entities from src to dst whilst applying the filter
*   The entityFilter is then set on the dstEntitySet
*/
EntitySet.map = function( srcEntitySet, entityFilter, dstEntitySet, options ){
    var e,i,elen,len;
    var entity;
    options || (options = {});
    
    dstEntitySet.reset();

    if( entityFilter ){
        EntitySet.setEntityFilter( dstEntitySet, entityFilter );
    }

    dstEntitySet.addEntity( srcEntitySet );

    return dstEntitySet;
};


EntitySet.setEntityFilter = function( entitySet, entityFilter, options ){
    var filterType;
    var componentIds;
    var args;
    var registry;

    var args = Array.prototype.slice.call(arguments, 1);

    registry = entitySet.getRegistry();

    entityFilter = registry.createEntityFilter.apply( registry, args );

    if( !entityFilter ){
        return null;
    }

    entitySet.entityFilter = entityFilter;
    
    // check that entities are still allowed to belong to this set
    EntitySet.evaluateEntities( entitySet, entityFilter );

    return entityFilter;
};



/**
*   Checks through all contained entities, ensuring that they
*   are still valid members of this entitySet
*/
EntitySet.evaluateEntities = function( entitySet, options ){
    var i,len,entity;
    var entities;

    entities = entitySet.entities || entitySet;

    for( i=entities.length-1; i>=0; i-- ){
        entity = entities.at(i);
        if( entity && !EntitySet.isEntityOfInterest( entitySet, entity, entitySet.entityFilter ) ){
            entitySet.removeEntity( entity );
        }
    }
};


/**
*   Returns true if the given entity is of interest
*   All of its components must be allowed by the set

TODO: move out of here
*/
EntitySet.isEntityOfInterest = function( entitySet, entity, entityFilter, options ){
    var result;
    var i,len;

    if( !entityFilter ){
        return true;
    }
    
    options || (options = {});
    
    // if( additionalComponentDefId ){
    //     options.extra = additionalComponentDefId;
    // }

    return entityFilter.accept( entity, options );
}



EntitySet.listenToEntitySet = function( srcEntitySet, targetEntitySet, entityFilter, options ){
    var updateOnEvent;

    var listener = require('./entity_set.view').EntitySetListener.create();

    srcEntitySet.listeners || (srcEntitySet.listeners={});
    // are we already listening to this entityset?
    srcEntitySet.listeners[ targetEntitySet.cid ] = listener;

    listener.updateOnEvent = options.updateOnEvent;

    listener.listenToEntitySet( srcEntitySet, targetEntitySet, entityFilter );

    listener.reset();

    return listener;
}


EntitySet.createView = function( entitySet, entityFilter, options ){
    var result;
    var registry = entitySet.getRegistry();
    var models = entitySet.models;

    options || (options={});

    result = new EntitySet();
    result.isEntitySetView = true;
    result.type = 'EntitySetView';

    result.id = registry.createId();
    result.setRegistry( registry );

    if( entityFilter ){
        EntitySet.setEntityFilter( result, entityFilter );
    }

    // make <result> listenTo <entitySet> using <entityFilter>
    EntitySet.listenToEntitySet( result, entitySet, entityFilter, options );

    return result;
}


EntitySet.isEntitySet = function(es){
    return es && es.isEntitySet;
}

EntitySet.create = function(options){
    var result;
    options || (options = {});
    result = new EntitySet();

    if( !_.isUndefined(options.allowEmptyEntities) ){
        result.allowEmptyEntities = options.allowEmptyEntities;
    } else {
        result.allowEmptyEntities = true;
    }

    if( options.id ){
        result.id = options.id;
    }

    // result._reset();
    
    // log.debug('options ' + JSON.stringify(options) );
    // result.set( options );

    return result;
};


module.exports = EntitySet;