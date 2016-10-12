import _ from 'underscore';
import test from 'tape';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, Query,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';

import ComponentRegistry from '../src/schema/index';


const COMPONENT_DEFINITIONS = [
    { uri:'/component/name', properties:{ name:""} },
    { uri:'/component/position', properties:{ x:0,y:0} },
];




test('registering a custom component type', t => {

    const TestComponent = Component.extend({
        type: 'TestComponent',

        preinitialize: (attrs,options) => {
            // console.log('TestComponent preinit', attrs, options);
        },

        verify: function(){
            return true;
        }
    });


    const componentRegistry = ComponentRegistry.create();
    componentRegistry.register( COMPONENT_DEFINITIONS );

    // register the type first
    componentRegistry.register( TestComponent );
    
    componentRegistry.register( { 
        uri: '/component/example', 
        type:'TestComponent',
        properties: { name:''}
    });
    
    let component = componentRegistry.createComponent('/component/example');

    t.ok( component.isTestComponent );
    t.ok( component.verify() );
    
    let name = componentRegistry.createComponent('/component/name');

    t.ok( name.isComponent );

    t.end();
});

test('attempting to create an unregistered type', t => {

    const componentRegistry = ComponentRegistry.create();

    try {
        componentRegistry.register( { 
        uri: '/component/example', type:'TestComponent', 'properties': {name:''} });
    }catch( err ){
        t.equals(err.message,'could not find type TestComponent for def /component/example');
    }

    t.end();
});


test('the custom component is initialised when registered', t => {
    createRegistry().then( registry => {
        t.plan(1);

        const TestComponent = Component.extend({
            type: 'TestComponent',

            preinitialize: function(attrs,options){
                t.ok( options.registry, 'the registry is passed as an option' );
            }
        });

        registry.registerComponent( TestComponent );
    })
    .then( () => t.end() )
    .catch( err => console.error('test error', err, err.stack));
});


test('the custom component can supply properties', t => {
    const componentRegistry = ComponentRegistry.create();

    const TestComponent = Component.extend({
        type: 'TestComponent',
        properties:{
            maximum: 10
        }
    });

    componentRegistry.register( TestComponent );

    // note that the merging of properties happens at the point of
    // registration
    componentRegistry.register( { 
        uri: '/component/example', 
        type:'TestComponent', 
        'properties': { name:'tbd' } 
    });
    
    let component = componentRegistry.createComponent('/component/example');

    t.equals( component.get('maximum'), 10 );
    t.equals( component.get('name'), 'tbd' );

    t.end();
});


test('the registered component class can also include a uri', t => {
    createRegistry().then( registry => {
        
        const TestComponent = Component.extend({
            uri: '/component/test',
            type: 'TestComponent',
            properties: { testValue:'unfulfilled' },
        });

        registry.registerComponent( TestComponent );

        const component = registry.createComponent('/component/test');

        t.equals( component.get('testValue'), 'unfulfilled');

    })
    .then( () => t.end() )
    .catch( err => console.error('test error', err, err.stack));
})


test('passing options to the custom component', t => {
    const componentRegistry = ComponentRegistry.create();

    const TestComponent = Component.extend({
        type: 'TestComponent',
        initialize: function(attrs,options){
            this.set({msg:options.msg});
        }
    });

    componentRegistry.register( TestComponent );

    // note that the merging of properties happens at the point of
    // registration
    componentRegistry.register( { 
        uri: '/component/example', 
        type:'TestComponent', 
        'properties': { name:'tbd' },
        options:{ msg:'welcome'}
    });
    
    let component = componentRegistry.createComponent('/component/example');

    t.equals( component.get('name'), 'tbd' );
    t.equals( component.get('msg'), 'welcome' );

    t.end();
})


/**
 * Component is added to entity
 * the component adds a new function to the entity so that it will
 * 
 */
test('will be notified when the entity is added to an entityset', t => {
    createRegistry().then( registry => {
        // t.plan(1);

        let calledOnAdded = false;
        let calledOnRemoved = false;

        const TestComponent = Component.extend({
            uri: '/component/test',
            type: 'TestComponent',
            properties: { name:'unknown' },

            onAdded: function( es ){
                calledOnAdded = true;
                this._entity.addChild = function(){
                    // console.log('adding the child to me,', this.id, 'es', this.collection.getUuid() );
                }
            },
            onRemoved: function(es){
                calledOnRemoved = true;
            }
        });

        registry.registerComponent( TestComponent );

        let es = registry.createEntitySet();
        let es2 = registry.createEntitySet();


        let e = registry.createComponent('/component/test');
        es.addComponent(e);

        const entity = es.at(0);
        entity.addChild(2);

        // printE(es);

        entity.removeComponent( entity.Test );

        t.ok(calledOnAdded, 'onAdded was called');
        t.ok(calledOnRemoved, 'onRemoved was called');

    })
    .then( () => t.end() )
    .catch( err => console.error('test error', err, err.stack));
})


function createRegistry(){
    const registry = Registry.create();
    return registry.registerComponent(COMPONENT_DEFINITIONS).then(() => registry);
}