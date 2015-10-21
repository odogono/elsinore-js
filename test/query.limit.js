import _ from 'underscore';
import test from 'tape';


import {
    Elsinore, 
    Component,
    Entity,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    logEvents,
    requireLib
} from './common';


export default function run( test, Common, Elsinore, EntitySet ){
    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let Query = Elsinore.Query;

    test('limit the number of entities in the result', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
            let result = entitySet.query( Query.limit(7) );
            t.equals( result.size(), 7 );
            t.end();
        });
    });

    test('return the first result', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
            let result = entitySet.query( [
                Query.all( '/component/channel' )
                    .where(Query.attr( 'name' ).equals('ecs'))
                ,Query.limit(1) 
            ]);
            // printE( result );
            t.equals( result.size(), 1 );
            t.end();
        })
        .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
    });
      
    test('limit the number of entities in the result from an offset', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
            let result = entitySet.query([
                Query.limit(5,10),
                Query.pluck( null, 'eid', {unique:true})
            ]);
            
            t.deepEqual( result, [11,12,13,14,15] );
            t.end();
        })
        .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
    });

    test('apply offset and limit to a select', t => {
        initialiseEntitySet().then( ([registry,entitySet]) => {
            let result = Query.create( registry, [
                Query.all('/component/username'),
                Query.limit( 2 ),
                // Query.pluck( null, 'eid', {unique:true})
            ]);
            
            t.deepEqual( result.commands.length, 1 );
            result = entitySet.query( result );

            t.equals( result.size(), 2, 'only two entities returned' );
            
            t.end();
        })
        .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
    });


    
    function initialiseEntitySet(){
        return Common.initialiseRegistry(false).then( registry => {
            let entitySet = Common.loadEntities( registry, 'query.entities' );
            return [registry,entitySet];
        });
    }
}

// serverside only execution of tests
if( !process.browser ){
    let Common = require('./common');
    run( require('tape'), Common, Common.Elsinore, Common.Elsinore.EntitySet );
}