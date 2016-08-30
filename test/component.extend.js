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
];




test('basics', t => {

    const TestComponent = Component.extend({
        type: 'TestComponent',

        // preinitialize: function(attrs,options){
        //     console.log('TestComponent preinit');
        // },

        verify: function(){
            return true;
        }
    })

    const componentRegistry = ComponentRegistry.create();
    componentRegistry.register( COMPONENT_DEFINITIONS );

    // register the type first
    componentRegistry.register( TestComponent );
    
    componentRegistry.register( { 
        uri: '/component/example', 
        type:'TestComponent', 
        'properties': { name:'' } 
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


function createRegistry(){
    const registry = Registry.create();
    return registry.registerComponent(COMPONENT_DEFINITIONS).then(() => registry);
}