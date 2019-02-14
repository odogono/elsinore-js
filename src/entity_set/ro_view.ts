// import { stringify } from '../util/stringify';
import { QueryFilter, applyQueryFilter } from '../query/through';

import { Base } from '../base';
import { Entity } from 'src/entity';
import { EntityEvent } from 'src/types';
import { EntitySet } from './index'
// import { EntitySet } from './index';
import { Query } from '../query';
import { createUUID } from '../util/uuid';
import { toString as entityToString } from '../util/to_string';
import { propertyResult } from '../util/result';
import { uniqueID } from '../util/unique_id';

export function create( entitySet:EntitySet, query?:Query, options:any = {} ){
    return new ReadOnlyView(entitySet, query, options);
}

export class ReadOnlyView extends Base {

    readonly type:string = 'EntitySetReadOnlyView';
    
    readonly isMemoryEntitySet:boolean = true;
    
    readonly isEntitySet:boolean = true;

    readonly isReadOnlyView:boolean = true;
    
    readonly isAsync:boolean = false;
    
    entitySet: EntitySet;

    deferEvents: boolean;
    debug: false;

    query?:Query;
    queryID:string|number = 'all';

    _entityIDs:number[] = [];
    _entityIDMap:{} = {};

    _deferedAddEntities:Entity[] = [];
    _deferedRemoveEntities:Entity[] = [];

    constructor( entitySet:EntitySet, query?:Query, options:any = {} ){
        super(options);
        
        this.entitySet = entitySet;
    
        this.deferEvents = propertyResult(options, 'deferEvents', false);
        this.debug = propertyResult(options, 'debug', false);
    
        query = Query.toQuery(query);
        this.query = query;
        this.queryID = query ? query.hash() : 'all';
    
    
        this._reset();
        this._addListeners();
    }

    /**
     * Returns a prefix which is attached to the instances cid
     */
    getCIDPrefix() : string {
        return 'ev';
    }

    /**
     * Returns the id of the entitySet
     */
    getEntitySetID() {
        return this.entitySet.getEntitySetID();
    }

    /**
     * Adds an entity to the source entitySet
     *
     * @param {*} entity
     * @param {*} options
     */
    addEntity(entity, options) {
        return this.entitySet.addEntity(entity, options);
    }

    /**
     * Removes an entity from the source entitySet
     * @param {*} entity
     * @param {*} options
     */
    removeEntity(entity, options) {
        return this.entitySet.removeEntity(entity, options);
    }

    /**
     * Adds a component to the source entitySet
     * @param {*} component
     * @param {*} options
     */
    addComponent(component, options) {
        return this.entitySet.addComponent(component, options);
    }

    /**
     * Removes a component from the source entitySet
     * @param {*} component
     * @param {*} options
     */
    removeComponent(component, options) {
        return this.entitySet.removeComponent(component, options);
    }

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
    }

    /**
     *
     * @param {*} entity
     * @private
     */
    _add(entity) {
        // check whether we already have this entity
        if (this._entityIDMap[entity.id] !== undefined) {
            return;
        }

        this._entityIDs.push(entity.id);
        this._entityIDMap[entity.id] = entity.id;
        return entity;
    }

    /**
     *
     * @param {*} entity
     * @private
     */
    _remove(entity) {
        const id = entity.id;
        const index = this._entityIDs.indexOf(id);
        // console.log(`[ROView][${this.cid}][_remove]`, id, index, this._entityIDs );
        if (index === -1) {
            return;
        }
        this._entityIDs.splice(index, 1);
        delete this._entityIDMap[id];
        return entity;
    }

    /**
     * Returns the number of entities in this view
     */
    size() {
        return this._entityIDs.length;
    }

    /**
     * Returns the entity at the specified index
     */
    at(index) {
        return this.entitySet._entities.get(this._entityIDs[index]);
    }

    /**
     * Returns the entity by an id
     *
     * @param {*} entityID
     */
    getByEntityID(entityID) {
        return this.entitySet.getByEntityID(entityID);
    }

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
    }

    /**
     * Applies any defered add/remove entity events this view might have received
     * @param {*} options
     */
    applyEvents(options:any = {}) {
        let ii, len;
        let added = [];
        let removed = [];
        const debug = this.debug || options.debug;

        // if (debug)
        //     console.log(
        //         `[ROView][applyEvents][${this.cid}][add]`,
        //         this._deferedAddEntities.length,
        //         this._deferedAddEntities.map(e => e.id),
        //         options.debug,
        //         this.debug
        //     );

        for (ii = 0, len = this._deferedAddEntities.length; ii < len; ii++) {
            let entity = this._deferedAddEntities[ii];
            let add = this._add(entity);
            if (add) {
                added.push(add);
            }
        }

        // if (debug)
        //     console.log(
        //         `[ROView][applyEvents][${this.cid}][remove]`,
        //         this._deferedRemoveEntities.length,
        //         this._deferedRemoveEntities.map(e => e.id)
        //     );

        for (ii = 0, len = this._deferedRemoveEntities.length; ii < len; ii++) {
            let entity = this._deferedRemoveEntities[ii];
            let remove = this._remove(entity);
            if (remove) {
                removed.push(remove);
            }
        }

        this._deferedAddEntities = [];
        this._deferedRemoveEntities = [];

        if (added.length) {
            this.trigger( EntityEvent.EntityAdd, added);
        }

        if (removed.length) {
            this.trigger(EntityEvent.EntityRemove, removed);
        }
    }

    /**
     * @private
     */
    _addListeners() {
        // this.listenTo( this.entitySet, 'all', (name,objs) => console.log('received', name, objs.map(o => o.id) ));
        this.listenTo(this.entitySet, EntityEvent.EntityAdd, this._onEntityAdd.bind(this));
        this.listenTo(this.entitySet, EntityEvent.EntityRemove, this._onEntityRemove.bind(this));
        this.listenTo(this.entitySet, EntityEvent.EntityUpdate, this._onEntityUpdate.bind(this));

        this.listenTo(this.entitySet, EntityEvent.EntityEvent, this._onEntityEvent.bind(this));
        // this.listenTo(this.entitySet, 'component:add', this._onComponentAdd.bind(this));
        // this.listenTo(this.entitySet, 'component:remove', this._onComponentUpdate.bind(this));
    }

    /**
     * @private
     */
    _removeListeners() {
        this.stopListening(this.entitySet, EntityEvent.EntityAdd);
        this.stopListening(this.entitySet, EntityEvent.EntityRemove);
        this.stopListening(this.entitySet, EntityEvent.EntityUpdate);
        this.stopListening(this.entitySet, EntityEvent.EntityEvent);
    }

    /**
     * Handles entity events received from the EntitySet.
     *
     * @param {*} name
     * @param {*} entity
     * @param {*} args
     * @private
     */
    _onEntityEvent(name, entity, entitySet, ...args) {
        if (applyQueryFilter(this.query, entity)) {
            this.trigger.apply(this, [name, entity, this, ...args]);
        }
    }

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
                if (this.deferEvents) {
                    this._deferedAddEntities.push(entity);
                    break;
                }
                let add = this._add(entity);
                if (add) {
                    added.push(add);
                }
            }
        }

        if (added.length) {
            this.trigger( EntityEvent.EntityAdd, added);
        }
    }

    /**
     *
     * @param {*} entities
     * @private
     */
    _onEntityRemove(entities) {
        let ii,
            length = entities.length;
        let removed = [];
        // if (this.debug)
        //     console.log(
        //         `[ROView][${this.cid}][_onEntityRemove]`,
        //         'entities',
        //         length,
        //         entities.map(e => e.id),
        //         'size',
        //         this._entityIDs
        //     );

        for (ii = 0; ii < length; ii++) {
            let entity = entities[ii];
            if (this.deferEvents) {
                this._deferedRemoveEntities.push(entity);
                break;
            }
            let remove = this._remove(entity);

            if (remove) {
                removed.push(remove);
            }
        }
        if (removed.length) {
            // console.log(`[ROView][${this.cid}][_onEntityRemove]`, 'removed', entities.map(e=>e.id), 'size', this._entityIDs );
            this.trigger( EntityEvent.EntityRemove, removed);
        }
    }

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
                if (this.deferEvents) {
                    this._deferedRemoveEntities.push(entity);
                    break;
                }
                let remove = this._remove(entity);
                if (remove) {
                    removed.push(remove);
                }
            } else {
                // console.log(`[ROView][_onEntityUpdate][${this.cid}]`, 'unknown!', entity.id );

                if (this.deferEvents) {
                    this._deferedAddEntities.push(entity);
                    break;
                }
                let add = this._add(entity);
                if (add) {
                    added.push(add);
                }
            }
        }

        if (removed.length) {
            this.trigger( EntityEvent.EntityRemove, removed);
        }

        if (added.length) {
            this.trigger( EntityEvent.EntityAdd, added);
        }
    }

}
