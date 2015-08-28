'use strict';

var _ = require('underscore');
var Sinon = require('sinon');


module.exports = function( test, Common, Elsinore, EntitySet ){

    var Component = Elsinore.Component;
    var Entity = Elsinore.Entity;
    var EntityFilter = Elsinore.EntityFilter;
    let Query = Elsinore.Query;
    var Registry = Elsinore.Registry;

    test('type of entityset', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            t.ok( entitySet.isEntitySet, 'it is an entitySet' );
            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('non existence of an entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            t.ok( !entitySet.hasEntity(1001), 'entity not exist');
            t.end();
        });
    });

    test('adding an entity with a component returns the added entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();

            let entity = registry.createEntity( { id:'/component/position', x:2, y:-2 } );
            entity = entitySet.addEntity( entity );

            // printE( entitySet );

            t.ok( entity.getEntityId() > 0, 'the entity should have an id' );
            t.ok( entitySet.hasEntity(entity.id), 'the entity should exist');
            
            t.end();
        });
    });

    test('adding several components returns an array of added components', t => {
        var entities;
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            
            // let loadedEntitySet = Common.loadEntities( registry, 'entity_set.entities' );
            var data = Common.loadFixtureJSON( 'entity_set.entities.json' );
            var components = _.map( data, line => registry.createComponent( line ) );

            components = entitySet.addComponent( components );

            t.ok( Component.isComponent(components[0]), 'returns an array of components' );
            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    test('adding a component without an id or an entity id creates a new component and a new entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            var component;
            // Common.logEvents( entitySet );

            entitySet.on('all', eventSpy);
            component = entitySet.addComponent( registry.createComponent( '/component/position', {x:15,y:2}) );

            t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
            t.notStrictEqual( entitySet.at(0).Position, undefined, 'the entity should have the Position component as a property' );
            t.equals( component.get('x'), 15, 'returned value should be a component' );

            t.end();
        });
    });

    test('removing a component from an entity with only one component', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            var component;

            entitySet.on('all', eventSpy);

            component = entitySet.addComponent( 
                registry.createComponent( '/component/position', {x:15,y:2}) );

            // printE( entitySet );
            // printE( component );
            component = entitySet.removeComponent( component );

            t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');
            t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');
            // t.equals( component.getEntityId(), 0, 'component should not have an entity id');

            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('removing a component from an entity with multiple components', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            var entity;
            var component;
            var components;
            // Common.logEvents( entitySet );

            entitySet.on('all', eventSpy);

            components = registry.createComponent([
                { id:'/component/position', x:-100, y:20 },
                { id:'/component/radius', radius:30 },
            ]);

            entity = entitySet.addEntity( registry.createEntity(components) );
            component = entitySet.removeComponent( components[0] );

            // printE( component );
            // log.debug( component.getEntityId() );
            // printIns( eventSpy.getCall(2).args, 3 );

            t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');
            t.equals( entity.Position, undefined, 'the component is removed from the entity');

            t.end();
        });
    });

    test('you cant add an empty entity to an entityset', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();

            var e = Entity.create( 43 );

            entitySet.addEntity( e );

            t.equals( entitySet.size(), 0 );

            t.end();
        });
    });

    test('adding several components without an entity adds them to the same new entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            // Common.logEvents( entitySet );

            entitySet.on('all', eventSpy);
            entitySet.addComponent( [
                registry.createComponent( '/component/flower', {colour:'yellow'}),
                registry.createComponent( '/component/radius', {radius:2.0} )
                ]);

            t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
            t.notStrictEqual( entitySet.at(0).Flower, undefined, 'the entity should have a Flower component' );
            t.notStrictEqual( entitySet.at(0).Radius, undefined, 'the entity should have a Radius component' );

            return t.end();
        });
    });


    test('adding a component generates events', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            // Common.logEvents( entitySet );
            
            entitySet.on('all', eventSpy);

            entitySet.addComponent(
                registry.createComponent( '/component/position', {id:160,_e:15, x:0, y:20}) );

            t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
            t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
            
            t.end();
        });
    });

    test('adding several components at once generates a single add event', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            // Common.logEvents( entitySet );
            entitySet.on('all', eventSpy);

            entitySet.addComponent( [
                registry.createComponent( '/component/position', {id:1,_e:2, x:19, y:-2}),
                registry.createComponent( '/component/nickname', {id:2,_e:2, nick:'isaac'})
            ]);

            t.equals( eventSpy.callCount, 3, 'two events should have been emitted' );
            t.ok( eventSpy.calledWith('update'), 'update called' );
            t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
            t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
            t.end();
        });
    });


    test('adding an entity with components', t => {
        var com;
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            // Common.logEvents( entitySet );

            entitySet.on('all', eventSpy);

            var entity = Entity.create(16);
            entity.addComponent( (com=registry.createComponent( '/component/position', {id:5, x:2,y:-2})) );
            entity.addComponent( registry.createComponent( '/component/score', {id:6, score:100}) );
            entitySet.addEntity( entity );

            t.equals( eventSpy.callCount, 3, 'three events should have been emitted' );
            t.equals( entitySet.at(0).Position.get('x'), 2 );

            t.end();
        });
    });



    test('should return the number of entities contained', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();
            // Common.logEvents( entitySet );

            var pos = registry.createComponent( '/component/position', {id:1,_e:3});
            var nick = registry.createComponent( '/component/nickname', {id:2,_e:3});

            t.ok( pos.getEntityId(), 3 );
            t.ok( nick.getEntityId(), 3 );
            
            entitySet.addComponent( pos );

            t.equals( entitySet.size(), 1, 'should only be one entity' );

            entitySet.addComponent( nick );
            t.equals( entitySet.size(), 1, 'should only be one entity' );

            // retrieve an entity by id 3
            var entity = entitySet.getEntity(3);
            // printE( entitySet );
            // log.debug( entitySet.at(0).id + ' is e id ' + entitySet.id );

            t.ok( entity.Position, 'entity should have position' );
            t.ok( entity.Nickname, 'entity should have nickname' );
            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    test('should return an added entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );

            var entity = entities.at(0);
            entitySet.addComponent( entity.Position );
            var addedEntity = entitySet.at(0);
            t.equals( addedEntity.getEntityId(),  entity.getEntityId() );
            t.equals( addedEntity.Position.id,  entity.Position.id );
            t.end();
        });
    });

    test('should remove the entities component', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var entity;

            entity = entitySet.addEntity( registry.createEntity( {id:'/component/realname', name:'tom smith'} ) );
            
            entitySet.removeComponent( entity.Realname );

            t.equals( entitySet.size(), 0, 'the entityset will have removed the empty entity');
            t.notOk( entity.hasComponents(), 'the single entity should have no components' );

            t.end();
        });
    });

    test('should remove the entity belonging to a component', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet({allowEmptyEntities:false});
            var eventSpy = Sinon.spy();

            var entity = Entity.create(9);
            entity.addComponent( registry.createComponent( '/component/realname', {id:3, name:'tom smith'}) );

            entitySet.addComponent( entity.Realname );
            entitySet.removeComponent( entity.Realname );

            t.equals( entitySet.size(), 0, 'the entityset should have no entities')
            t.end();
        });
    });

    test('should remove a component reference from an entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );
            var addedEntity = entitySet.addEntity( entities.at(0) );

            t.ok( addedEntity.Realname !== undefined, 'the entity should have the Realname component' );
            
            entitySet.removeComponent( addedEntity.Realname );

            addedEntity = entitySet.at(0);
            
            t.ok( addedEntity.Realname === undefined, 'the entity should not have the Realname component' );

            t.end();
        });
    });

    test('should add an entity only once', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );  
            var entity = entities.at(0);

            entitySet.addEntity( entity );
            t.equals( entitySet.size(), 1);
            entitySet.addEntity( entity );
            t.equals( entitySet.size(), 1);
            t.end();
        });
    });


    test('should remove an entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );  

            var entity = entities.at(0);
            entitySet.addEntity( entity );
            t.equals( entitySet.size(), 1);

            // log.debug('>----- from here');
            entitySet.removeEntity( entity );
            t.equals( entitySet.size(), 0);

            // printE( entities );
            // printE( entities.at(1).Status );
            // printE( entities.at(3).Status );

            // log.debug('1st ' + entities.at(1).Status.hash(true) );
            // log.debug('1st ' + entities.at(3).Status.hash(true) );


            t.end();
        });
    });

    test('should really remove an entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();

            // Common.logEvents( entitySet );

            var entityA = entitySet.addEntity(
                registry.createEntity([
                    { id:'/component/flower', colour:'blue'},
                    { id:'/component/position', x:10, y:60 }] ));

            var entityB = entitySet.addEntity(
                registry.createEntity([
                    { id:'/component/vegetable', name:'cauliflower'},
                    { id:'/component/radius', radius:0.3 }] ));

            entitySet.removeEntity( entityB );

            t.equals( entitySet.length, 1 );
            t.end();
        });
    });

    test('should add the components of an entity', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );

            entitySet.addEntity( entities.at(0) );
            
            var addedEntity = entitySet.at(0);
            t.notEqual( addedEntity.Realname, undefined );
            t.end();
        });
    });

    test('should emit an event when an entity is added', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );
                
            entitySet.on('entity:add', eventSpy );
            entitySet.addEntity( entities.at(0) );
            
            t.ok( eventSpy.called, 'entity:add should have been called' );
            t.end();
        });
    });

    test('should emit an event when an entity is removed', t => {
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var eventSpy = Sinon.spy();

            var entities = Common.loadEntities( registry );
            var entity = entities.at(0);
                
            entitySet.on('entity:remove', eventSpy );
            entitySet.addEntity( entity );
            entitySet.removeEntity( entity );

            t.ok( eventSpy.called, 'entity:remove should have been called' );
            t.end();
        });
    });

    test('should not emit an event when a non-existent component is removed', t => {
        return Common.initialiseRegistry().then( registry => {
            var eventSpy = Sinon.spy();
            var entitySet = Common.loadEntities( registry );
            var component = registry.createComponent( '/component/position', {x:-1,y:-1}, {eid:26} );

            component = entitySet.removeComponent( component );

            t.notOk( eventSpy.calledWith('component:remove'), 'component:remove should not have been called');

            t.end();
        });
    });


    test('should only add a component of an accepted type', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            var eventSpy = Sinon.spy();
            // Common.logEvents( entitySet );
            // printE( entities );
            // setting an entity filter means that the entitySet will
            // only add components that pass through the filter
            EntitySet.setQuery( entitySet, Query.all('/component/position') );

            entitySet.addEntity( entities.at(0) );

            t.equals( entitySet.size(), 1);

            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )

    });

    

    test('should only retain the included component on entity', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            
            EntitySet.setQuery( entitySet, Query.include('/component/nickname') );

            // printIns( entities.at(0).getRegistry(), 1 );
            // printE( entities.at(0) );

            entitySet.addEntity( entities.at(0) );

            // printE( entitySet );
            // the entity won't have any of the other components
            t.equals( entitySet.at(0).getComponentCount(), 1);
            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('should not add entities that have excluded components', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            EntitySet.setQuery( entitySet, Query.none('/component/score') );

            entitySet.addEntity( entities.at(1) );
            t.equals( entitySet.size(), 0);
            entitySet.addEntity( entities.at(0) );
            t.equals( entitySet.size(), 1);

            t.end();
        });
    });

    test('should not add entities that have multiple excluded components', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            EntitySet.setQuery( entitySet, Query.none(['/component/score','/component/nickname']) );
            entitySet.addEntity( entities );
            t.equals( entitySet.size(), 1);
            t.end();
        });
    });

    test('should only add entities that are included', t => {
        return initialise().then( ([registry,entitySet,entities]) => {

            // this means that any entity MUST have a Position and Nickname
            EntitySet.setQuery( entitySet, Query.all(['/component/position','/component/nickname']) );
            entitySet.addEntity( entities );
            t.equals( entitySet.size(), 2);
            t.end();
        });
    });

    test('should only add entities that are optional', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            // this means that the entity MAY have Position and/or Nickname
            EntitySet.setQuery( entitySet, Query.any(['/component/position','/component/nickname']) );
            entitySet.addEntity( entities );
            t.equals( entitySet.size(), 4);

            t.end();
        });
    });


    test('should only add entities that pass include/exclude', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            EntitySet.setQuery( entitySet,
                Query.commands(
                    Query.all('/component/position'), 
                    Query.none('/component/realname')
                ) );
            // EntitySet.setQuery( entitySet,
                // Query.all('/component/position').none('/component/realname') ); 

            entitySet.addEntity( entities );

            t.equals( entitySet.size(), 1);
            t.end();
        })
        .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )     
    });

    test('should remove entities that are excluded after their components change', t => {
        return initialise({allowEmptyEntities:false}).then( ([registry,entitySet,entities]) => {
        // var registry = Common.initialiseRegistry();
        // var entitySet = registry.createEntitySet({allowEmptyEntities:false});
        // var entities = Common.loadEntities( registry );

            EntitySet.setQuery( entitySet, Query.none('/component/realname') );
            
            entitySet.addEntity( entities );
            t.equals( entitySet.size(), 2);
            
            var entity = entities.at(1);
            var component = registry.createComponent( '/component/realname', {name:'mike smith', _e:entity.getEntityId()});
            // this action should cause the entity to be removed
            entitySet.addComponent( component );
            t.equals( entitySet.size(), 1);

            t.end();
        });
    });

    test('should remove entities that no longer included after their components change', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            EntitySet.setQuery( entitySet, Query.all('/component/nickname') );
            entitySet.addEntity( entities );
            
            t.equals( entitySet.size(), 3, 'two entities which have Nickname');
            var entity = entities.at(0);

            // removing the Nickname component should mean the entity is also removed
            entitySet.removeComponent( entity.Nickname );
            t.equals( entitySet.size(), 2);
            t.end();
        });
    });

    test('should remove entities that are no longer allowed when the component mask changes', t => {
        return initialise().then( ([registry,entitySet,entities]) => {        
            entitySet.addEntity( entities );
            t.equals( entitySet.size(), 5);

            EntitySet.setQuery( entitySet, Query.none('/component/score') );
            t.equals( entitySet.size(), 2);
            t.end();
        });
    });

    test.skip('should filter', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            var positionIId = registry.getIId( '/component/position' );
                
            entitySet.addEntity( entities );

            var selected = entitySet.filter( function(e){
                return e.getComponentBitfield().get( positionIId );
            });

            t.equals( selected.length, 3);
            t.end();
        });
    });

    // test('should remove components for an entity', t => {
    //     return beforeEach(true).then( function(){
    //         var entity = entities.at(0);

    //         entitySet.addEntity( entity );
    //         entitySet.removeEntity( entity );
    //         t.end();
    //     });
    // });

    test('should emit an event when a component is changed', t => {
        return initialise().then( ([registry,entitySet,entities]) => {

            var entity = entities.at(0);
            var cloned, component = entity.Position;
            var spy = Sinon.spy();

            entitySet.on('component:change', spy);

            entitySet.addEntity( entity );

            cloned = registry.cloneComponent( component );
            cloned.set({x:0,y:-2});

            entitySet.addComponent( cloned );

            t.ok( spy.called, 'component:change should have been called' );

            t.end();
        });
    });

    test('emit event when an entity component is changed', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
            var spy = Sinon.spy();
            // Common.logEvents( entitySet );
            
            entitySet.on('component:change', spy);

            var entityA = registry.createEntity( { id:'/component/flower', colour:'white'} );
            entityA = entitySet.addEntity( entityA );

            // printE( entitySet );

            var entityB = registry.createEntity( { id:'/component/flower', colour:'blue'}, {id:entityA.getEntityId()} );
            t.equal( entityA.getEntityId(), entityB.getEntityId(), 'the entity ids should be equal' );
            entityB = entitySet.addEntity( entityB );    

            t.ok( spy.called, 'component:change should have been called' );

            // printE( entitySet );

            t.end();
        });
    });



    test('should clear all contained entities by calling reset', t => {
        return initialise().then( ([registry,entitySet,entities]) => {

            var spy = Sinon.spy();

            entitySet.on('reset', spy);
            entitySet.addEntity( entities );
            t.equals( entitySet.size(),  entities.size() );

            entitySet.reset(null);
            t.equals( entitySet.size(), 0);
            t.ok( spy.called, 'reset should have been called' );
            t.end();
        });
    });


    test('attached entitysets', t => {
        return initialise().then( ([registry,entitySet,entities]) => {
        
            // other ES will accept only entities with Position and Realname
            var oEntitySet = registry.createEntitySet();
            // set a filter on the other entitySet so that it will only accept components that
            // have /position and /realname
            EntitySet.setQuery( oEntitySet, 
                Query.all(['/component/position','/component/realname']) );

            // make the other entitySet listen to the origin entitySet
            oEntitySet.attachTo( entitySet );

            // add some entities to the origin entitySet
            entitySet.addEntity( entities.at(0) );
            entitySet.addEntity( entities.at(4) );

            // these added entities should end up in the other entityset
            t.equals( oEntitySet.size(), 2 );

            t.end();
        });
    });


    test('map transfers an entitySet through a filter into another entityset', t => {
        var eventSpy = Sinon.spy();
        return initialise().then( ([registry,entitySet,entities]) => {
            var oEntitySet = registry.createEntitySet();
            var entityFilter = Query.include('/component/score');

            // printE( loadedEntitySet );

            oEntitySet.on('all', eventSpy);

            // Common.logEvents( oEntitySet );
            // map the entities from the loaded set into the other set, using the entityfilter
            EntitySet.map( entities, entityFilter, oEntitySet );
            // loadedEntitySet.map( entityFilter, oEntitySet );

            // printIns( eventSpy.args[1] );
            t.equal( _.size(eventSpy.args[1][1]), 3, 'three components reported as being added' );
            t.equal( _.size(eventSpy.args[2][1]), 3, 'three entities reported as being added' );

            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    test('map transfers an entitySet through a filter into another entityset again', t => {
        var eventSpy = Sinon.spy();
        return initialise().then( ([registry,entitySet,entities]) => {
            var oEntitySet = registry.createEntitySet();
            var entityFilter = Query.none('/component/position');

            oEntitySet.on('all', eventSpy);

            // Common.logEvents( oEntitySet );
            // map the entities from the loaded set into the other set, using the entityfilter
            EntitySet.map( entities, entityFilter, oEntitySet );
            // loadedEntitySet.map( entityFilter, oEntitySet );

            // printE( loadedEntitySet );
            // printE( oEntitySet );

            t.equal( _.size(eventSpy.args[1][1]), 2, 'three components reported as being added' );
            t.equal( _.size(eventSpy.args[2][1]), 2, 'two entities reported as being added' );

            t.end();
        })
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    

    test.skip('iterator', t => {
        var it, entity, count;
        return initialise().then( ([registry,entitySet,entities]) => {


            entitySet.addEntity( entities );
            entitySet.removeEntity( entities.at(3) );
            count = 0;

            for( entity of entitySet ){
                count++;
            }
            
            t.equals( count, 4, 'four entities should have been returned' );

            t.end();
        });
    });

    // test('async iterator completest with a rejection', t => {
    //     var it, entity, count;
    //     var registry = Common.initialiseRegistry();
    //     var entitySet = registry.createEntitySet();
    //     var entities = Common.loadEntities( registry );

    //     // add a single entity
    //     entitySet.addEntity( entities.at(0) );

    //     it = entitySet.iterator();

    //     // the first call will return the entity
    //     it.next().then( function(e){
    //         // the second call should be rejected
    //         it.next().then( null, function(state){
    //             t.ok( state.done, true, 'the state should be done' );
    //             t.end();
    //         })
    //     });
    // });

    // test('async iterator', t => {
    //     var it, entity, count;
    //     var registry = Common.initialiseRegistry();
    //     var entitySet = registry.createEntitySet();
    //     var entities = Common.loadEntities( registry );

    //     entitySet.addEntity( entities );

    //     entitySet.removeEntity( entities.at(3) );

    //     count = 0;

    //     it = entitySet.iterator();

    //     return Utils.reduceIterator( it, function(memo,item){
    //         memo.push( item );
    //         // printE( item );
    //     }, [] )
    //     .then( function(results){
    //         // printE( results );
    //         t.equals( results.length, 4, 'four entities should have been returned' );
    //         t.end();
    //     });
    // });

    function initialise(){
        return Common.initialiseRegistry().then( registry => {
            var entitySet = registry.createEntitySet();
            var entities = Common.loadEntities( registry );
            return [registry,entitySet,entities];    
        });
    }



}

// serverside only execution of tests
if( !process.browser ){
    let Common = require('./common');
    var Elsinore = Common.Elsinore;
    
    module.exports( require('tape'), Common, Elsinore, Elsinore.EntitySet );
}