import { Base } from './base';
import { Collection } from './util/collection';
import { EntityEvent } from 'src/types';
import { EntityProcessor } from './entity_processor';
import { EntitySet } from './entity_set';
import { Events } from './util/events';
import { Query } from './query/full';
import { Registry } from './registry/index';
import { arrayWithout } from './util/array/without';
import { create as createEntitySetIndex } from './entity_set/ro_view';
import { createLog } from './util/log';
import { toString as entityToString } from './util/to_string';
import { isEntitySet } from './util/is';
import { isEntitySetView } from './entity_set/view';
import { uniqueID } from './util/unique_id';

const Log = createLog('EntityDispatch');

export interface EntityProcessorEntry {
    id: number | string;
    processor: EntityProcessor,
    createdAt: number;
    updatedAt: number;
    executedAt: number;
    priority: number;
    interval: number;
    query?: Query;
    queryID?: string;
}



/**
 * @class EntityDispatch
 */

export class EntityDispatch extends Base {

    registry: Registry;
    entitySet: EntitySet;
    processorEntries: Collection<EntityProcessorEntry>;
    executedAt: number;
    time: number;
    _views: EntitySet[];
    _viewsToProcessors: any;

    constructor(registry:Registry, entitySet:EntitySet){
        super();
        this.registry = registry;
        this.entitySet = entitySet;
        this.processorEntries = new Collection();
        this.processorEntries.comparator = (a, b) => a.priority > b.priority;
        this.executedAt = Date.now();
        this.time = 0;
    }


    /**
     * Sets the EntitySet that this dispatcher will use.
     * if null, the existing entitySet and all derived views will be cleared
     */
    setEntitySet(entitySet) {
        if (entitySet == null) {
            // remove all views created from the entityset
            // this._removeViews();
        }
        this.entitySet = entitySet;
    }

    /**
     * Returns an array of all the processors registered
     */
    getProcessors() {
        return this.processorEntries.map(e => e.processor);
    }

    /**
     * Adds a processor to the dispatch
     *
     * @param {object} processor - a processor class or instance to add
     * @param {function} query - the query that will filter the entityset to the processors liking
     * @returns {object} returns the record describing the processor
     */
    addProcessor(processor, query:Query, options:any = {}) {
        // let filter;
        if (!processor) {
            return null;
        }

        if (!EntityProcessor.isEntityProcessor(processor)) {
            // check whether a class
            // if( false && typeof processor.create === 'function') ){
            // processor = processor.create();
            // } else
            if (typeof processor === 'function') {
                processor = new processor();
            }
            if (!EntityProcessor.isEntityProcessor(processor)) {
                throw new Error('invalid processor added');
            }
            processor.registry = this.registry;
        }

        query = query || processor.query || processor.entityFilter;

        let entry:EntityProcessorEntry = {
            id: processor.id || uniqueID('procdisp'),
            processor: processor,
            createdAt: 0,
            updatedAt: -1,
            executedAt: Date.now(),
            priority: options.priority === void 0 ? 0 : options.priority,
            interval: options.interval === void 0 ? 0 : options.interval,
            query: null,
            queryID: null
        };
        
        processor._priority = entry.priority;

        // Log.debug('[addProcessor]', 'added processor', processor.id, processor.constructor.name );

        // let entry = new Entry(entryAttrs);

        if (query) {
            // Log.debug('we have query', query);
            // NOTE: we are not doing anything other than ensuring the query is compiled
            // eventually we should be caching identical queries
            processor.entityFilter = Query.toQuery(query);
            entry.query = processor.entityFilter;
            entry.queryID = processor.entityFilter.hash();
        }

        this.processorEntries.add(entry);

        if (this.entitySet) {
            this._mapEntitySetToProcessor(entry, options);

            // if the processor has event listeners defined, connect those to the entityset
            this._attachProcessorEvents(entry, options);
        }

        return entry;
    }

    /**
     * Passes the entity to each of the registered processors in turn
     *
     * @param {object} entity - an entity or entityset that will be passed to the processor
     * @param {timeMs} timeMs - the time in milliseconds
     */
    execute(entity, timeMs, debug) {
        let entityArray = Array.isArray(entity) ? entity : [entity];

        // add the updated time to this dispatches idea of what the current time is
        this.time += timeMs;

        this.processorEntries.forEach(entry => {
            const interval = entry.interval;
            const query = entry.query;
            const processor = entry.processor;

            // if( entry.get('updatedAt') >= 0 && (entry.get('interval') + entry.get('updatedAt') > timeMs) ){
            //     return;
            // }
            if (interval) {
                const lastExecutedAt = entry.executedAt;
                // if( debug ) Log.debug(`execute last ${lastExecutedAt} + ${interval} > ${this.time}`);
                if (lastExecutedAt !== -1 && lastExecutedAt + interval > this.time) {
                    return;
                }
                // Log.debug(`execute @ ${this.time}`)
            }

            // const deltaTime = timeMs - entry.executedAt;
            entry.executedAt = this.time;

            if (query) {
                let result = query.execute(entity);
                if (!result) {
                    return;
                }
            }

            processor.update(entityArray, timeMs);
        });
    }

    /**
     * Calls each of the registered processors to execute against
     * the dispatchers entityset.
     *
     * @param {number} timeMs - the delta of time that should be updated
     * @param {object} options
     */
    update(timeMs = 0, options:any = {}) {
        // let entitySet;
        // let entitySetID;
        // let entitySetProcessors;
        // let debug;
        // let ii,len;

        let debug = options.debug;

        // Log.debug(`adding ${timeMs} to ${this.time}`, this.processorEntries);
        // add the updated time to this dispatches idea of what the current time is
        this.time += timeMs;
        // const now = Date.now();

        // iterate through each of the entitysets which have processors
        this.processorEntries.forEach(entry => {
            const processor = entry.processor;
            const view = entry.view;
            // const priority = entry.get('priority');
            const interval = entry.interval;

            if (!!entry.isDisabled) {
                return;
            }

            // let entityArray = view ? view.models : null;

            // if( debug ) Log.debug('there now', processor.type, entry.get('processor').isEntityProcessor );
            // dispatch any events that the processor has collected
            // from the last update loop
            // if( view.deferEvents ){
            //     view.applyEvents();
            // }
            if (processor.isListeningAsync) {
                processor.isReleasingEvents = true;
                processor.releaseAsync();
                processor.isReleasingEvents = false;
            }

            // execute any queued events that the processor has received
            if (debug) {
                Log.debug(
                    '[Dispatch]',
                    'executing processor',
                    processor.constructor.name,
                    // priority,
                    'with',
                    `${view.cid}/${view.hash()} ${view.size()} entities`,
                    view._entityIDs
                );
            }

            // if the view needs updating due to entities or components being
            // added/updated/removed, then do so now
            // the view is updated /before/ it is updated - previously it was
            // after, but this might lead to dependent views/sets getting out of
            // sync
            if (view) {
                view.applyEvents();
            }

            if (interval) {
                const lastExecutedAt = entry.updatedAt;
                if (lastExecutedAt !== -1 && lastExecutedAt + interval > this.time) {
                    return;
                }
            }

            // allow the processor to process the entities
            // if( entityArray.length > 0 ){
            //     processor.onUpdate( entityArray, timeMs, options );
            // }
            // Log.debug('our processor', entry);
            processor.update(view, timeMs);

            // apply any changes to the entitySet that the processor may have queued
            // changes involve adding/removing entities and components
            // NOTE: this includes creating and destroying entities - do we want to leave these ops till after all processors have run?
            if (view) {
                processor.applyChanges();
            }

            if (debug) {
                Log.debug(
                    '[Dispatch]',
                    'finished executing processor',
                    processor.constructor.name,
                    // priority,
                    'with',
                    `${view.cid}/${view.hash()} ${view.size()} entities`,
                    view._entityIDs
                );
            }
            // if( debug && view.cid == 'ev38' ) Log.debug('[update]🐲 view', view.cid, this.time, entityToString(view) );
            entry.updatedAt = this.time;
        });
    }

    /**
     * Async version of above
     */
    updateAsync(timeMs, options = {}) {
        return Promise.resolve(true);
    }

    /**
     *
     * @param {*} entry
     * @param {*} options
     * @private
     */
    _mapEntitySetToProcessor(entry, options = {}) {
        const queryID = entry.queryID;
        const query = entry.query;
        const processor = entry.processor;
        // const debug = options.debug;

        if (!query) {
            // console.log('[Dispatch][_mapEntitySetToProcessor]', 'no query so using es');
            // console.log( entityToString(this._entitySet) );
            entry.view = createEntitySetIndex(this.entitySet, null, { deferEvents: false });
        } else {
            if (!this._views) {
                this._views = [];
            }
            let view = this._views[queryID];
            if (!view) {
                throw new Error('not yet implemented - uncomment line below');
                // view = createEntitySetIndex(this.entitySet, query, { deferEvents: false });
                this.trigger(EntityEvent.ViewCreate, view);
            }

            this._addProcessorToView(queryID, view, entry);
        }

        processor.view = processor.entitySet = entry.view;

        return entry;
    }

    /**
     * Connects entity events originating from the entityset to the processors
     * listeners.
     * @param {*} entry
     * @param {*} options
     * @private
     */
    _attachProcessorEvents(entry, options) {
        const processor = entry.processor;
        const entitySet = processor.entitySet;
        if (!processor.events) {
            return;
        }
        let name;

        for (name in processor.events) {
            const event = processor.events[name];
            // Log.debug(`[_attachProcessorEvents] `, name, entitySet.cid);

            processor.listenToAsync(entitySet, name, (pName, pEntity, pEntitySet, ...rest) => {
                const args = [pEntity, entitySet, ...rest];
                // Log.debug(`[_attachProcessorEvents] evt `, stringify(args) );
                return event.apply(processor, args);
            });
        }
    }

    _removeEntry(entry) {
        // const query = entry.get('query');
        // const processor = entry.get('processor');
        // const view = entry.get('view');
    }

    /**
     * Maps the view to the processor
     */
    _addProcessorToView(queryID, view, entry) {
        this._views[queryID] = view;
        entry.view = view;
        let views = this._viewsToProcessors || {};
        let processors = views[queryID] || [];
        if (processors.indexOf(entry.id) === -1) {
            processors.push(entry.id);
        }
        views[queryID] = processors;
        this._viewsToProcessors = views;
        return entry;
    }

    /**
     *
     */
    _removeProcessorFromView(entry) {
        if (!this._viewsToProcessors) {
            return;
        }
        // entry.unset('view', view);
        const queryID = entry.queryID;
        let entryIDs = this._viewsToProcessors[queryID];
        entryIDs = arrayWithout(entryIDs, entry.id);
        // if the view isn't used by any processors, then remove it
        if (entryIDs.length === 0) {
            const view = this._views[queryID];
            // we no longer need the view - remove the view
            if (isEntitySetView(view)) {
                this.registry.destroyEntitySet(this._views[queryID]);
            }
            delete this._views[queryID];
            this.trigger('view:destroy', view);
        } else {
            this._viewsToProcessors[queryID] = entryIDs;
        }
    }

    /**
     *
     */
    getProcessorsForQuery(query) {
        if (!this._viewsToProcessors) {
            return null;
        }
        query = Query.toQuery(query);
        const queryID = query.hash();
        const entryIDs = this._viewsToProcessors[queryID];
        if (!entryIDs || entryIDs.length <= 0) {
            return null;
        }
        return this.processorEntries.filter(e => entryIDs.indexOf(e.id) !== -1);
    }
}

