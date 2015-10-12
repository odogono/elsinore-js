import _ from 'underscore';
import test from 'tape';
let Sinon = require('sinon');


module.exports = function( test, Common, Elsinore, EntitySet ){

    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let EntityFilter = Elsinore.EntityFilter;
    let Registry = Elsinore.Registry;
    let Query = Elsinore.Query;


    

    test('keeping a map of entitySets and views', t => {
        return Common.initialiseRegistry().then( registry => {

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
        })
        .catch( err => log.error('test error: %s', err.stack) )
    });

    // creating components

    test('create from a schema', t => {
        return Common.initialiseRegistry({loadComponents:false}).then( registry => {
            let componentData = Common.loadComponents();
            // Common.logEvents( registry );
            // passing a schema as the first argument will cause the component to be
            // registered at the same time
            return registry.registerComponent( componentData['/component/position'] )
                .then( () => {
                    let component = registry.createComponent( '/component/position', { x:200 } );
                    t.equals( component.schemaUri, '/component/position' );
                    t.equals( component.schemaHash, '9db8f95b' );
                    t.equals( component.get('x'), 200 );

                    t.end();
                })
        })
        .catch( err => log.error('test error: %s', err.stack) )
    });

    test('create from a schema hash', t => {
        return Common.initialiseRegistry({loadComponents:true}).then( registry => {
        // let componentData = Common.loadComponents();
        // var def = registry.registerComponent( componentData['/component/score'] );
            let component = registry.createComponent( 'd3f0bf51', {score:200} );
            
            t.equals( component.get('score'), 200 );
            t.equals( component.get('lives'), 3 );

            t.end();
        });
    });

    test('create from a pre-registered schema', t => {
        return Common.initialiseRegistry({loadComponents:true}).then( registry => {
            let component = registry.createComponent( '/component/nickname', {nickname:'peter'} );

            t.equals( component.get('nickname'), 'peter' );

            t.end();
        });
    });

    test('create from a pre-registered schema using data object', t => {
        return Common.initialiseRegistry({loadComponents:true}).then( registry => {
            let component = registry.createComponent( {id:'/component/nickname', nickname:'susan'} );
            t.equals( component.get('nickname'), 'susan', 'the component is created with attributes' );
            t.end();
        });
    });

    test('create from an array of data', t => {
        return Common.initialiseRegistry({loadComponents:true}).then( registry => {
            let components = registry.createComponent( '/component/position', [ {x:0,y:-1}, {x:10,y:0}, {x:15,y:-2} ] );

            t.equals( components.length, 3, 'three components should have been created' );
            t.equals( components[1].get('x'), 10, 'the component attributes should be applied' );

            t.end();
        });
    });

    test('create with an entity id', t => {
        return Common.initialiseRegistry().then( registry => {

            let component = registry.createComponent( {id:'/component/nickname', _e:15} );
            t.equals( component.getEntityId(), 15, 'the entity id is retrieved' );

            component = registry.createComponent( {id:'/component/nickname', _e:15, _es:10} );
            t.equals( component.getEntityId(), 42949672975, 'the entity id is retrieved' );

            t.end();

        });
    });


    test('updating a components entity refs', t => {
        return Common.initialiseRegistry().then( registry => {
            let component = registry.createComponent( 
                {"_e":12, "id": "/component/channel_member", "channel": 1, "client": 5} );
            
            let aComponent = registry.mapComponentEntityRefs( component, { 5: 290, 1: 340} );

            t.equals( aComponent.get('channel'), 340 );
            t.equals( aComponent.get('client'), 290 );

            t.end();
        })
        .catch( err => log.error('test error: %s', err.stack) )
    });
}

// serverside only execution of tests
if( !process.browser ){
    let Common = require('./common');
    module.exports( require('tape'), Common, Common.Elsinore, Common.Elsinore.EntitySet );
}