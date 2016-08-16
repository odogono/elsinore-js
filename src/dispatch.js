import _ from 'underscore';
import {Model as BackboneModel,Collection} from 'odgn-backbone-model';
import * as Utils from './util';
import Query from './query/full';


function EntityDispatch(){
    this.processorEntries = new Collection();
    this.processorEntries.comparator = (a,b) => a.get('priority') < b.get('priority');
    this.executedAt = Date.now;
}

EntityDispatch.prototype.addProcessor = function( processor, query, options={} ){
    let filter;
    query = query || processor.entityFilter;


    let entry = new BackboneModel({
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
        processor.entityFilter = Query.create( this.registry, query );
        entry.set('query', processor.entityFilter);
    }

    this.processorEntries.add(entry);
    return entry;
}

EntityDispatch.prototype.execute = function( entity, timeMs ){
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

EntityDispatch.create = function( registry ){
    const result = new EntityDispatch();
    result.registry = registry;
    return result;
}

export default EntityDispatch;