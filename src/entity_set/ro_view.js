import Base from '../base';
import EntitySet from './index';
import Query from '../query';
import createUUID from '../util/uuid';
import propertyResult from '../util/result';
import uniqueId from '../util/unique_id';
import stringify from '../util/stringify';
import QueryFilter from '../query/through';
import { applyQueryFilter } from '../query/through';
import { toString as entityToString } from '../util/to_string';

/**
 * An index into an entityset
 *
 * @param {*} entities
 * @param {*} options
 */
export function ReadOnlyView(entitySet, query, options = {}) {
    this.id = options.id || 0;
    this._uuid = options.uuid || createUUID();
    this.cid = uniqueId('ev');
    this.entitySet = entitySet;

    this.deferEvents = propertyResult( options, 'deferEvents', false);
    this.debug = propertyResult( options, 'debug', false);

    query = Query.toQuery(query);
    this.query = query;
    this.queryId = query ? query.hash() : 'all';

    this._entityIds = [];
    this._entityIdMap = {};

    this._deferedAddEntities = [];
    this._deferedRemoveEntities = [];

    this._reset();
    this._addListeners();
}

export function create(entitySet, query, options = {}) {
    return new ReadOnlyView(entitySet, query, options);
}

Object.assign(ReadOnlyView.prototype, Base.prototype, {
    /**
     * Returns the id of the entitySet
     */
    getEntitySetId() {
        return this.entitySet.getEntitySetId();
    },

    /**
     *
     */
    getUuid() {
        return this._uuid;
    },

    /**
     *
     */
    getUUID() {
        return this._uuid;
    },

    /**
     * Adds an entity to the source entitySet
     * 
     * @param {*} entity 
     * @param {*} options 
     */
    addEntity(entity, options) {
        return this.entitySet.addEntity(entity,options);
    },

    /**
     * Removes an entity from the source entitySet
     * @param {*} entity 
     * @param {*} options 
     */
    removeEntity(entity, options) {
        return this.entitySet.removeEntity(entity,options);
    },

    /**
     * Adds a component to the source entitySet
     * @param {*} component 
     * @param {*} options 
     */
    addComponent(component, options) {
        return this.entitySet.addComponent(component,options);
    },

    /**
     * Removes a component from the source entitySet
     * @param {*} component 
     * @param {*} options 
     */
    removeComponent(component, options) {
        return this.entitySet.removeComponent(component,options);
    },

    /**
     * @private
     */
    _reset() {
        let ii = 0,
            length = this.entitySet.size();

        for (ii; ii < length; ii++) {
            let entity = this.entitySet.at(ii);
            if (applyQueryFilter(this.query, entity)) {
                this._add(entity);
            }
        }
    },

    /**
     *
     * @param {*} entity
     * @private
     */
    _add(entity) {
        // check whether we already have this entity
        if (this._entityIdMap[entity.id] !== undefined) {
            return;
        }

        this._entityIds.push(entity.id);
        this._entityIdMap[entity.id] = entity.id;
        return entity;
    },

    /**
     *
     * @param {*} entity
     * @private
     */
    _remove(entity) {
        const id = entity.id;
        const index = this._entityIds.indexOf(id);
        // console.log(`[ROView][${this.cid}][_remove]`, id, index, this._entityIds );
        if (index === -1) {
            return;
        }
        this._entityIds.splice(index, 1);
        delete this._entityIdMap[id];
        return entity;
    },

    /**
     * Returns the number of entities in this view
     */
    size() {
        return this._entityIds.length;
    },

    /**
     * Returns the entity at the specified index
     */
    at(index) {
        return this.entitySet._entities.get(this._entityIds[index]);
    },

    /**
     * Returns the entity by an id
     *
     * @param {*} entityId
     */
    getByEntityId(entityId) {
        return this.entitySet.getByEntityId(entityId);
    },

    /**
     *
     * @param {*} options
     */
    iterator(options) {
        let nextIndex = 0;
        return {
            next: () => {
                return nextIndex < this.size() ? { value: this.at(nextIndex++), done: false } : { done: true };
            }
        };
    },


    /**
     * Applies any defered add/remove entity events this view might have received
     * @param {*} options 
     */
    applyEvents( options={} ){
        let ii, len;
        let added = [];
        let removed = [];
        const debug = this.debug || options.debug;

        if( debug ) console.log(`[ROView][applyEvents][${this.cid}][add]`, this._deferedAddEntities.length, (this._deferedAddEntities.map(e=>e.id) ), options.debug, this.debug );

        for( ii=0, len=this._deferedAddEntities.length; ii<len; ii++ ){
            let entity = this._deferedAddEntities[ii];
            let add = this._add(entity);
            if (add) {
                added.push(add);
            }
        }

        if( debug ) console.log(`[ROView][applyEvents][${this.cid}][remove]`, this._deferedRemoveEntities.length, (this._deferedRemoveEntities.map(e=>e.id)) );

        for( ii=0, len=this._deferedRemoveEntities.length; ii<len; ii++ ){
            let entity = this._deferedRemoveEntities[ii];
            let remove = this._remove(entity);
            if (remove) {
                removed.push(remove);
            }
        }

        this._deferedAddEntities = [];
        this._deferedRemoveEntities = [];

        if (added.length) {
            this.trigger('entity:add', added);
        }

        if (removed.length) {
            this.trigger('entity:remove', removed);
        }
    },

    /**
     * @private
     */
    _addListeners() {
        // this.listenTo( this.entitySet, 'all', (name,objs) => console.log('received', name, objs.map(o => o.id) ));
        this.listenTo(this.entitySet, 'entity:add', this._onEntityAdd.bind(this));
        this.listenTo(this.entitySet, 'entity:remove', this._onEntityRemove.bind(this));
        this.listenTo(this.entitySet, 'entity:update', this._onEntityUpdate.bind(this));

        this.listenTo(this.entitySet, 'entity:event', this._onEntityEvent.bind(this));
        // this.listenTo(this.entitySet, 'component:add', this._onComponentAdd.bind(this));
        // this.listenTo(this.entitySet, 'component:remove', this._onComponentUpdate.bind(this));
    },

    /**
     * @private
     */
    _removeListeners() {
        this.stopListening(this.entitySet, 'entity:add');
        this.stopListening(this.entitySet, 'entity:remove');
        this.stopListening(this.entitySet, 'entity:update');
        this.stopListening(this.entitySet, 'entity:event');
    },

    /**
     * Handles entity events received from the EntitySet.
     *  
     * @param {*} name 
     * @param {*} entity 
     * @param {*} args 
     * @private
     */
    _onEntityEvent(name, entity, entitySet, ...args ){
        if (applyQueryFilter(this.query, entity)) {
            this.trigger.apply(this, [name, entity, this, ...args]);
        }
    },

    /**
     *
     * @param {*} entities
     * @private
     */
    _onEntityAdd(entities) {
        let ii,
            length = entities.length;
        let added = [];

        for (ii = 0; ii < length; ii++) {
            let entity = entities[ii];
            if (applyQueryFilter(this.query, entity)) {
                if( this.deferEvents ){
                    this._deferedAddEntities.push( entity );
                    break;
                }
                let add = this._add(entity);
                if (add) {
                    added.push(add);
                }
            }
        }

        if (added.length) {
            this.trigger('entity:add', added);
        }
    },

    /**
     *
     * @param {*} entities
     * @private
     */
    _onEntityRemove(entities) {
        let ii,
            length = entities.length;
        let removed = [];
        if( this.debug ) console.log(`[ROView][${this.cid}][_onEntityRemove]`, 'entities', length, entities.map(e=>e.id), 'size', this._entityIds );
        
        for (ii = 0; ii < length; ii++) {
            let entity = entities[ii];
            if( this.deferEvents ){
                this._deferedRemoveEntities.push( entity );
                break;
            }
            let remove = this._remove(entity);
            
            if (remove) {
                removed.push(remove);
            }
        }
        if (removed.length) {
            // console.log(`[ROView][${this.cid}][_onEntityRemove]`, 'removed', entities.map(e=>e.id), 'size', this._entityIds );
            this.trigger('entity:remove', removed);
        }
    },

    /**
     *
     * @param {*} entities
     * @private
     */
    _onEntityUpdate(entities) {
        let ii,
            length = entities.length;
        let removed = [];
        let added = [];

        // console.log(`[ROView][_onEntityUpdate][${this.cid}]`, 'entities', entityToString(entities));

        for (ii = 0; ii < length; ii++) {
            let entity = entities[ii];
            // console.log(`[ROView][_onEntityUpdate][${this.cid}]`, 'check', entity.id );

            if (!applyQueryFilter(this.query, entity)) {
                // console.log(`[ROView][_onEntityUpdate][${this.cid}]`, 'fail', entity.id );
                if( this.deferEvents ){
                    this._deferedRemoveEntities.push( entity );
                    break;
                }
                let remove = this._remove(entity);
                if (remove) {
                    removed.push(remove);
                }
            } else {
                // console.log(`[ROView][_onEntityUpdate][${this.cid}]`, 'unknown!', entity.id );

                if( this.deferEvents ){
                    this._deferedAddEntities.push( entity );
                    break;
                }
                let add = this._add(entity);
                if (add) {
                    added.push(add);
                }
            }

        }

        if (removed.length) {
            this.trigger('entity:remove', removed);
        }

        if (added.length) {
            this.trigger('entity:add', added);
        }
    },

    /**
     *
     * @param {*} components
     * @private
     */
    // _onComponentAdd(components) {},

    /**
     *
     * @param {*} components
     * @private
     */
    // _onComponentUpdate(components) {
    //     let ii, length = components.length;
    //     let entityIds = {};

    //     console.log('[ROView][_onComponentUpdate]', 'components', (components));

    //     for(ii=0; ii < length; ii++ ){
    //         let component = components[ii];
    //         let entityId = component.getEntityId();
    //         entityIds[entityId] = entityId;
    //     }

    //     console.log('[ROView][_onComponentUpdate]', 'entityIds', entityIds);

    //     let removed = Object.values(entityIds).reduce( (removed,eid) => {
    //         let entity = this.getByEntityId(eid);
    //         if( !entity ){
    //             return removed;
    //         }
    //         if (!applyQueryFilter(this.query, entity)) {
    //             let remove = this._remove(entity);
    //             if (remove) {
    //                 removed.push(remove);
    //             }
    //         }
    //     }, []);

    //     if (removed.length) {
    //         console.log('[ROView][_onComponentUpdate]', stringify(removed) );
    //         this.trigger('entity:remove', removed);
    //     }
    // },


    
});

ReadOnlyView.prototype.type = 'EntitySetReadOnlyView';
ReadOnlyView.prototype.isMemoryEntitySet = true;
ReadOnlyView.prototype.isReadOnlyView = true;
ReadOnlyView.prototype.isEntitySetView = true;
