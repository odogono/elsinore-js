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

*/


test('basic execution of a processor', t => {
    let dispatch = EntityDispatch.create();
    let executeCount = 0;

    const processor = EntityProcessor.create();
    processor.onUpdate = (entityArray, timeMs, options ) => executeCount++;

    const otherProcessor = EntityProcessor.create();
    otherProcessor.onUpdate = (entityArray, timeMs, options ) => executeCount++;

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

        const processor = EntityProcessor.create();
        processor.onUpdate = (entityArray, timeMs, options ) => executeCount++;
        processor.entityFilter = Query.all('/component/hostname');

        const otherProcessor = EntityProcessor.create();
        otherProcessor.onUpdate = (entityArray, timeMs, options ) => executeCount++;
        otherProcessor.entityFilter = Query.all('/component/username');

        dispatch.addProcessor( processor );
        dispatch.addProcessor( otherProcessor );
        
        // register a second processor with no query
        let entity = registry.createEntity( { id:'/component/username', username:'fred' } );

        dispatch.execute( entity );

        // only one processor matches the query
        t.equals( executeCount, 1);
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
})




// test('match on query', t => {

//     // register a processor with a query

//     // register a second processor with a different kind of query

//     // pass an entity with a particular component pattern

//     // only one of the processors should have executed

//     t.ok(false);
//     t.end(); 
// })



function EntityDispatch(){
    this.processors = {};
}

EntityDispatch.prototype.addProcessor = function( processor, options ){
    let filter;

    this.processors[ processor.cid ] = processor;
    if( processor.entityFilter ){
        // NOTE: we are not doing anything other than ensuring the query is compiled
        // eventually we should be caching identical queries
        processor.entityFilter = Query.create( this.registry, processor.entityFilter );
    }
}

EntityDispatch.prototype.execute = function( entity ){
    let processor;
    for (var p in this.processors) {
        processor = this.processors[p];
        if( processor.entityFilter ){
            let result = processor.entityFilter.execute( entity );
            // console.log('exec filter', 
            //     JSON.stringify(processor.entityFilter), 
            //     'against', entityToString(entity),
            //     JSON.stringify( result ) );
            if( !result ){
                continue;
            }
        }
        processor.onUpdate( [entity] );        
    }
}

EntityDispatch.create = function( registry ){
    const result = new EntityDispatch();
    result.registry = registry;
    return result;
}