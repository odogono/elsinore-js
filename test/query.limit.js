'use strict';

let _ = require('underscore');


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
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}