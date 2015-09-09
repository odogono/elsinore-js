'use strict';

let _ = require('underscore');

let Entity = require('../entity');
let EntitySet = require('../entity_set');
let Query = require('./query');
let Utils = require('../utils');

_.extend( EntitySet.prototype, {

    view: function( query, options={} ){
        let result;
        let registry = this.getRegistry();
        
        result = registry.createEntitySet( null, {register:false} );
        result.type = 'EntitySetView';
        result.isEntitySetView = true;

        // make <result> listenTo <entitySet> using <entityFilter>
        EntitySet.listenToEntitySet( result, this, query, options );

        // store the view
        this.views || (this.views={});
        this.views[ query ? query.hash() : 'all' ] = result;
        this.trigger('view:create', result);

        return result;
    }

});

EntitySet.listenToEntitySet = function( srcEntitySet, targetEntitySet, query, options ){
    let listener, updateOnEvent;

    listener = EntitySetListener.create();

    srcEntitySet.listeners || (srcEntitySet.listeners={});
    // are we already listening to this entityset?
    srcEntitySet.listeners[ targetEntitySet.cid ] = listener;

    listener.updateOnEvent = options.updateOnEvent;

    srcEntitySet.setQuery( query );

    listener.listenToEntitySet( srcEntitySet, targetEntitySet, query );
    
    srcEntitySet.reset( targetEntitySet );
    
    return listener;
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

    setQuery: function(q){
        this._query = q;
    },
    getQuery: function(){
        return this._query;
    },

    /**
    *   srcEntitySet listens to targetEntitySet using the specified query
    */
    listenToEntitySet: function(srcEntitySet, targetEntitySet, query, options){
        this.entitySet = srcEntitySet;
        this.targetEntitySet = targetEntitySet;
        this.setQuery( query );
        
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
        this.entitySet.isModified = true;
        
        _.each( entities, e => {
            let eid = Entity.toEntityId( e );
            this.addedEntities[ eid ] = e;
            this.isModified = true;
        });

        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        // if( this.updateOnEvent ){
            this.applyEvents();
        // }
    },

    onEntityRemove: function(entities){
        _.each( entities, e => {
            let eid = Entity.toEntityId( e );
            if( !this.entitySet.get(eid) ){
                return;
            }
            delete this.addedEntities[ eid ];
            this.removedEntities[ eid ]  = e;
            this.isModified = true;
        });
        
        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        // if( this.updateOnEvent ){
            this.applyEvents();
        // }
    },

    onComponentAdd: function(components){
        let entitySet = this.entitySet;
        let entity;

        // log.debug( entitySet.cid + '_oCA ' + JSON.stringify(components) );
        _.each( components, component => {
            let eid = Entity.getEntityId( component );
            if( entitySet.hasEntity(eid) ){
                this.changedEntityList[ eid ] = eid;
                this.isModified = true;
            } else {
                // this is the situation where a component is being added
                // but the containing entity doesn't already exist in the
                // listening entitySet - in this case the entity has to be
                // added before the component can
                entity = this.targetEntitySet.get( eid );
                if( entity && EntitySet.isEntityOfInterest(entitySet,entity) ){
                    this.isModified = true;
                    this.addedEntities[ eid ] = entity;
                }
            }
        });

        // if none of these components are of interest, then no need to update
        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    onComponentRemove: function(components){
        let ii,len,com,eid;
        let entitySet = this.entitySet;

        // reduce down to components we are interested in
        for(ii=0,len=components.length;ii<len;ii++ ){
            eid = Entity.getEntityId( components[ii] );
            if( entitySet.hasEntity( eid ) ){
                this.changedEntityList[ eid ] = eid;
                this.isModified = true;
            }
        }

        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    /**
    *   
    */
    applyEvents: function(){
        let ii,len,com,entity;
        let entitySet;
        let query;
        let changedEntityIdList;
        let entitiesAdded;
        let entitiesRemoved;
        let changeOptions;
        
        if( !this.isModified ){
            return;
        }

        entitySet = this.entitySet;
        query = this.getQuery();
        entitiesAdded = [];
        entitiesRemoved = [];
        changeOptions = {silent:true};

        // add entities
        _.each( this.addedEntities, (entity, eid) => {
            if( query && !EntitySet.isEntityOfInterest( entitySet, entity, query ) ){
                return;
            }
            entitySet.add( entity, changeOptions );
            // log.debug('addedEntities includes ' + Utils.stringify(entity) + ' ' + eid);
            entitiesAdded.push( entity );
        });

        // remove entities
        _.each( this.removedEntities, entity => {
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
        let q;
        // start with the entitysets hash
        let hash = _.result( this.targetEntitySet, 'hash' );
        if( (q = this.getQuery()) ){
            hash += q.hash();
        }
        return Utils.hash( hash, true );
    },
});

EntitySetListener.create = function(){
    return new EntitySetListener();
}


module.exports = EntitySet;