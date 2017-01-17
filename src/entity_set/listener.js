import _ from 'underscore';

import Entity from '../entity';

import {
    clearMap,
    hash
} from '../util';

// import {createLog} from '../util/log';
// const Log = createLog('EntitySetListener');

/**
 * The EntitySet listener keeps track of one entitySet listening to enother.
 */
export default class EntitySetListener {

    setQuery(q){
        this._query = q;
    }
    getQuery(){
        return this._query;
    }

    /**
    *   srcEntitySet listens to targetEntitySet using the specified query
    */
    listenToEntitySet(srcEntitySet, targetEntitySet, query){
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
        //     log.debug('listen to es change ' + stringify(args) );
        // })
    }

    /**
     * 
     */
    onEntityAdd( entities, apply=true ){
        this.entitySet.isModified = true;
        
        _.each( entities, e => {
            const eid = Entity.toEntityId( e );
            this.addedEntities[ eid ] = e;
            this.isModified = true;
        });
        

        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        if( apply /*this.updateOnEvent*/ ){
            this.applyEvents();
        }
    }

    /**
     * 
     */
    onEntityRemove(entities, apply=true){
        _.each( entities, e => {
            const eid = Entity.toEntityId( e );
            if( !this.entitySet.get(eid) ){
                return;
            }
            delete this.addedEntities[ eid ];
            this.removedEntities[ eid ] = e;
            this.isModified = true;
        });
        
        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        if( apply /*this.updateOnEvent*/ ){
            this.applyEvents();
        }
    }

    onComponentAdd(components){
        let entitySet = this.entitySet;
        let entity;

        // Log.debug( entitySet.cid + '_oCA ' + stringify(components) );
        _.each( components, component => {
            const eid = Entity.getEntityId( component );
            
            if( entitySet.hasEntity(eid) ){
                this.changedEntityList[ eid ] = eid;
                this.isModified = true;
                // Log.debug(`[onComponentAdd]`, 'hasEntity', eid, stringify(component) ); 
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

        // Log.debug(`[onComponentAdd]`, this.updateOnEvent );
        // if none of these components are of interest, then no need to update
        if( this.updateOnEvent ){
            this.applyEvents();
        }
    }

    onComponentRemove(components){
        let ii,len,eid;
        let entitySet = this.entitySet;

        // reduce down to components we are interested in
        for(ii=0,len=components.length;ii<len;ii++ ){
            eid = components[ii].getEntityId();
            // log.debug('onComponentRemove', eid, stringify(components[ii]));
            // eid = Entity.getEntityId( components[ii] );
            if( entitySet.hasEntity( eid ) ){
                this.changedEntityList[ eid ] = eid;
                this.isModified = true;
            }
        }

        // log.debug('onComponentRemove', this.updateOnEvent, stringify(components));
        if( this.updateOnEvent ){
            this.applyEvents();
        }
    }

    /**
    *   
    */
    applyEvents(options={}){
        let entitySet;
        let query;
        let changedEntityIdList;
        let entitiesAdded;
        let entitiesRemoved;
        let changeOptions;

        
        if( !this.isModified ){
            // if( debug ){ log.debug('not modified');}
            return;
        }
        // Log.debug(`[applyEvents]`, stringify(this.addedEntities));

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
            
            if( query && !entitySet.isEntityOfInterest(entity, query) ){
                return;
            }
            entitySet.add( entity, changeOptions );
            // if( debug ){ Log.debug('addedEntities includes ' + stringify(entity) + ' ' + eid); }
            entitiesAdded.push( entity );
        });

        // remove entities
        _.each( this.removedEntities, entity => {
            entitySet.remove( entity, changeOptions );
            // if( debug ){ Log.debug( entitySet.cid + ' removed entity ' + entity.id ); }
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
    }


    hash(){
        let q;
        // start with the entitysets hash
        let str = _.result( this.targetEntitySet, 'hash' );
        if( (q = this.getQuery()) ){
            str += q.hash();
        }
        return hash( str, true );
    }
}

EntitySetListener.create = function( srcEntitySet, targetEntitySet, query, options ){
    let listener = new EntitySetListener();

    // srcEntitySet.listeners || (srcEntitySet.listeners={});
    // are we already listening to this entityset?
    // srcEntitySet.listeners[ targetEntitySet.cid ] = listener;

    listener.updateOnEvent = !!options.updateOnEvent;

    srcEntitySet.setQuery( query );

    listener.listenToEntitySet( srcEntitySet, targetEntitySet, query );
    
    // reset causes entities to be copied over?
    srcEntitySet.reset( targetEntitySet );

    return listener;
}

EntitySetListener.prototype.type = 'EntitySetListener';
EntitySetListener.prototype.isEntitySetListener = true;
