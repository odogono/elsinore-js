'use strict';

let _ = require('underscore');
let BitField = require('odgn-bitfield');
let Sinon = require('sinon');


module.exports = function( test, Common, Elsinore, EntitySet ){

    
    let Component = Elsinore.Component;
    let Entity = Elsinore.Entity;
    let EntityFilter = Elsinore.EntityFilter;
    let Registry = Elsinore.Registry;



    test('an default filter will accept an entity', t => {
        let e = Entity.create();
        t.ok( EntityFilter.accept(EntityFilter.ALL, toBitField(e), toBitField() ), 
            'the filter accepts an entity by default' );
        t.end();
    });

    test('will reject entities without components', t => {
        let e = Entity.create();
        t.notOk( 
            EntityFilter.accept( EntityFilter.SOME, e.getComponentBitfield() ), 
            'the filter rejects the entity without components');
        t.end();
    });

    test('will accept entities with one of the components', t => {
        let type = EntityFilter.ANY;
        let bitField = toBitField( Components.Animal, Components.Doctor );

        t.ok( EntityFilter.accept(type, toBitField(Components.Animal), bitField) );
        t.notOk( EntityFilter.accept(type, toBitField(Components.Mineral), bitField) );
        t.ok( EntityFilter.accept(type, toBitField(Components.Doctor), bitField) );
        t.ok( EntityFilter.accept(type, toBitField(Components.Robot, Components.Animal), bitField) );

        t.end();
    });

    test('reject an entity which does not have a specific component', t => {
        let e = Entity.create();
        let type = EntityFilter.ALL;
        let bitField = toBitField( Components.Flower );

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
        let type = EntityFilter.ALL;
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
        let type = EntityFilter.ANY;
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
        let type = EntityFilter.NONE;
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
        f.add( EntityFilter.ALL, toBitField(Components.Animal,Components.Mineral) );
        f.add( EntityFilter.ALL, toBitField(Components.Vegetable) );

        t.deepEquals( f.getValues(), [Components.Animal,Components.Mineral,Components.Vegetable] );

        t.end();
    });

    test('combine filters into a single', t => {
        let a = EntityFilter.create( EntityFilter.ALL, toBitField(Components.Animal,Components.Mineral) );
        let b = EntityFilter.create( EntityFilter.ALL, toBitField(Components.Vegetable) );

        let c = EntityFilter.create( a );
        c.add( b );

        t.deepEquals( c.getValues(), [Components.Animal,Components.Mineral,Components.Vegetable] );
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
//     let f = EntityFilter.create( EntityFilter.ALL, Components.Vegetable );

//     let te = f.transform( e );
//     t.ok( te.Mineral, 'transformed entity will have Mineral component' );
//     t.ok( te.Robot, 'transformed entity will have Robot component' );
//     t.ok( te.Vegetable, 'transformed entity will not have Vegetable component' );

//     t.end();
// });




    let MockComponent = function( attrs ){
        return _.extend({}, attrs,{
            setEntityId: eid => this['_e'] = eid
        });
    }

    let ComponentDefs = {
        '/animal': { schemaIId:1, name:'Animal', schemaHash:'001' },
        '/mineral': { schemaIId:2, name:'Mineral', schemaHash:'002' },
        '/vegetable': { schemaIId:3, name:'Vegetable', schemaHash:'003' },
        '/doctor': { schemaIId:4, name:'Doctor', schemaHash:'004' },
        '/robot': { schemaIId:5, name:'Robot', schemaHash:'005' },
        '/flower': { schemaIId:6, name:'Flower', schemaHash:'006' }
    };

    let Components = _.reduce( ComponentDefs, (memo,val,key) => {
        memo[ val.name ] = val.schemaIId;
        return memo;
    },{});

    let ComponentIIdToObject = _.reduce( ComponentDefs, (memo,val,key) => {
        memo[ parseInt(val.schemaIId,10) ] = val;
        val._s = val.schemaIId;
        return memo;
    },[]);


    function toBitField( componentIIds ){
        let args = _.toArray( arguments );
        if( args.length <= 0 ){
            return BitField.create();
        }
        
        if( Entity.isEntity(componentIIds) ){
            return componentIIds.getComponentBitfield();
        }
        
        return BitField.create( args );
    }

    function createEntity( componentIIds ){
        let ii,len,com;
        let args = Array.prototype.slice.call( arguments );

        let entity = Entity.create();
        entity.setEntityId( _.uniqueId() );
        
        for(ii=0,len=args.length;ii<len;i++){
            com = createComponent( args[ii] );
            entity.addComponent( com );
        }

        return entity;
    }

    function createComponent( componentIId ){
        let attrs;
        let result;
        let data;
        if( _.isObject(componentIId) ){
            attrs = _.omit( componentIId, '_c' );
            componentIId = componentIId._c;
        }
        result = Component.create(_.extend( attrs, {id: _.uniqueId() }) );
        data = ComponentIIdToObject[ componentIId ];
        _.each( data, (val,key) => result[ key ] = val );
        result.set( {_s:data._s} );
        return result;
    }

    function createEntitySet(){
        let result = EntitySet.create();
        result._createComponentId = () => _.uniqueId();
        return result;
    }




}

// serverside only execution of tests
if( !process.browser ){
    let Common = require('./common');
    let Elsinore = Common.Elsinore;
    module.exports( require('tape'), Common, Elsinore, Elsinore.EntitySet );
}