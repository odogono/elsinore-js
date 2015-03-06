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
var EntitySet = Backbone.Model.extend({
    type: 'EntitySet',
    isEntitySet: true,


    initialize: function( attrs, options ){
        var self = this;
        options || (options = {});
        this.registry = options.registry;
        this._reset( true );
    },

    hash: function(){
        return Utils.hash( this.type + this.id, true );
    },

    _reset: function( initialize ){
        if( initialize) {
            this.entities = new Backbone.Collection(); // TODO integrate this
        } else {
            this.entities.reset();
        }
        this._cmdBuffer = CmdBuffer.create();
    },

    destroy: function(){
        this.stopListening();
        this.entities = null;
        this.storage = null;
        this.registry = null;
    },

    size: function(){
        return this.entities.length;
    },

    /**
    *   Synchronous version of at. Returns the entity at the given index
    */
    atSync: function(index) {
        return this.entities.at(index);
    },

    at: function(index){
        return this.entities.at(index);
    },

    iterator: function(options){
        var self = this;
        var nextIndex = 0;
        return {
            next: function(){
                return new Promise( function(resolve, reject){
                    if( nextIndex < self.entities.length ){
                        return resolve( self.entities.at(nextIndex++) );
                    }
                    return reject({done:true});
                });
            }
        };
    },

    iteratorSync: function(options){
        var self = this, nextIndex = 0;
        return {
            next: function(){
                return nextIndex < self.entities.length ?
                    { value: self.entities.at(nextIndex++), done:false }:
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
    addComponent: function(component, options){
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
            entity = entity.entities.models;
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
        this.entities.add( entity );
        return entity;
    },

    _removeEntity: function(entity){
        var entityId = Entity.toEntityId(entity);
        this.entities.remove( entity );
        return entity;
    },

    

    getEntity: function( entity, options ){
        return this.entities.get( entity );
    },

    /**
    *
    */
    reset: function(entities, options){
        options || (options = {});
        var opOptions = _.extend({silent: false, removeEmptyEntity:false},options);

        this.removeEntity( this.entities.models, opOptions );
        this._reset();
        
        if( entities ){
            this.addEntity( entities, opOptions );
        }

        if (!options.silent) {
            this.trigger('reset', this, options);
        }
    },

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
            entity = this.entities.at(entityId);
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

        bf.set( component.schemaIId, false );

        delete entity[ component.name ];
        delete entity.components[ component.schemaIId ];

        this.getRegistry().destroyComponent( component );

        // component.setEntityId( 0 );

        return this;
    },


    getComponentFromEntity: function( component, entity, options ){
        // var record = this.registerComponentDef( component );
        // if( !record )
            // return null;
        return entity.components[ component.schemaIId ];
    },


    doesEntityHaveComponents: function( entity, options ){
        var bf = entity.getComponentBitfield();
        if( bf.count() > 0 ){
            return true;
        }
        var size = _.keys(entity.components).length;
        return size > 0;
    }
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
        if( entity && !EntitySet.isEntityOfInterest( entitySet, entity ) ){
            entitySet.removeEntity( entity );
        }
    }
};


/**
*   Returns true if the given entity is of interest
*   All of its components must be allowed by the set

TODO: move out of here
*/
EntitySet.isEntityOfInterest = function( entitySet, entity, additionalComponentDefId, options ){
    var result;
    var i,len;

    if( !entitySet.entityFilter ){
        return true;
    }
    
    options || (options = {});
    
    if( additionalComponentDefId ){
        options.extra = additionalComponentDefId;
    }

    return entitySet.entityFilter.accept( entity, options );
}


/**
    Methods which enable this object to respond to 
*/
var EntitySetListener = {
    isEntitySetListener: true,

    /**
    *   Listen to another EntitySet using the specified filter
    */
    listenToEntitySet: function(entitySet, entityFilter, options){
        this.entitySet = entitySet;

        this.listenTo( entitySet, 'entity:add' );
        this.listenTo( entitySet, 'entity:remove' );
        this.listenTo( entitySet, 'component:add' );
        this.listenTo( entitySet, 'component:remove' );
    },

    update: function(){
    },

    hash: function(){
        // start with the entitysets hash
        var hash = _.result( this.entitySet, 'hash' );
        if( this.entityFilter ){
            hash += this.entityFilter.hash();
        }
        return Utils.hash( hash, true );
    },
};



/**
*   An EntityCollection is a simple collection of entities derived from
*   an entityset. It is intended as read-only.
*/
var EntityCollection = Backbone.Collection.extend({
    type: 'EntityCollection',

    setEntitySet: function(entitySet){
        this.entitySet = entitySet;
        this.listenTo( entitySet, 'entity:add', this.onEvent );
        this.listenTo( entitySet, 'entity:remove', this.onEvent );
        this.listenTo( entitySet, 'component:add', this.onEvent );
        this.listenTo( entitySet, 'component:remove', this.onComponentRemove );
        this.update();
    },


    onComponentRemove: function(components){
        var i,len;
        var self = this;
        this.isModified = true;
        // if none of these components are of interest, then no need to update
        if( this.updateOnEvent ){

            // are the entities of these components in this collection?
            components = _.filter( components, function(component){
                return self.get( component.getEntityId() );
            });

            // TODO: only the affected entities should be updated, which prevents
            // the entire collection being reloaded
            this.update();

            // if( components.length > 0 ){
            //     this.trigger('component:remove', components);
            // }
        }
    },

    onEvent: function(){
        this.isModified = true;
        // log.debug('received evt ' + JSON.stringify(arguments) );
        if( this.updateOnEvent ){
            this.update();
        }
    },
    
    // onEntityAdd: function(entity){
    //     var i,len;
    //     if( EntitySet.isEntityOfInterest(this,entity) ){
    //         this.add( entity );
    //     }
    // },
    
    
    /**
    *   Resets the list of entities from the origin entitySet
    */
    update: function(){
        var e, elen, i, len, entity, accept, added;
        var models = this.entitySet.entities.models;
        // log.debug('updating collection ' + this.hash() + ' from ' + models.length + ' entities');
        if( !this.entityFilter ){
            this.reset( models, {} );
            return this;
        }
        added = 0;
        this.reset( null, {silent:true} );
        for( e=0,elen=models.length;e<elen;e++ ){
            if( EntitySet.isEntityOfInterest(this,models[e]) ){
                this.add( models[e] );
                added++;
            }
        }
    },

    hash: function(){
        // start with the entitysets hash
        var hash = _.result( this.entitySet, 'hash' );

        if( this.entityFilter ){
            hash += this.entityFilter.hash();
        }

        return Utils.hash( hash, true );
    }
});


EntitySet.createCollection = function( entitySet, entityFilter, options ){
    var result;
    var registry = entitySet.getRegistry();
    var models = entitySet.entities.models;

    options || (options={});

    result = new EntityCollection();
    result.id = registry.createId();

    result.updateOnEvent = options.updateOnEvent;

    // to allow a common interface with EntitySet to reach the collection
    result.entities = result;
    result.entityFilter = entityFilter;
    result.setEntitySet( entitySet );

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
    
    result.set( options );

    return result;
};


module.exports = EntitySet;