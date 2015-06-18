'use strict';

let _ = require('underscore');



export default function run( test, Common, Elsinore, EntitySet ){
    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let Query = Elsinore.Query;

    test('return entity by id', t => {
        let [registry,entitySet] = initialise();
        let result = entitySet.selectById( 5 );
        t.ok( EntitySet.isEntitySet(result) );
        t.equals( result.size(), 1 );
        t.end();
    });

    test('return entities by id', t => {
        let [registry,entitySet] = initialise();
        let result = entitySet.selectById( [5, 6, 7] );
        t.ok( EntitySet.isEntitySet(result) );
        t.equals( result.size(), 3 );
        t.end();
    });

    test('return entity by id in an array', t => {
        let [registry,entitySet] = initialise();
        let result = entitySet.selectById( 5, false );
        t.notOk( EntitySet.isEntitySet(result) );
        t.equals( result.length, 1 );
        t.end();
    });

    test('.query returns an entityset of entities', t => {
        let [registry,entitySet] = initialise();

        // var result = entitySet.where('/component/name');
        let result = entitySet.query( Query.selectById( [3,4] ) );
        t.ok( result.isEntitySet, 'the result is an entityset');
        t.equals( result.length, 2, '2 entities returned');

        t.end();
    });

    function initialise(){
        let registry = Common.initialiseRegistry(false);
        let entitySet = Common.loadEntities( registry, 'query.entities' );
        return [registry,entitySet];
    }
}

// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    run( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}