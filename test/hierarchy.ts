import _ from 'underscore';
import test from 'tape';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
} from './common';


/**
 * Materialised Paths
 * 
 * a component keeps an attribute which records the 'chain' of entities to which 
 * it is part of.
 * So a path might read /45/16/22 - the last part is the current entity id, the 
 * preceeding the parent, and the first the parents parent.
 * 
 */
test('prefudge', t => {
    createRegistry().then( R => {
        let esA = R.createEntitySet();
        let esB = R.createEntitySet();

        let e = R.createEntity({'@c':'/component/name', name:'charles'});
        esA.addEntity(e);

        e.Name.set({surname:'terry'});

        esB.addEntity(e);


        let qr = esA.query( Q => Q.all('/component/name') );

        // printE( qr, 'query:' );
        

        t.end();
    })
    .catch( err => console.error('test error', err, err.stack));
});



test('adding a child', t => {
    createRegistry().then( registry => {
        let e = registry.createEntity({'@c':'/component/path'});
        let child = registry.createEntity({'@c':'/component/name', name:'child'});

        // printE(e);
        // printE(child);

        // add a child using
        // e.addChild( '/component/path', child ); // OR
        e.Path.addChild( child );


        // t.ok( child.hasParent() );
        
        // e.children().at(0)
        
        t.end();        
    });
    
});

test('manip path', t => {
    const ComponentDefs = [
        TreeComponent,
        { uri:'/component/path', type:'TreeComponent', properties:{}, options:{pathAttr:'path'} },
        { uri:'/component/name', properties:{ name:""} },
    ];

    createRegistry(ComponentDefs).then( registry => {
        let e = registry.createEntity({'@c':'/component/path'});
        let child = registry.createEntity({'@c':'/component/name', name:'child'});

        // printE(e);
        // printE(child);

        // add a child using
        // e.addChild( '/component/path', child ); // OR
        e.Path.addChild( child );

        // the child will now have a path component

        console.log('path is', e.Path.get('path'));

        // t.ok( child.hasParent() );
        
        // e.children().at(0)
        
        
    })
    .then( () => t.end() )
    .catch( err => console.error('test error', err, err.stack));
    
});


const TreeComponent = Component.extend({
    type: 'TreeComponent',

    initialize: function(attrs,options){
        this.pathAttr = options.pathAttr || 'path';
        let set = {}; set[this.pathAttr] = [];
        this.set(set);
    },

    addChild: function( entity ){

    },

    removeChild: function( entity ){

    },

    /**
    *   Returns the child entities
    */
    children: function( depth, options={} ){
        return [];
    },

});


const COMPONENT_DEFINITIONS = [
    { 'uri':'/component/path', 'properties':{} },
    { uri:'/component/name', properties:{ name:""} },
];


function createRegistry( defs ){
    defs = defs || COMPONENT_DEFINITIONS;
    const registry = Registry.create();
    return registry.registerComponent(defs).then(() => registry);
}