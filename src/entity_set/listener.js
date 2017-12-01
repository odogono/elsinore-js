import Entity from '../entity';

import hash from '../util/hash';
import uniqueId from '../util/unique_id';
import Base from '../base';

import { createLog } from '../util/log';
const Log = createLog('EntitySetListener');

export default function EntitySetListener(srcEntitySet, targetEntitySet, query, options = {}) {
    this.cid = uniqueId('esl');

    this.updateOnEvent = !!options.updateOnEvent;

    // srcEntitySet.setQuery(query);

    this.listenToEntitySet(srcEntitySet, targetEntitySet, query);

    // reset causes entities to be copied over?
    srcEntitySet.reset(targetEntitySet);
}

EntitySetListener.create = function(srcEntitySet, targetEntitySet, query, options) {
    let listener = new EntitySetListener(srcEntitySet, targetEntitySet, query, options);
    return listener;
};

/**
 * The EntitySet listener keeps track of one entitySet listening to enother.
 */
Object.assign(EntitySetListener.prototype, Base.prototype, {
    setQuery(q) {
        this._query = q;
    },

    getQuery() {
        return this._query;
    },

    /**
    *   srcEntitySet listens to targetEntitySet using the specified query
    */
    listenToEntitySet(srcEntitySet, targetEntitySet, query) {
        this.entitySet = srcEntitySet;
        this.targetEntitySet = targetEntitySet;
        this.setQuery(query);

        this.changedEntityList = {};
        this.addedEntities = {};
        this.removedEntities = {};

        // Log.debug('[listenToEntitySet]', srcEntitySet.cid, targetEntitySet.cid);
        // _.bindAll(this, 'onEntityAdd', 'onEntityRemove', 'onComponentAdd', 'onComponentRemove');
        srcEntitySet.listenTo(targetEntitySet, 'entity:add', this.onEntityAdd.bind(this));
        srcEntitySet.listenTo(targetEntitySet, 'entity:remove', this.onEntityRemove.bind(this));
        srcEntitySet.listenTo(targetEntitySet, 'component:add', this.onComponentAdd.bind(this));
        srcEntitySet.listenTo(targetEntitySet, 'component:remove', this.onComponentRemove.bind(this));
        // srcEntitySet.listenTo( targetEntitySet, 'component:update', (...args) => {
        //     log.debug('listen to es change ' + stringify(args) );
        // })
    },

    /**
     * 
     */
    onEntityAdd(entities, apply = true) {
        this.entitySet.isModified = true;

        entities.forEach(e => {
            const eid = Entity.toEntityId(e);
            this.addedEntities[eid] = e;
            this.isModified = true;
        });

        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        if (apply /*this.updateOnEvent*/) {
            this.applyEvents();
        }
    },

    /**
     * 
     */
    onEntityRemove(entities, apply = true) {
        entities.forEach(e => {
            const eid = Entity.toEntityId(e);
            if (!this.entitySet.get(eid)) {
                return;
            }
            delete this.addedEntities[eid];
            this.removedEntities[eid] = e;
            this.isModified = true;
        });

        // instantanous updating of a view is probably the best policy
        // when it comes to adding/removing entities
        if (apply /*this.updateOnEvent*/) {
            this.applyEvents();
        }
    },

    isEntityOfInterest(entity) {
        const query = this.getQuery();
        if (!query) {
            return true;
        }
        const tEntity = query.execute(entity);
        return tEntity ? true : false;
    },

    /**
     * 
     * @param {*} components 
     */
    onComponentAdd(components) {
        let entitySet = this.entitySet;
        let entity;

        // Log.debug( entitySet.cid + '_oCA ' + stringify(components) );
        components.forEach(component => {
            const eid = Entity.getEntityId(component);

            if (entitySet.hasEntity(eid)) {
                this.changedEntityList[eid] = eid;
                this.isModified = true;
                // Log.debug(`[onComponentAdd]`, 'hasEntity', eid, stringify(component) );
            } else {
                // this is the situation where a component is being added
                // but the containing entity doesn't already exist in the
                // listening entitySet - in this case the entity has to be
                // added before the component can
                entity = this.targetEntitySet.getEntity(eid);
                if (entity && this.isEntityOfInterest(entity)) {
                    this.isModified = true;
                    this.addedEntities[eid] = entity;
                }
            }
        });

        // Log.debug(`[onComponentAdd]`, this.updateOnEvent );
        // if none of these components are of interest, then no need to update
        if (this.updateOnEvent) {
            this.applyEvents();
        }
    },

    /**
     * 
     * @param {*} components 
     */
    onComponentRemove(components) {
        let ii, len, eid;
        let entitySet = this.entitySet;

        // reduce down to components we are interested in
        for (ii = 0, len = components.length; ii < len; ii++) {
            eid = components[ii].getEntityId();
            // log.debug('onComponentRemove', eid, stringify(components[ii]));
            // eid = Entity.getEntityId( components[ii] );
            if (entitySet.hasEntity(eid)) {
                this.changedEntityList[eid] = eid;
                this.isModified = true;
            }
        }
        if (this.updateOnEvent) {
            this.shit = true;
            this.applyEvents();
        }
    },

    /**
    *   
    */
    applyEvents(options = {}) {
        let entitySet;
        let query;
        let changedEntityIdList;
        let entitiesAdded;
        let entitiesRemoved;
        let changeOptions;

        if (!this.isModified) {
            return;
        }
        // Log.debug(`[applyEvents]`, stringify(this.addedEntities));
        entitySet = this.entitySet;
        query = this.getQuery();
        entitiesAdded = [];
        entitiesRemoved = [];
        changeOptions = { silent: true };

        // add entities

        // Log.debug('[applyEvents]', Object.values(this.addedEntities));
        Object.values(this.addedEntities).forEach((entity, eid) => {
            if (query && !this.isEntityOfInterest(entity)) {
                return;
            }
            entitySet.addEntity(entity, changeOptions);
            // if( debug ){ Log.debug('addedEntities includes ' + stringify(entity) + ' ' + eid); }
            entitiesAdded.push(entity);
        });

        // remove entities
        Object.values(this.removedEntities).forEach(entity => {
            entitySet.removeEntity(entity, changeOptions);
            // Log.debug('[applyEvents][removedEntities]', entity.id);
            // if( debug ){ Log.debug( entitySet.cid + ' removed entity ' + entity.id ); }
            entitiesRemoved.push(entity);
        });

        // entities that have changed due to component movement - remove if no longer valid
        // Log.debug(`[applyEvents]`, this.cid, stringify(this.changedEntityList));
        changedEntityIdList = Object.values(this.changedEntityList);

        if (changedEntityIdList.length > 0) {
            entitiesRemoved = entitiesRemoved.concat(entitySet.evaluateEntities(changedEntityIdList, changeOptions));
            // for( i=0,len=changedEntityIdList.length;i<len;i++ ){
            //     entity = entitySet.get( changedEntityIdList[i] );
            //     if( !EntitySet.isEntityOfInterest( entitySet, entity, query ) ){
            //         entitySet.remove( entity, changeOptions );
            //         entitiesRemoved.push( entity );
            //     } else {
            //     }
            // }
        }

        if (entitiesAdded.length > 0) {
            // log.debug('+triggering add entities ' + stringify(entitiesAdded) );
            entitySet.trigger('entity:add', entitiesAdded);
        }

        if (entitiesRemoved.length > 0) {
            entitySet.trigger('entity:remove', entitiesRemoved);
        }

        entitiesAdded = null;
        entitiesRemoved = null;
        this.addedEntities = {};
        this.removedEntities = {};
        this.changedEntityList = {};
        this.isModified = false;
    },

    hash() {
        let q;
        // start with the entitysets hash
        let str = _.result(this.targetEntitySet, 'hash');
        if ((q = this.getQuery())) {
            str += q.hash();
        }
        return hash(str, true);
    }
});

EntitySetListener.prototype.type = 'EntitySetListener';
EntitySetListener.prototype.isEntitySetListener = true;
