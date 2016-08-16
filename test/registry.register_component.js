import _ from 'underscore';
import test from 'tape';
import {Events} from 'odgn-backbone-model';
import Sinon from 'sinon';

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





const COMPONENT_DEFINITIONS = [
    { uri:'/component/position', properties:{ x:0, y:0, z:0, rotation:0 }, name:'Position', hash:'bd12d7de' },
    { uri:'/component/radius', properties:{ radius:0}, name:'Radius' },
    { uri:'/component/status', properties:{ status:"active"}, name:'Status' },
    { uri:'/component/name', properties:{ name:""}, name:'Name', hash:'c6c1bcdf' },
    { uri:'/component/geo_location', properties:{ lat:0, lng:0 }, name:'Geolocation' },
];


test('testing an async register component', t => {
    const registry = Registry.create();
    const Listener = _.extend( {}, Events );

    Listener.on('register', componentDef => {
        t.equals( componentDef.get('uri'), '/component/position');
        t.end();
    });
    
    return registry.createEntitySet( AsyncEntitySet, {listener:Listener} )
        .then( es => registry.registerComponent(COMPONENT_DEFINITIONS[0]) )
        .catch( err => console.log('err', err, err.stack))
})



test('registering multiple component defs', t => {
    const registry = Registry.create();
    const Listener = _.extend( {}, Events );

    Listener.on('register', componentDef => {
        t.ok( componentDef.get('uri') );
    });

    return registry.createEntitySet( AsyncEntitySet, {listener:Listener} )
        .then( es => registry.registerComponent( [COMPONENT_DEFINITIONS[0],COMPONENT_DEFINITIONS[1]] ) )
        .catch( err => console.log('err', err, err.stack))
        .then( () => t.end() );
})


const AsyncEntitySet = EntitySet.extend({
    type: 'AsyncEntitySet',
    isAsyncEntitySet: true,
    isMemoryEntitySet: false,
    isAsync: true, 

    initialize: function initialize(options={}) {
        this.listener = options.listener;
    },
    open: function(options={}){
        this._open = true;
        return Promise.resolve(this);
    },
    close: function() {
        this._open = false;
        return Promise.resolve(this);
    },
    isOpen: () => this._open,
    destroy: function( options={} ){
        return Promise.resolve(this);
    },
    registerComponentDef: function( def, options={} ){
        this.listener.trigger('register', def);
        return Promise.resolve(this);
    },
});

AsyncEntitySet.create = function( options={} ){
    let result = new AsyncEntitySet(options);
    return result;
}
