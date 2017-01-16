import _ from 'underscore';
import test from 'tape';

import Query from '../src/query';
import '../src/query/limit';

import {
    Component, Entity, EntitySet,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';

test('limit the number of entities in the result', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const result = entitySet.query( Q => Q.limit(7) );
        t.equals( result.size(), 7 );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('return the first result', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        const result = entitySet.query( Q => [
            Q.all( '/component/channel' )
                .where(Q.attr( 'name' ).equals('ecs'))
            ,Q.limit(1)
        ]);
        t.equals( result.size(), 1 );
        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});
  
test('limit the number of entities in the result from an offset', t => {
    initialiseEntitySet().then( ([registry,entitySet]) => {
        let result = entitySet.query(Q => [
            Q.limit(5,10),
            Q.pluck( null, '@e', {unique:true})
        ]);
        
        t.deepEqual( result, [11,12,13,14,15] );
        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});

test('apply offset and limit to a select', async t => {
    const [registry,entitySet] = await initialiseEntitySet();
    const query = Q => [
        Q.all('/component/username'),
        Q.limit( 2 ),
    ];
    const result = entitySet.query( query );
        
    t.equals( result.size(), 2, 'only two entities returned' );
    t.end();
});



function initialiseEntitySet(){
    return initialiseRegistry(false).then( registry => {
        let entitySet = loadEntities( registry, 'query.entities' );
        return [registry,entitySet];
    });
}
