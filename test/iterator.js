import _ from 'underscore';
import test from 'tape';
import * as Utils from '../src/util/index';


// test.skip('iterator', t => {
//     let it, entity, count;
//     return initialise().then(([ registry, entitySet, entities ]) => {
//         entitySet.addEntity(entities);
//         entitySet.removeEntity(entities.at(3));
//         count = 0;

//         for (entity of entitySet) {
//             count++;
//         }

//         t.equals(count, 4, 'four entities should have been returned');

//         t.end();
//     });
// });

// test('async iterator completest with a rejection', t => {
//     let it, entity, count;
//     let registry = initialiseRegistry();
//     let entitySet = registry.createEntitySet();
//     let entities = loadEntities( registry );
//     // add a single entity
//     entitySet.addEntity( entities.at(0) );
//     it = entitySet.iterator();
//     // the first call will return the entity
//     it.next().then( function(e){
//         // the second call should be rejected
//         it.next().then( null, function(state){
//             t.ok( state.done, true, 'the state should be done' );
//             t.end();
//         })
//     });
// });
// test('async iterator', t => {
//     let it, entity, count;
//     let registry = initialiseRegistry();
//     let entitySet = registry.createEntitySet();
//     let entities = loadEntities( registry );
//     entitySet.addEntity( entities );
//     entitySet.removeEntity( entities.at(3) );
//     count = 0;
//     it = entitySet.iterator();
//     return Utils.reduceIterator( it, function(memo,item){
//         memo.push( item );
//         // printE( item );
//     }, [] )
//     .then( function(results){
//         // printE( results );
//         t.equals( results.length, 4, 'four entities should have been returned' );
//         t.end();
//     });
// });