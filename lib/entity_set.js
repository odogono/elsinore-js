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
    isEntitySet: true,
    isAsync: false,

    initialize: function( entities, options ){
        this._cmdBuffer = CmdBuffer.create();
        this.cid = _.uniqueId('c');
    },

    hash: function(){
        return Utils.hash( this.type + this.id, true );
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

    /***
    *   
    */
    triggerEntityEvent: function( entity, name ){
        var args = Array.prototype.slice.call(arguments);
        args[0] = name;
        args[1] = entity;
        if( !this._entityEvents ){
            this._entityEvents = _.clone(Backbone.Events);
        }

        // log.debug('trigger ' + JSON.stringify(args));
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


    addComponentToEntity: function( component, entity, options ){
        // var record = this.registerComponentDef( component );
        var bf = entity.getComponentBitfield();

        if( !entity.components ){
            entity.components = [];
        }

        var existing = entity.components[ component.schemaIId ];

        if( existing ){
            // release existing
            component.setEntityId( null );
        }

        // if( bf.get( record.id) ){
        //     log.debug('already registered ' + JSON.stringify(bf) );
        //     // already registered
        //     return this;
        // }

        bf.set( component.schemaIId, true );
        component.setEntityId( entity.getEntityId() );

        entity[ component.name ] = component;
        entity.components[ component.schemaIId ] = component;

        return this;
    },

    cloneEntity: function( entity, options ){
        var comClone;
        var result = Entity.create( entity.getEntityId(), this.id );
        // clone each of the attached components
        for( var comId in entity.components ){
            comClone = this.cloneComponent( entity.components[comId] );
            // log.debug('adding com ' + comClone.name + ' ' + comClone.id );
            this.addComponentToEntity( comClone, result );
        }
        result.registry = this.getRegistry();
        return result;
    },

    cloneComponent: function( component, options ){
        var result = new component.constructor(component.attributes);
        result.id = component.id;
        result.schemaHash = component.schemaHash;
        result.name = component.name;
        result.schemaIId = component.schemaIId;
        result.registry = this.getRegistry();
        return result;
    },


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


    getComponentFromEntity: function( component, entity, options ){
        return entity.components[ component.schemaIId ];
    },


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

/**
*   Transfers entities from src to dst whilst applying the filter
*   The entityFilter is then set on the dstEntitySet
*/
EntitySet.map = function( srcEntitySet, entityFilter, dstEntitySet, options ){
    var e,i,elen,len;
    var entity;
    options || (options = {});
    
    dstEntitySet.reset();

    EntitySet.setEntityFilter( dstEntitySet, entityFilter );

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

/**
    The EntitySet listener keeps track of one entitySet listening to enother.
*/
function EntitySetListener(){
}

/**
    Methods which enable this object to respond to 
*/
_.extend( EntitySetListener.prototype, {
    isEntitySetListener: true,

    /**
    *   Listen to another EntitySet using the specified filter
    */
    listenToEntitySet: function(srcEntitySet, targetEntitySet, entityFilter, options){
        this.entitySet = srcEntitySet;
        this.targetEntitySet = targetEntitySet;
        this.entityFilter = entityFilter;
        this.changedEntityList = {};
        this.addedEntities = {};
        this.removedEntities = {};

        _.bindAll( this, 'onEntityAdd', 'onEntityRemove', 'onComponentAdd', 'onComponentRemove', '_applyComponentChanges' );

        srcEntitySet.listenTo( targetEntitySet, 'entity:add', this.onEntityAdd );
        srcEntitySet.listenTo( targetEntitySet, 'entity:remove', this.onEntityRemove );
        srcEntitySet.listenTo( targetEntitySet, 'component:add', this.onComponentAdd );
        srcEntitySet.listenTo( targetEntitySet, 'component:remove', this._applyComponentChanges );
    },

    onEntityAdd: function( entities ){
        var self = this;
        this.entitySet.isModified = true;
        
        _.each( entities, function(e){
            var eid = Entity.toEntityId( e );
            self.addedEntities[ eid ] = e;
        });

        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    onEntityRemove: function(entities){
        var self = this;
        _.each( entities, function(e){
            var eid = Entity.toEntityId( e );
            self.addedEntities[ eid ] = null;
            self.removedEntities[ eid ]  = e;
        });
        
        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    onComponentAdd: function(components){
        var self = this;
        var entitySet = this.entitySet;
        var entity;

        // log.debug( entitySet.cid + '_oCA ' + JSON.stringify(components) );
        _.each( components, function(component){
            var eid = Entity.getEntityId( component );
            if( entitySet.hasEntity( eid ) ){
                self.changedEntityList[ eid ] = eid;
                self.entitySet.isModified = true;
            } else {
                // this is the situation where a component is being added
                // but the containing entity doesn't already exist in the
                // listening entitySet - in this case the entity has to be
                // added before the component can
                entity = self.targetEntitySet.get( eid );
                if( entity && EntitySet.isEntityOfInterest(entity) ){
                    // self.onEntityAdd( entity );
                    self.entitySet.isModified = true;
                    self.addedEntities[ eid ] = entity;
                    // log.debug( entitySet.cid + ' added new entity' );
                }
            }
        });

        // if none of these components are of interest, then no need to update
        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    onComponentRemove: function(components){
        var i,len,com,eid;
        var count = 0;
        var entitySet = this.entitySet;
        // if( !this.componentsToRemove ){
        //     this.componentsToRemove = [];
        // }

        // reduce down to components we are interested in
        for(i=0,len=components.length;i<len;i++ ){
            // com = ;
            eid = Entity.getEntityId( components[i] );
            if( entitySet.hasEntity( eid ) ){
                this.changedEntityList[ eid ] = eid;
                this.entitySet.isModified = true;
                // this.componentsToRemove.push( com );
                count++;
            }
        }

        if( count === 0 ){
            return;
        }

        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    _applyComponentChanges: function( components ){
        var self = this;
        var entitySet = this.entitySet;

        // log.debug( entitySet.cid + '_aCC ' + JSON.stringify(components) );
        _.each( components, function(component){
            var eid = Entity.getEntityId( component );
            if( entitySet.hasEntity( eid ) ){
                self.changedEntityList[ eid ] = eid;
                self.entitySet.isModified = true;
            }
        });

        // if none of these components are of interest, then no need to update
        if( this.updateOnEvent ){
            this.applyEvents( );
            this.changedEntityList = Utils.clearMap( this.changedEntityList );
        }
    },

    applyEvents: function(){
        var i,len,com,entity;
        var entitySet = this.entitySet;
        var entityFilter = this.entityFilter;
        var changedEntityIdList;
        var entitiesRemoved = [];

        // if( this.componentsToAdd ){
        //     entitySet.addComponent( this.componentsToAdd );
        //     this.componentsToAdd = Utils.clearArray( this.componentsToAdd );
        // }
        
        _.each( this.addedEntities, function(entity){
            if( entityFilter && !EntitySet.isEntityOfInterest( entitySet, entity, entityFilter ) ){
                return;
            }
            entitySet.add( entity );
        });

        _.each( this.removedEntities, function(entity){
            entitySet.remove( entity );
            entitiesRemoved.push( entity );
        });

        changedEntityIdList = _.values( this.changedEntityList );

        // log.debug('changed entities ' + JSON.stringify(changedEntityIdList));

        if( changedEntityIdList.length > 0 ){
            for( i=0,len=changedEntityIdList.length;i<len;i++ ){
                entity = entitySet.get( changedEntityIdList[i] );
                if( !EntitySet.isEntityOfInterest( entitySet, entity, entityFilter ) ){
                    entitySet.remove( entity );
                    entitiesRemoved.push( entity );
                } else {
                }
            }
        }

        if( entitiesRemoved.length > 0 ){
            // log.debug('entity ' + JSON.stringify(entitiesRemoved) + ' not of interest');
            entitySet.trigger('entity:remove', entitiesRemoved );
        }

        entitiesRemoved = null;
        this.addedEntities = Utils.clearMap( this.addedEntities );
        this.removedEntities = Utils.clearMap( this.removedEntities );
        this.changedEntityList = Utils.clearMap( this.changedEntityList );
        this.isModified = false;
    },

    
    reset: function( changedEntityIdList ){
        var e, elen, i, len, entity, accept, added;
        var entitiesRemoved;
        var entitySet = this.entitySet;
        var entityFilter = this.entityFilter;
        var models = this.targetEntitySet.models;

        if( !this.entityFilter ){
            entitySet.reset( models, {} );
            return this;
        }

        added = 0;
        entitySet.reset( null, {silent:true} );
        
        for( e=0,elen=models.length;e<elen;e++ ){
            entity = models[e];
            // log.debug('adding e ' + JSON.stringify(entity) );
            if( EntitySet.isEntityOfInterest(this, entity, entityFilter) ){
                entitySet.add( entity );
                added++;
            }
        }
    },//*/

    hash: function(){
        // start with the entitysets hash
        var hash = _.result( this.targetEntitySet, 'hash' );
        if( this.entityFilter ){
            hash += this.entityFilter.hash();
        }
        return Utils.hash( hash, true );
    },
});



EntitySet.listenToEntitySet = function( srcEntitySet, targetEntitySet, entityFilter, options ){
    var updateOnEvent;

    var listener = new EntitySetListener();

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