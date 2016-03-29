import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Entity, EntityProcessor, Query, 
    initialiseRegistry, 
    loadEntities, 
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
    entityToString,
} from './common';

/**

A utility for executing processors.

The idea here is that processors are registered with a query, which decides which entities they
are given to process. Then when an entity is passed in, each of the matching processors executes with
it.

    * further directions

    - processors may have identical queries. cache the query so that it is only executed once

    - execute a given processor at a given time interval only - eg, execute once every n seconds

    - manage the prioritising of processor execution

    - when an entity is accepted by a query, cache it's signature (component bits) so that the
    next time it (or something similar) passes through, the query won't have to be run.
    this may not always work, because the query may be selecting on component attributes.
*/

test('basic execution of a processor', t => {
    let dispatch = EntityDispatch.create();
    let executeCount = 0;

    const processor = createEntityProcessor(
        (entityArray, timeMs, options ) => executeCount++);

    const otherProcessor = createEntityProcessor( 
        (entityArray, timeMs, options ) => executeCount++);

    dispatch.addProcessor( processor );
    dispatch.addProcessor( otherProcessor );
    
    // register a second processor with no query
    let entity = Entity.create();

    dispatch.execute( entity );

    t.equals( executeCount, 2);
    t.end();
});


test('will only execute processors which match', t => {
    return initialiseRegistry().then( registry => {
        let dispatch = EntityDispatch.create(registry);
        let executeCount = 0;

        const processor =createEntityProcessor( 
            (entityArray, timeMs, options ) => executeCount++);

        const otherProcessor = createEntityProcessor( 
            (entityArray, timeMs, options ) => executeCount++);

        dispatch.addProcessor( processor, Query.all('/component/hostname') );
        dispatch.addProcessor( otherProcessor, Query.all('/component/username') );
        
        let entity = registry.createEntity( { id:'/component/username', username:'fred' } );

        dispatch.execute( entity );

        // only one processor matches the query
        t.equals( executeCount, 1);

        dispatch.execute( entity );
        t.equals( executeCount, 2);
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('executing a processor with a time interval', t => {
    return initialiseRegistry().then( registry => {
        let dispatch = EntityDispatch.create(registry);
        let entity = registry.createEntity( {id:'/component/username'} );
        let executeCount = 0;

        const processor =createEntityProcessor( 
            (entityArray, timeMs, options ) => executeCount++);

        // executes every 1000ms
        dispatch.addProcessor( processor, null, {interval:1000});

        dispatch.execute(entity, 0);
        t.equals( executeCount, 1);

        dispatch.execute(entity, 100);
        t.equals( executeCount, 1, 'no further execution within interval');

        dispatch.execute(entity, 1000);
        t.equals( executeCount, 2, 'another execution now that interval expired');

        dispatch.execute(entity, 1900);
        t.equals( executeCount, 2);        
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) ) 
});



function createEntityProcessor( onUpdate ){
    const result = EntityProcessor.create();
    result.onUpdate = onUpdate;
    return result;
}


// test('match on query', t => {

//     // register a processor with a query

//     // register a second processor with a different kind of query

//     // pass an entity with a particular component pattern

//     // only one of the processors should have executed

//     t.ok(false);
//     t.end(); 
// })



function EntityDispatch(){
    this.processorEntries = {};
}

EntityDispatch.prototype.addProcessor = function( processor, query, options={} ){
    let filter;
    query = query || processor.entityFilter;

    let entry = {
        id: _.uniqueId('procdisp'),
        processor: processor,
        createdAt: 0,
        updatedAt: -1,
        interval: _.isUndefined(options.interval) ? 0 : options.interval
    };

    if( query ){
        // NOTE: we are not doing anything other than ensuring the query is compiled
        // eventually we should be caching identical queries
        processor.entityFilter = entry.query = Query.create( this.registry, query );
    }

    this.processorEntries[ entry.id ] = entry;
    return entry;
}

EntityDispatch.prototype.execute = function( entity, timeMs ){
    let entry, query;
    let entityArray = _.isArray(entity) ? entity : [entity];
    for (var p in this.processorEntries) {
        entry = this.processorEntries[p];
        query = entry.query;

        if( entry.updatedAt >= 0 && (entry.interval + entry.updatedAt > timeMs) ){
            continue;
        }

        if( query ){
            let result = query.execute( entity );
            // console.log('exec filter', 
            //     JSON.stringify(processor.entityFilter), 
            //     'against', entityToString(entity),
            //     JSON.stringify( result ) );
            if( !result ){
                continue;
            }
        }
        entry.processor.onUpdate( entityArray, timeMs );
        entry.updatedAt = timeMs;
    }
}

EntityDispatch.create = function( registry ){
    const result = new EntityDispatch();
    result.registry = registry;
    return result;
}