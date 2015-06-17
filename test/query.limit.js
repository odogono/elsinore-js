'use strict';

let _ = require('underscore');


export default function run( test, Common, Elsinore, EntitySet ){
    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let Query = Elsinore.Query;

    test('limit the number of entities in the result', t => {
        let [registry,entitySet] = initialiseEntitySet();
        let result = entitySet.query( Query.limit(7) );
        t.equals( result.size(), 7 );
        t.end();
    });
      
    test('limit the number of entities in the result from an offset', t => {
        let [registry,entitySet] = initialiseEntitySet();
        let result = entitySet.query([
            Query.limit(5,10),
            Query.pluck( null, 'eid', {unique:true})
        ]);
        
        t.deepEqual( result, [11,12,13,14,15] );
        t.end();
    });
    
    function initialiseEntitySet(){
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