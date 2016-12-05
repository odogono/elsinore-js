import _ from 'underscore';
import {Model as Entry,Collection,Events} from 'odgn-backbone-model';

import EntitySet from './entity_set';
import Query from './query/full';


/**
 * 
 */
export default class EntityDispatch { 

    initialize(){
        // this._removeViews();
        this.processorEntries = new Collection();
        this.processorEntries.comparator = (a,b) => a.get('priority') < b.get('priority');
        this.executedAt = Date.now;
        return this;
    }

    /**
     * Sets the EntitySet that this dispatcher will use.
     * if null, the existing entitySet and all derived views will be cleared
     */
    setEntitySet( entitySet ){
        if( entitySet == null ){
            // remove all views created from the entityset
            // this._removeViews();
        }
        this._entitySet = entitySet;
    }



    /**
     * 
     */
    addProcessor( processor, query, options={} ){
        let filter;
        if( !processor ){ return null; }
        query = query || processor.entityFilter;

        let entry = new Entry({
            id: processor.id || _.uniqueId('procdisp'),
            processor: processor,
            createdAt: 0,
            updatedAt: -1,
            executedAt: Date.now,
            priority: _.isUndefined(options.priority) ? 0 : options.priority,
            interval: _.isUndefined(options.interval) ? 0 : options.interval
        });

        if( query ){
            // NOTE: we are not doing anything other than ensuring the query is compiled
            // eventually we should be caching identical queries
            processor.entityFilter = Query.toQuery(query);
            entry.set('query', processor.entityFilter);
            entry.set('queryId', processor.entityFilter.hash() );
        }

        this.processorEntries.add(entry);

        if( this._entitySet ){
            this._mapEntitySetToProcessor(entry,options);
        }

        return entry;
    }

    /**
     * Passes the entity to each of the registered processors in turn
     */
    execute( entity, timeMs ){
        let entry, processor, query;
        let entityArray = _.isArray(entity) ? entity : [entity];

        this.processorEntries.each(entry => {
            query = entry.get('query');
            processor = entry.get('processor');

            if( entry.get('updatedAt') >= 0 && (entry.get('interval') + entry.get('updatedAt') > timeMs) ){
                return;
            }

            if( query ){
                let result = query.execute( entity );
                if( !result ){
                    return;
                }
            }

            let deltaTime = timeMs - entry.get('executedAt');

            processor.onUpdate( entityArray, timeMs, deltaTime/1000 );

            entry.set({'updatedAt': timeMs, 'executedAt': timeMs});
        });
    }

    /**
     * Calls each of the registered processors to execute against
     * the dispatchers entityset.
     */
    update(timeMs, options={}){
        
    }

    /**
     * Async version of above
     */
    updateAsync(timeMs,options={}){
        return Promise.resolve(true);
    }


    /**
     * 
     */
    _mapEntitySetToProcessor( entry, options={} ){
        const queryId = entry.get('queryId');
        const query = entry.get('query');
        const processor = entry.get('processor');
        const debug = options.debug;

        if( !query ){
            entry.set('view', this._entitySet);
        } else {
            if( !this._views ){
                this._views = [];
            }
            let view = this._views[queryId];
            if( !view ){
                view = this._entitySet.view(query); 
                this.trigger('view:create', view);
            }

            this._addProcessorToView( queryId, view, entry );
        }

        processor.view = processor.entitySet = entry.get('view');

        return entry;
    }


    _removeEntry(entry){
        const query = entry.get('query');
        const processor = entry.get('processor');
        const view = entry.get('view');

    }

    /**
     * Maps the view to the processor
     */
    _addProcessorToView(queryId,view,entry){
        this._views[queryId] = view;
        entry.set('view', view);
        let views = this._viewsToProcessors || {};
        let processors = views[queryId] || [];
        processors.push(entry.id);
        views[queryId] = _.uniq(processors)
        this._viewsToProcessors = views;
        console.log('added processor', entry.id, 'to view', queryId);
        return entry;
    }

    /**
     * 
     */
    _removeProcessorFromView(entry){
        if(!this._viewsToProcessors){ return; }
        entry.unset('view', view);
        const queryId = entry.get('queryId');
        let entryIds = this._viewsToProcessors[queryId];
        entryIds = _.without(entryIds, entry.id);
        // if the view isn't used by any processors, then remove it
        if( entryIds.length === 0 ){
            const view = this._views[queryId];
            // we no longer need the view - remove the view
            if( view.isEntitySetView ){
                this.registry.destroyEntitySet( this._views[queryId] );
            }
            delete this._views[queryId];
            this.trigger('view:destroy', view);
        } else {
            this._viewsToProcessors[queryId] = entryIds;
        }
    }

    /**
     * 
     */
    getProcessorsForQuery( query ){
        if( !this._viewsToProcessors ){
            return null;
        }
        query = Query.toQuery(query);
        const queryId = query.hash();
        const entryIds = this._viewsToProcessors[queryId];
        if( !entryIds || entryIds.length <= 0 ){ return null; }
        return this.processorEntries.filter( e => _.indexOf(entryIds,e.id) !== -1 );
    }
    
}


EntityDispatch.create = function( registry, entitySet ){
    const result = new EntityDispatch();
    _.extend(result, Events);
    if( EntitySet.isEntitySet(registry) ){
        entitySet = registry;
        registry = entitySet.getRegistry();
    }
    result.registry = registry;
    result.setEntitySet(entitySet);
    result.initialize();
    return result;
}