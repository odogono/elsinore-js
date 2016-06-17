import _ from 'underscore';
import test from 'tape';
import Backbone from 'backbone';
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


const Listener = _.extend( {}, Backbone.Events );



test('testing an async register component', t => {
    const registry = Registry.create();
    const schemaA = { name:'channel', uri:'/component/channel', properties:{ name:{type:'string'} }};

    Listener.on('register', function( componentDef ){
        // console.log( componentDef );
        t.equals( componentDef.get('uri'), '/component/channel');
        t.end();
    });
    
    return registry.createEntitySet( AsyncEntitySet )
        .then( es => registry.registerComponent(schemaA) )
})






const AsyncEntitySet = EntitySet.extend({
    type: 'AsyncEntitySet',
    isAsyncEntitySet: true,
    isMemoryEntitySet: false,
    isAsync: true, 

    initialize: function initialize(options={}) {
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
        Listener.trigger('register', def);
        return Promise.resolve(this);
    },
});

AsyncEntitySet.create = function( options={} ){
    let result = new AsyncEntitySet(options);
    return result;
}
