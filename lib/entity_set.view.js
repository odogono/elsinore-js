'use strict';

var _ = require('underscore');

var Entity = require('./entity');
var EntitySet = require('./entity_set');
var Utils = require('./utils');
var Query = require('./query');

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
    *   srcEntitySet listens to targetEntitySet using the specified query
    */
    listenToEntitySet: function(srcEntitySet, targetEntitySet, query, options){
        this.entitySet = srcEntitySet;
        this.targetEntitySet = targetEntitySet;
        this.query = Query.create( srcEntitySet.getRegistry(), query );
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
            delete self.addedEntities[ eid ];
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
        var query;
        var changedEntityIdList;
        var entitiesAdded;
        var entitiesRemoved;
        var changeOptions;
        var self = this;

        if( !this.isModified ){
            return;
        }

        entitySet = this.entitySet;
        query = this.query;
        entitiesAdded = [];
        entitiesRemoved = [];
        changeOptions = {silent:true};

        // add entities
        _.each( this.addedEntities, function(entity, eid){
            if( query && !EntitySet.isEntityOfInterest( entitySet, entity, query ) ){
                return;
            }
            entitySet.add( entity, changeOptions );
            // log.debug('addedEntities includes ' + Utils.stringify(entity) + ' ' + eid);
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
            entitiesRemoved = entitiesRemoved.concat( 
                EntitySet.evaluateEntities(entitySet, changedEntityIdList, changeOptions) );

            // for( i=0,len=changedEntityIdList.length;i<len;i++ ){
            //     entity = entitySet.get( changedEntityIdList[i] );
            //     if( !EntitySet.isEntityOfInterest( entitySet, entity, query ) ){
            //         entitySet.remove( entity, changeOptions );
            //         entitiesRemoved.push( entity );
            //     } else {
            //     }
            // }
        }

        if( entitiesAdded.length > 0 ){
            // log.debug('+triggering add entities ' + Utils.stringify(entitiesAdded) );
            entitySet.trigger('entity:add', entitiesAdded );
        }

        if( entitiesRemoved.length > 0 ){
            entitySet.trigger('entity:remove', entitiesRemoved );
        }

        entitiesAdded = null;
        entitiesRemoved = null;
        this.addedEntities = Utils.clearMap( this.addedEntities );
        this.removedEntities = Utils.clearMap( this.removedEntities );
        this.changedEntityList = Utils.clearMap( this.changedEntityList );
        this.isModified = false;
    },


    hash: function(){
        // start with the entitysets hash
        var hash = _.result( this.targetEntitySet, 'hash' );
        if( this.query ){
            hash += this.query.hash();
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