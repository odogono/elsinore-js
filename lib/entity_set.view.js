'use strict';

var _ = require('underscore');

var Entity = require('./entity');
var EntitySet = require('./entity_set');
var Utils = require('./utils');


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

        _.bindAll( this, 'onEntityAdd', 'onEntityRemove', 'onComponentAdd', 'onComponentRemove' );

        srcEntitySet.listenTo( targetEntitySet, 'entity:add', this.onEntityAdd );
        srcEntitySet.listenTo( targetEntitySet, 'entity:remove', this.onEntityRemove );
        srcEntitySet.listenTo( targetEntitySet, 'component:add', this.onComponentAdd );
        srcEntitySet.listenTo( targetEntitySet, 'component:remove', this.onComponentRemove );
    },

    onEntityAdd: function( entities ){
        var self = this;
        this.entitySet.isModified = true;
        
        _.each( entities, function(e){
            var eid = Entity.toEntityId( e );
            self.addedEntities[ eid ] = e;
            self.isModified = true;
        });

        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        // if( this.updateOnEvent ){
            this.applyEvents();
        // }
    },

    onEntityRemove: function(entities){
        var self = this;
        _.each( entities, function(e){
            var eid = Entity.toEntityId( e );
            if( !self.entitySet.get(eid) ){
                return;
            }
            self.addedEntities[ eid ] = null;
            self.removedEntities[ eid ]  = e;
            self.isModified = true;
        });
        
        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        // if( this.updateOnEvent ){
            this.applyEvents();
        // }
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
                self.isModified = true;
            } else {
                // this is the situation where a component is being added
                // but the containing entity doesn't already exist in the
                // listening entitySet - in this case the entity has to be
                // added before the component can
                entity = self.targetEntitySet.get( eid );
                if( entity && EntitySet.isEntityOfInterest(entity) ){
                    self.isModified = true;
                    self.addedEntities[ eid ] = entity;
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
        var entitySet = this.entitySet;

        // reduce down to components we are interested in
        for(i=0,len=components.length;i<len;i++ ){
            eid = Entity.getEntityId( components[i] );
            if( entitySet.hasEntity( eid ) ){
                this.changedEntityList[ eid ] = eid;
                this.isModified = true;
            }
        }

        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    // _applyComponentChanges: function( components ){
    //     var self = this;
    //     var entitySet = this.entitySet;

    //     // log.debug( entitySet.cid + '_aCC ' + JSON.stringify(components) );
    //     _.each( components, function(component){
    //         var eid = Entity.getEntityId( component );
    //         if( entitySet.hasEntity( eid ) ){
    //             self.changedEntityList[ eid ] = eid;
    //             self.entitySet.isModified = true;
    //         }
    //     });

    //     // if none of these components are of interest, then no need to update
    //     if( this.updateOnEvent ){
    //         this.applyEvents();
    //     }
    // },

    /**
    *   
    */
    applyEvents: function(){
        var i,len,com,entity;
        var entitySet;
        var entityFilter;
        var changedEntityIdList;
        var entitiesAdded;
        var entitiesRemoved;
        var changeOptions;
        var self = this;

        if( !this.isModified ){
            return;
        }

        entitySet = this.entitySet;
        entityFilter = this.entityFilter;
        entitiesAdded = [];
        entitiesRemoved = [];
        changeOptions = {silent:true};

        // add entities
        _.each( this.addedEntities, function(entity){
            if( entityFilter && !EntitySet.isEntityOfInterest( entitySet, entity, entityFilter ) ){
                return;
            }
            entitySet.add( entity, changeOptions );
            entitiesAdded.push( entity );
        });

        // remove entities
        _.each( this.removedEntities, function(entity){
            entitySet.remove( entity, changeOptions );
            // log.debug( entitySet.cid + ' removed entity ' + entity.id );
            entitiesRemoved.push( entity );
        });

        

        // entities that have changed due to component movement - remove if no longer valid
        changedEntityIdList = _.values( this.changedEntityList );
        if( changedEntityIdList.length > 0 ){
            for( i=0,len=changedEntityIdList.length;i<len;i++ ){
                entity = entitySet.get( changedEntityIdList[i] );
                if( !EntitySet.isEntityOfInterest( entitySet, entity, entityFilter ) ){
                    entitySet.remove( entity, changeOptions );
                    entitiesRemoved.push( entity );
                } else {
                }
            }
        }

        if( entitiesAdded.length > 0 ){
            entitySet.trigger('entity:add', entitiesAdded );
        }

        if( entitiesRemoved.length > 0 ){
            entitySet.trigger('entity:remove', entitiesRemoved );
        }

        entitiesAdded = null;
        entitiesRemoved = null;
        this.changedEntityList = Utils.clearMap( this.changedEntityList );
        this.isModified = false;
    },

    
    reset: function( changedEntityIdList ){
        var e, elen, i, len, entity, accept, added;
        var entitiesAdded;
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
    },

    hash: function(){
        // start with the entitysets hash
        var hash = _.result( this.targetEntitySet, 'hash' );
        if( this.entityFilter ){
            hash += this.entityFilter.hash();
        }
        return Utils.hash( hash, true );
    },
});

EntitySetListener.create = function(){
    return new EntitySetListener();
}

module.exports = {
    EntitySetListener: EntitySetListener
}