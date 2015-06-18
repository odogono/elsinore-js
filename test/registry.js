'use strict';

let _ = require('underscore');
let Sinon = require('sinon');


module.exports = function( test, Common, Elsinore, EntitySet ){

    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let EntityFilter = Elsinore.EntityFilter;
    let Registry = Elsinore.Registry;
    let Query = Elsinore.Query;

    test('keeping a map of entitySets and views', t => {
        let registry = Common.initialiseRegistry();
        
        let query = Query.all('/component/position');
        
        // let eso = registry.createEntitySet();

        // printE( es );
        let es = registry.createEntitySet();
        let view = es.view( query );
        let oview = es.view( query);
        let tview = es.view();

        log.debug( 'es hash ' + es.hash() );
        // log.debug( 'eso hash ' + eso.hash() );
        log.debug( 'view hash ' + view.hash());
        log.debug( 'oview hash ' + oview.hash() );
        log.debug( 'tview hash ' + tview.hash() );

        t.end();
    });

    // creating components

    test('create from a schema', t => {
        let registry = Registry.create();
        let componentData = Common.loadComponents();
        // Common.logEvents( registry );
        // passing a schema as the first argument will cause the component to be
        // registered at the same time
        // printIns( componentData );
        let component = registry.createComponent( componentData['/component/position'], { x:200 } );

        t.equals( component.schemaUri, '/component/position' );
        t.equals( component.schemaHash, '9db8f95b' );
        t.equals( component.get('x'), 200 );

        t.end();
    });

    test('create from a schema hash', t => {
        var registry = Registry.create();
        let componentData = Common.loadComponents();
        var def = registry.registerComponent( componentData['/component/score'] );
        var component = registry.createComponent( 'd3f0bf51', {score:200} );
        
        t.equals( component.get('score'), 200 );
        t.equals( component.get('lives'), 3 );

        t.end();
    });

    test('create from a pre-registered schema', t => {
        var registry = Registry.create();
        let componentData = Common.loadComponents();

        registry.registerComponent( componentData['/component/nickname'] );

        var component = registry.createComponent( '/component/nickname', {nickname:'peter'} );

        t.equals( component.get('nickname'), 'peter' );

        t.end();
    });

    test('create from a pre-registered schema using data object', t => {
        var registry = Registry.create();
        let componentData = Common.loadComponents();

        registry.registerComponent( componentData['/component/nickname'] );

        var component = registry.createComponent( {id:'/component/nickname', nickname:'susan'} );

        t.equals( component.get('nickname'), 'susan' );

        t.end();
    });

    test('create from an array of data', t => {
        var registry = Registry.create();
        let componentData = Common.loadComponents();

        registry.registerComponent( componentData['/component/position'] );

        var components = registry.createComponent( '/component/position', [ {x:0,y:-1}, {x:10,y:0}, {x:15,y:-2} ] );

        t.equals( components.length, 3 );
        t.equals( components[1].get('x'), 10 );

        t.end();
    });


}

// serverside only execution of tests
if( !process.browser ){
    var Elsinore = require('../lib');
    module.exports( require('tape'), require('./common'), Elsinore, Elsinore.EntitySet );
}