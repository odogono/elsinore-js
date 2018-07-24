import _ from 'underscore';
import test from 'tape';
import BitField  from 'odgn-bitfield';
import Sinon from 'sinon';
import { isComponent, isEntity, isEntitySet } from '../src/util/is';
import { EntityFilter } from '../src/entity_filter';

import {
    toInteger
} from '../src/util/to';
import { uniqueID } from '../src/util/unique_id';

import {
    ALL, ANY, SOME, NONE, INCLUDE, EXCLUDE
} from '../src/entity_filter';

import {
    Component, Entity, EntitySet,
    createLog
} from './common';

const Log = createLog('TestEntityFilter');

test('an default filter will accept an entity', t => {
    const e = Entity.create();
    t.ok( EntityFilter.accept(ALL, toBitField(e), toBitField() ), 
        'the filter accepts an entity by default' );
    t.end();
});

test('will reject entities without components', t => {
    const e = Entity.create();
    t.notOk( 
        EntityFilter.accept( SOME, e.getComponentBitfield() ), 
        'the filter rejects the entity without components');
    t.end();
});

test('will accept entities with one of the components', t => {
    const type = ANY;
    const bitField = toBitField( Components.Animal, Components.Doctor );

    t.ok( EntityFilter.accept(type, toBitField(Components.Animal), bitField) );
    t.notOk( EntityFilter.accept(type, toBitField(Components.Mineral), bitField) );
    t.ok( EntityFilter.accept(type, toBitField(Components.Doctor), bitField) );
    t.ok( EntityFilter.accept(type, toBitField(Components.Robot, Components.Animal), bitField) );

    t.end();
});

test('reject an entity which does not have a specific component', t => {
    const e = Entity.create();
    const type = ALL;
    const bitField = toBitField( Components.Flower );

    t.notOk( EntityFilter.accept(type, toBitField(e), bitField ), 
        'filter rejects because the component is missing');
    e.addComponent( createComponent( Components.Flower ) );
    e.addComponent( createComponent( Components.Robot ) );

    t.ok( EntityFilter.accept(type, toBitField(e), bitField ), 
        'filter accepts because the component is present');

    t.end();
});

test('reject an entity which does not have the specific components', t => {
    let e = Entity.create();
    let type = ALL;
    let bitField = toBitField( Components.Mineral, Components.Vegetable );

    e.addComponent( createComponent( Components.Animal ) );
    e.addComponent( createComponent( Components.Mineral ) );
    t.notOk( EntityFilter.accept(type, toBitField(e), bitField) );
    e.addComponent( createComponent( Components.Vegetable ) );
    t.ok( EntityFilter.accept(type, toBitField(e), bitField) );

    t.end();
});

test('accepts an entity which has some of the components', t => {
    let e = Entity.create();
    let type = ANY;
    let bitField = toBitField( Components.Animal, Components.Mineral, Components.Vegetable );
    
    t.notOk( EntityFilter.accept(type, toBitField(e), bitField) );
    e.addComponent( createComponent( Components.Robot ) );
    t.notOk( EntityFilter.accept(type, toBitField(e), bitField) );
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( EntityFilter.accept(type, toBitField(e), bitField), 'has one of the optional components' );
    t.end();
});

test('rejects an entity which has any of the components', t => {
    let e = Entity.create();
    const type = NONE;
    let bitField = toBitField( Components.Vegetable );


    t.ok( EntityFilter.accept(type, toBitField(e), bitField) );
    e.addComponent( createComponent( Components.Animal ) );
    t.ok( EntityFilter.accept(type, toBitField(e), bitField) );
    e.addComponent( createComponent( Components.Vegetable ) );
    t.notOk( EntityFilter.accept(type, toBitField(e), bitField) );

    t.end();
});


test('adding the same type combines', t => {
    let f = EntityFilter.create();
    f.add( ALL, toBitField(Components.Animal,Components.Mineral) );
    f.add( ALL, toBitField(Components.Vegetable) );

    t.deepEquals( f.getValues(), [Components.Animal,Components.Mineral,Components.Vegetable] );

    t.end();
});

test('combine filters into a single', t => {
    const a = EntityFilter.create( ALL, toBitField(Components.Animal,Components.Mineral) );
    const b = EntityFilter.create( ALL, toBitField(Components.Vegetable) );

    const c = EntityFilter.create( a );
    c.add( b );

    t.deepEquals( c.getValues(), [Components.Animal,Components.Mineral,Components.Vegetable] );
    t.end();
});

test('to/from JSON', t => {
    const a = EntityFilter.create( SOME, toBitField(Components.Animal, Components.Mineral));
    a.add( EXCLUDE, toBitField(Components.Vegetable));

    const b = EntityFilter.create( a.toJSON() );
    t.deepEqual( a.toJSON(), b.toJSON() );

    // Log.debug(`[toJSON]`, a.toJSON() );

    // Log.debug(`[toJSON]`, EntityFilter.create( ALL, toBitField(Components.Animal,Components.Mineral)).toJSON() );

    t.end();
});

// test('transform will copy an incoming entity', t => {
//     let te, f = EntityFilter.create();
//     let e = createEntity( Components.Mineral, Components.Vegetable, Components.Doctor );

//     e.marked = true;
//     te = f.transform(e);

//     t.notOk( te.marked );
//     t.ok( te.Mineral );
//     t.ok( te.Vegetable );
//     t.ok( te.Doctor );
//     t.end();
// });

// test('transform will include only specified components on an entity', t => {
//     let e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );

//     let f = EntityFilter.create( EntityFilter.INCLUDE, [Components.Animal, Components.Robot, Components.Doctor] );

//     t.ok( e.Robot, 'entity will have Robot component' );
//     t.ok( e.Mineral, 'entity will have Mineral component' );

//     let te = f.transform( e );
//     t.equal( e.id, te.id, 'transformed entity id will be the same' );
//     t.ok( te.Robot, 'transformed entity will have Robot component' );
//     t.notOk( te.Mineral, 'transformed entity will not have Mineral component' );

//     t.end();
// });

// test('transform will exclude specified components on an entity', t => {
//     let e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );
//     let f = EntityFilter.create( EntityFilter.EXCLUDE, Components.Vegetable );

//     let te = f.transform( e );
//     t.equal( e.id, te.id, 'transformed entity id will be the same' );
//     t.ok( te.Mineral, 'transformed entity will have Mineral component' );
//     t.notOk( te.Vegetable, 'transformed entity will not have Vegetable component' );

//     t.end();
// });


// test('transform all on a single component', t => {
//     let e = createEntity( Components.Mineral, Components.Vegetable, Components.Robot );
//     let f = EntityFilter.create( ALL, Components.Vegetable );

//     let te = f.transform( e );
//     t.ok( te.Mineral, 'transformed entity will have Mineral component' );
//     t.ok( te.Robot, 'transformed entity will have Robot component' );
//     t.ok( te.Vegetable, 'transformed entity will not have Vegetable component' );

//     t.end();
// });




let MockComponent = function( attrs ){
    return Object.assign({}, attrs,{
        setEntityID: eid => this['_e'] = eid
    });
}

let ComponentDefs = {
    '/animal': { schemaIID:1, name:'Animal', schemaHash:'001' },
    '/mineral': { schemaIID:2, name:'Mineral', schemaHash:'002' },
    '/vegetable': { schemaIID:3, name:'Vegetable', schemaHash:'003' },
    '/doctor': { schemaIID:4, name:'Doctor', schemaHash:'004' },
    '/robot': { schemaIID:5, name:'Robot', schemaHash:'005' },
    '/flower': { schemaIID:6, name:'Flower', schemaHash:'006' }
};

let Components = _.reduce( ComponentDefs, (memo,val,key) => {
    memo[ val.name ] = val.schemaIID;
    return memo;
},{});

let ComponentIIDToObject = _.reduce( ComponentDefs, (memo,val,key) => {
    memo[ toInteger(val.schemaIID) ] = val;
    val['@s'] = val.schemaIID;
    return memo;
},[]);


function toBitField( ...componentIIDs ){
    if( componentIIDs.length <= 0 ){
        return BitField.create();
    }
    
    if( isEntity(componentIIDs[0]) ){
        return componentIIDs[0].getComponentBitfield();
    }
    
    return BitField.create( componentIIDs );
}

function createEntity( componentIIDs ){
    let ii,len,com;
    let args = Array.prototype.slice.call( arguments );

    let entity = Entity.create();
    entity.setEntityID( uniqueID() );
    
    for(ii=0,len=args.length;ii<len;i++){
        com = createComponent( args[ii] );
        entity.addComponent( com );
    }

    return entity;
}

function createComponent( componentIID ){
    let attrs;
    let result;
    let data;
    if( _.isObject(componentIID) ){
        attrs = _.omit( componentIID, '@c' );
        componentIID = componentIID['@c'];
    }
    result = new Component( {...attrs, '@c': uniqueID() } );
    data = ComponentIIDToObject[ componentIID ];
    _.each( data, (val,key) => result[ key ] = val );
    result.set( {'@s':data['@s']} );
    return result;
}

function createEntitySet(){
    let result = EntitySet.create();
    result._createComponentID = () => _.uniqueID();
    return result;
}
