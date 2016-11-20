import _ from 'underscore';

import Entity from '../entity';
import EntitySet from './index';
import Query from '../query';

import {
    clearMap,
    hash,
    stringify,
} from '../util';

_.extend( EntitySet.prototype, {

    view: function( query, options={} ){
        let result;
        let registry = this.getRegistry();

        result = registry.createEntitySet( {register:false} );
        result.type = 'EntitySetView';
        result.isEntitySetView = true;
        // console.log('created view', result.cid, 'from', this.cid );

        // make <result> listenTo <entitySet> using <entityFilter>
        EntitySet.listenToEntitySet( result, this, query, options );

        // if a valid query was supplied, it will have been resolved
        // into a query object by now
        query = result.getQuery();

        // console.log('using view query', query);
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
    
    // reset causes entities to be copied over?
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
    listenToEntitySet: function(srcEntitySet, targetEntitySet, query){
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
        // srcEntitySet.listenTo( targetEntitySet, 'component:change', (...args) => {
        //     log.debug('listen to es change ' + JSON.stringify(args) );
        // })
    },

    onEntityAdd: function( entities, apply=true ){
        this.entitySet.isModified = true;
        
        _.each( entities, e => {
            let eid = Entity.toEntityId( e );
            this.addedEntities[ eid ] = e;
            this.isModified = true;
        });

        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        if( apply /*this.updateOnEvent*/ ){
            this.applyEvents();
        }
    },

    onEntityRemove: function(entities, apply=true){
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
        if( apply /*this.updateOnEvent*/ ){
            this.applyEvents();
        }
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
                if( entity && entitySet.isEntityOfInterest(entity) ){
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
            eid = components[ii].getEntityId();
            // log.debug('onComponentRemove', eid, JSON.stringify(components[ii]));
            // eid = Entity.getEntityId( components[ii] );
            if( entitySet.hasEntity( eid ) ){
                this.changedEntityList[ eid ] = eid;
                this.isModified = true;
            }
        }

        // log.debug('onComponentRemove', this.updateOnEvent, JSON.stringify(components));
        if( this.updateOnEvent ){
            this.applyEvents();
        }
    },

    /**
    *   
    */
    applyEvents: function(options={}){
        let ii,len,com,entity;
        let entitySet;
        let query;
        let changedEntityIdList;
        let entitiesAdded;
        let entitiesRemoved;
        let changeOptions;
        let debug = options.debug;

        
        if( !this.isModified ){
            if( debug ){ log.debug('not modified');}
            return;
        }

        entitySet = this.entitySet;
        query = this.getQuery();
        entitiesAdded = [];
        entitiesRemoved = [];
        changeOptions = {silent:true};


        // if( debug ){
        //     printE( _.values(this.addedEntities) );
        // }
        // add entities
        _.each( this.addedEntities, (entity, eid) => {
            if( query && !entitySet.isEntityOfInterest(entity, query ) ){
                return;
            }
            entitySet.add( entity, changeOptions );
            if( debug ){ log.debug('addedEntities includes ' + stringify(entity) + ' ' + eid); }
            entitiesAdded.push( entity );
        });

        // remove entities
        _.each( this.removedEntities, entity => {
            entitySet.remove( entity, changeOptions );
            if( debug ){ log.debug( entitySet.cid + ' removed entity ' + entity.id ); }
            entitiesRemoved.push( entity );
        });

        // entities that have changed due to component movement - remove if no longer valid
        changedEntityIdList = _.values( this.changedEntityList );
        if( changedEntityIdList.length > 0 ){
            entitiesRemoved = entitiesRemoved.concat( 
                entitySet.evaluateEntities(changedEntityIdList, changeOptions) );

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
            // log.debug('+triggering add entities ' + stringify(entitiesAdded) );
            entitySet.trigger('entity:add', entitiesAdded );
        }

        if( entitiesRemoved.length > 0 ){
            entitySet.trigger('entity:remove', entitiesRemoved );
        }

        entitiesAdded = null;
        entitiesRemoved = null;
        this.addedEntities = clearMap( this.addedEntities );
        this.removedEntities = clearMap( this.removedEntities );
        this.changedEntityList = clearMap( this.changedEntityList );
        this.isModified = false;
    },


    hash: function(){
        let q;
        // start with the entitysets hash
        let str = _.result( this.targetEntitySet, 'hash' );
        if( (q = this.getQuery()) ){
            str += q.hash();
        }
        return hash( str, true );
    },
});

EntitySetListener.create = function(){
    return new EntitySetListener();
}


export default EntitySet;