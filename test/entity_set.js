import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {
    Component, Entity, EntityFilter, EntitySet,
    Registry, SchemaRegistry,
    initialiseRegistry,
    isInteger, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    logEvents,
    requireLib,
} from './common';



test('type of entityset', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        t.ok( entitySet.isEntitySet, 'it is an entitySet' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('entityset has a uuid assigned', t => {
    return initialiseRegistry().then( registry => {
        let es = registry.createEntitySet();
        t.equals( es.getUuid().length, 36 );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
})

test('non existence of an entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        t.ok( !entitySet.hasEntity(1001), 'entity not exist');
        t.end();
    });
});

test('adding an entity with a component returns the added entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();

        let entity = registry.createEntity( [{'@c':'/component/position', x:2, y:-2}]);
        entity = entitySet.addEntity( entity );

        // printE( entitySet );

        t.ok( entity.getEntityId() > 0, 'the entity should have an id' );
        t.ok( entitySet.hasEntity(entity.id), 'the entity should exist');
        
        t.end();
    }).catch( err => log.error('test error: %s', err.stack) )

});

test('adding several components returns an array of added components', t => {
    let entities;
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        
        // let loadedEntitySet = loadEntities( registry, 'entity_set.entities' );
        let data = loadFixtureJSON( 'entity_set.entities.json' );
        let components = _.map( data, line => registry.createComponent( line ) );

        components = entitySet.addComponent( components );

        t.ok( Component.isComponent(components[0]), 'returns an array of components' );
        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


test('adding a component without an id or an entity id creates a new component and a new entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
        let component;
        // Common.logEvents( entitySet );

        entitySet.on('all', eventSpy);
        component = entitySet.addComponent( registry.createComponent( '/component/position', {x:15,y:2}) );

        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called');
        t.notStrictEqual( entitySet.at(0).Position, undefined, 'the entity should have the Position component as a property' );
        t.equals( component.get('x'), 15, 'returned value should be a component' );

        t.end();
    });
});

test('adding a component which is already a member', t => {
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        // logEvents(entitySet);

        const component = registry.createComponent('/component/position', {x:200, y:0});
        t.equals( component.id, undefined, 'the component should be created without a valid id' );
        // console.log(`new component '${component.id}'`);

        const inserted = entitySet.addComponent( component );
        t.ok( isInteger(inserted.id), 'the component will have been assigned an id' );
        t.notEqual( component.id, inserted.id, 'the inserted component is a different copy');
        
        // change the fields of the component
        // note - if we changed the attributes of the inserted component, it would also
        // change inside the entityset
        component.set({x:200,y:100,id:inserted.id});
        entitySet.addComponent( component ); // update

        // the previously inserted component instance no longer has an entity reference because it
        // has been superceded
        // t.equal( inserted.getEntityId(), 0 );

        // change the fields and insert again
        component.set({x:200,y:-200});
        entitySet.addComponent( component );

        entitySet.addComponent( inserted );

        t.equals( entitySet.size(), 1 );

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )

});


test('updating a component should not replace the instance already in the entityset', t => {
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        // logEvents(entitySet);

        // add the component to the registry
        // what we get back is a copy of the passed component, with an id assigned
        const component = entitySet.addComponent(registry.createComponent('/component/position', {x:10,y:-1}));
        const componentEntityId = component.getEntityId();
        const componentCid = component.cid;
        
        let update = registry.cloneComponent(component,{x:300,y:200});
        entitySet.addComponent(update);
        
        // the original component will now have updated attributes
        t.equal( component.get('x'), 300 );
        t.equal( component.get('y'), 200 );
        t.equal( component.getEntityId(), componentEntityId, 'the component should retain its entity id' );
        t.equal( component.cid, componentCid, 'the internal id remains the same' );

        // printE( component );
        // printE( update );
        // console.log(`what the chuff ${componentEntityId} ${component.getEntityId()}`);
        // printE( component );
    })
    .then(() => t.end())
    .catch(err => log.error('test error: %s', err.stack))
});


test('removing a component from an entity with only one component', t => {
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        
        entitySet.on('all', eventSpy);

        let component = entitySet.addComponent( 
            registry.createComponent( '/component/position', {x:15,y:2}) );

        // printE( entitySet );
        // printE( component );
        component = entitySet.removeComponent( component );

        t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');
        t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called');
        // t.equals( component.getEntityId(), 0, 'component should not have an entity id');

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});

test('removing a component from an entity with multiple components', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
        let entity;
        let component;
        let components;
        // Common.logEvents( entitySet );

        entitySet.on('all', eventSpy);

        components = registry.createComponent([
            { '@c':'/component/position', x:-100, y:20 },
            { '@c':'/component/radius', radius:30 },
        ]);

        entity = entitySet.addEntity(registry.createEntity( components));
        component = entitySet.removeComponent( components[0] );

        // printE( component );
        // log.debug( component.getEntityId() );
        // printIns( eventSpy.getCall(2).args, 3 );

        t.ok( eventSpy.calledWith('component:remove'), 'component:remove should have been called');
        t.equals( entity.Position, undefined, 'the component is removed from the entity');

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack))
});

test('you cant add an empty entity to an entityset', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();

        let e = registry.createEntityWithId(43);

        entitySet.addEntity( e );

        t.equals( entitySet.size(), 0 );

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack))
});

test('adding several components without an entity adds them to the same new entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
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
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
        // Common.logEvents( entitySet );
        
        entitySet.on('all', eventSpy);

        entitySet.addComponent(
            registry.createComponent( '/component/position', {id:160,'@e':15, x:0, y:20}) );

        t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
        
        t.end();
    });
});

test('adding several components at once generates a single add event', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
        // Common.logEvents( entitySet );
        entitySet.on('all', eventSpy);

        entitySet.on('add', function(){
            throw new Error('stop!');
        })

        entitySet.addComponent( [
            registry.createComponent( '/component/position', {id:1,'@e':2, x:19, y:-2}),
            registry.createComponent( '/component/nickname', {id:2,'@e':2, nick:'isaac'})
        ]);

        t.equals( eventSpy.callCount, 2, 'two events should have been emitted' );
        // t.ok( eventSpy.calledWith('update'), 'update called' );
        t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});


test('adding an entity with components', t => {
    let com;
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();
        // Common.logEvents( entitySet );

        entitySet.on('all', eventSpy);

        let entity = registry.createEntityWithId(16);
        entity.addComponent( (com=registry.createComponent( '/component/position', {id:5, x:2,y:-2})) );
        entity.addComponent( registry.createComponent( '/component/score', {id:6, score:100}) );
        entitySet.addEntity( entity );

        t.equals( eventSpy.callCount, 2, 'two events should have been emitted' );
        t.ok( eventSpy.calledWith('component:add'), 'component:add should have been called' );
        t.ok( eventSpy.calledWith('entity:add'), 'entity:add should have been called' );
        t.equals( entitySet.at(0).Position.get('x'), 2 );

        t.end();
    });
});



test('should return the number of entities contained', t => {
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();
        // 

        const pos = registry.createComponent( '/component/position', {id:1,'@e':3});
        const nick = registry.createComponent( '/component/nickname', {id:2,'@e':3});

        t.ok( pos.getEntityId(), 3 );
        t.ok( nick.getEntityId(), 3 );
        
        entitySet.addComponent( pos );
        // t.equals( entitySet.size(), 1, 'should only be one entity' );

        // logEvents( entitySet );
        entitySet.addComponent( nick );
        // printE( entitySet );
        t.equals( entitySet.size(), 1, 'should only be one entity' );

        // retrieve an entity by id 3
        const entity = entitySet.getEntity(3);
        
        // log.debug( entitySet.at(0).id + ' is e id ' + entitySet.id );

        t.ok( entity.Position, 'entity should have position' );
        t.ok( entity.Nickname, 'entity should have nickname' );
        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


test('should return an added entity', t => {
    return initialiseRegistry().then( registry => {
        const entitySet = registry.createEntitySet();
        const eventSpy = Sinon.spy();

        const entities = loadEntities( registry );

        const entity = entities.at(0);
        entitySet.addComponent( entity.Position );

        const addedEntity = entitySet.at(0);

        t.equals( addedEntity.getEntityId(),  entity.getEntityId(), 'the component retains its entity id' );
        t.notEqual( addedEntity.Position.id,  entity.Position.id, 'the added component is a clone' );
        t.end();
    });
});

test('should remove the entities component', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let entity;

        entity = entitySet.addEntity(registry.createEntity( [{'@c':'/component/realname', name:'tom smith'}]));

        // entity = entitySet.addEntity( registry.createEntity( {'@c':'/component/realname', name:'tom smith'} ) );
        
        entitySet.removeComponent( entity.Realname );

        t.equals( entitySet.size(), 0, 'the entityset will have removed the empty entity');
        t.notOk( entity.hasComponents(), 'the single entity should have no components' );

        t.end();
    });
});

test('should remove the entity belonging to a component', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet({allowEmptyEntities:false});
        let eventSpy = Sinon.spy();

        let entity = registry.createEntityWithId(9);
        entity.addComponent( registry.createComponent( '/component/realname', {id:3, name:'tom smith'}) );

        entitySet.addComponent( entity.Realname );
        entitySet.removeComponent( entity.Realname );

        t.equals( entitySet.size(), 0, 'the entityset should have no entities')
        t.end();
    });
});

test('should remove a component reference from an entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities( registry );
        let addedEntity = entitySet.addEntity( entities.at(0) );

        t.ok( addedEntity.Realname !== undefined, 'the entity should have the Realname component' );
        
        entitySet.removeComponent( addedEntity.Realname );

        addedEntity = entitySet.at(0);
        
        t.ok( addedEntity.Realname === undefined, 'the entity should not have the Realname component' );

        t.end();
    });
});

test('should add an entity only once', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();


        let entities = loadEntities( registry );  
        let entity = entities.at(0);

        // Common.logEvents( entitySet );

        entitySet.addEntity( entity );
        t.equals( entitySet.size(), 1);
        entitySet.addEntity( entity );
        t.equals( entitySet.size(), 1);
        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});


test('should remove an entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities( registry );  

        let entity = entities.at(0);
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
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();

        // Common.logEvents( entitySet );

        let entityA = entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/flower', colour:'blue'},
                { '@c':'/component/position', x:10, y:60 }] ));

        let entityB = entitySet.addEntity(
            registry.createEntity([
                { '@c':'/component/vegetable', name:'cauliflower'},
                { '@c':'/component/radius', radius:0.3 }] ));

        entitySet.removeEntity( entityB );

        t.equals( entitySet.length, 1 );
        t.end();
    });
});

test('should add the components of an entity', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities( registry );

        entitySet.addEntity( entities.at(0) );
        
        let addedEntity = entitySet.at(0);
        t.notEqual( addedEntity.Realname, undefined );
        t.end();
    });
});

test('should emit an event when an entity is added', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities( registry );
            
        entitySet.on('entity:add', eventSpy );
        entitySet.addEntity( entities.at(0) );
        
        t.ok( eventSpy.called, 'entity:add should have been called' );
        t.end();
    });
});

test('should emit an event when an entity is removed', t => {
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let eventSpy = Sinon.spy();

        let entities = loadEntities( registry );
        let entity = entities.at(0);
            
        entitySet.on('entity:remove', eventSpy );
        entitySet.addEntity( entity );
        entitySet.removeEntity( entity );

        t.ok( eventSpy.called, 'entity:remove should have been called' );
        t.end();
    });
});

test('should not emit an event when a non-existent component is removed', t => {
    return initialiseRegistry().then( registry => {
        let eventSpy = Sinon.spy();
        let entitySet = loadEntities( registry );
        entitySet.on('all', eventSpy );
        let component = registry.createComponent( '/component/position', {x:-1,y:-1}, {eid:26} );

        component = entitySet.removeComponent( component );

        t.notOk( eventSpy.calledWith('component:remove'), 'component:remove should not have been called');

        t.end();
    });
});



test('adding an entity with an identical id will replace the existing one', t => {
   return initialiseRegistry().then( registry => {
       let entitySet = registry.createEntitySet();
       let eventSpy = Sinon.spy();
       entitySet.on('component:change', eventSpy );

    //    logEvents(entitySet);

       // let entities = loadEntities( registry );  
       // let entity = entities.at(0);
       let entityA = registry.createEntity([
            {'@c':'/component/position', x:0,y:0}
        ]);
       // printE( entityA );
       // printIns( entityA );
       let entityB = registry.createEntity([
            {'@c':'/component/position', x:15,y:-90},
            {'@c':'/component/status', 'status':'active'}
        ]);

       entityB.setId( entityA.id );

       entitySet.addEntity( entityA );
       entitySet.addEntity( entityB );
       
       const addedEntity = entitySet.at(0);
       t.equals( entitySet.size(), 1);
       t.ok( eventSpy.calledOnce, `component:change was called ${eventSpy.callCount} times`);
       t.equals( addedEntity.Status.get('status'), 'active' );
       t.equals( addedEntity.Position.get('x'), 15 );
    //    printE( entitySet );
       t.end();
   })
   .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} ) 
})


test('should only add a component of an accepted type', async t => {
    try{
    const [registry,entitySet,entities] = await initialise();
    
    let eventSpy = Sinon.spy();
    // Common.logEvents( entitySet );
    // printE( entities );
    // setting an entity filter means that the entitySet will
    // only add components that pass through the filter
    entitySet.setQuery(Q => Q.all('/component/position') );

    entitySet.addEntity( entities.at(0) );

    t.equals( entitySet.size(), 1);

    t.end();
    } catch(err){ log.error('test error: %s', err.stack); }
});



test('should only retain the included component on entity', async t => {
    try{
    const [registry,entitySet,entities] = await initialise();
        
    entitySet.setQuery(Q => Q.include('/component/nickname') );

    entitySet.addEntity( entities.at(0) );

    // the entity won't have any of the other components
    t.equals( entitySet.at(0).getComponentCount(), 1);
    
    t.end();
    } catch(err){ log.error('test error: %s', err.stack); }
});

test('should not add entities that have excluded components', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        entitySet.setQuery(Q => Q.none('/component/score') );

        entitySet.addEntity( entities.at(1) );
        t.equals( entitySet.size(), 0);
        entitySet.addEntity( entities.at(0) );
        t.equals( entitySet.size(), 1);

        t.end();
    });
});

test('should not add entities that have multiple excluded components', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        entitySet.setQuery( Q => Q.none(['/component/score','/component/nickname']) );
        entitySet.addEntity( entities );
        t.equals( entitySet.size(), 1);
        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});

test('should only add entities that are included', async t => {
    const [registry,entitySet,entities] = await initialise();
    // this means that any entity MUST have a Position and Nickname
    entitySet.setQuery( Q => Q.all(['/component/position','/component/nickname']) );
    entitySet.addEntity( entities );
    t.equals( entitySet.size(), 2);
    t.end();
});

test('should only add entities that are optional', async t => {
    const [registry,entitySet,entities] = await initialise();
    // this means that the entity MAY have Position and/or Nickname
    entitySet.setQuery( Q => Q.any(['/component/position','/component/nickname']) );
    entitySet.addEntity( entities );
    t.equals( entitySet.size(), 4);
    t.end();
});


test('should only add entities that pass include/exclude', async t => {
    try{ const [registry,entitySet,entities] = await initialise();
    
    entitySet.setQuery(
        Q =>[
            Q.all('/component/position'), 
            Q.none('/component/realname')
        ] );

    entitySet.addEntity( entities );
    t.equals( entitySet.size(), 1);
    
    t.end(); } catch(err){ log.error('test error: %s', err.stack); }     
});

test('should remove entities that are excluded after their components change', t => {
    return initialise({allowEmptyEntities:false}).then( ([registry,entitySet,entities]) => {
    // let registry = initialiseRegistry();
    // let entitySet = registry.createEntitySet({allowEmptyEntities:false});
    // let entities = loadEntities( registry );

        entitySet.setQuery(Q => Q.none('/component/realname') );
        
        entitySet.addEntity( entities );
        t.equals( entitySet.size(), 2);
        
        let entity = entities.at(1);
        let component = registry.createComponent( '/component/realname', {name:'mike smith', '@e':entity.getEntityId()});
        // this action should cause the entity to be removed
        entitySet.addComponent( component );
        t.equals( entitySet.size(), 1);

        t.end();
    });
});

test('should remove entities that no longer included after their components change', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        entitySet.setQuery(Q => Q.all('/component/nickname') );
        entitySet.addEntity( entities );
        
        t.equals( entitySet.size(), 3, 'two entities which have Nickname');
        let entity = entities.at(0);

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

        entitySet.setQuery(Q => Q.none('/component/score') );
        t.equals( entitySet.size(), 2);
        t.end();
    });
});

test.skip('should filter', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        let positionIId = registry.getIId( '/component/position' );
            
        entitySet.addEntity( entities );

        const selected = entitySet.filter( function(e){
            return e.getComponentBitfield().get( positionIId );
        });

        t.equals( selected.length, 3);
        t.end();
    });
});

// test('should remove components for an entity', t => {
//     return beforeEach(true).then( function(){
//         let entity = entities.at(0);

//         entitySet.addEntity( entity );
//         entitySet.removeEntity( entity );
//         t.end();
//     });
// });

test('should emit an event when a component is changed', t => {
    return initialise().then( ([registry,entitySet,entities]) => {

        let entity = entities.at(0);
        let cloned, component = entity.Position;
        const spy = Sinon.spy();

        entitySet.on('component:change', spy);

        entitySet.addEntity( entity );

        cloned = registry.cloneComponent( component );
        cloned.set({x:0,y:-2});

        entitySet.addComponent( cloned );

        t.ok( spy.called, 'component:change should have been called' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('emit event when an entity component is changed', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        const spy = Sinon.spy();
        
        entitySet.on('component:change', spy);

        let entityA = entitySet.addEntity( 
            registry.createEntity( [{'@c':'/component/flower', colour:'white'}]) );

        let entityB = registry.createEntity( 
            [{'@c':'/component/flower', colour:'blue'}], 
            {'@e':entityA.getEntityId()} );

        t.equal( entityA.getEntityId(), entityB.getEntityId(), 'the entity ids should be equal' );
        
        entityB = entitySet.addEntity( entityB );

        t.ok( spy.called, 'component:change should have been called' );

        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});

test('emit event when a component instance is changed', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        const spy = Sinon.spy();
        // Common.logEvents( entitySet );            
        entitySet.on('component:change', spy);

        let entityA = entitySet.addEntity( 
            registry.createEntity({'@c':'/component/flower', colour:'white'}) );
            // registry.createEntity( { '@c':'/component/flower', colour:'white'} ) );

        let component = entitySet.at(0).getComponentByIId('/component/flower');

        // calling set triggers an event which is forwarded by the enclosing
        // entity onto the surrounding entityset
        component.set({colour:'red'}, {debug:true});

        t.ok( spy.called, 'component:change should have been called' );
        t.end();
    })
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
});


test('mutating a previously added component does not affect the entityset', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        const spy = Sinon.spy();
        // logEvents( entitySet );

        const component = registry.createComponent({'@c':'/component/flower', colour:'blue'});

        entitySet.addComponent(component);

        const esComponent = entitySet.at(0).Flower;

        component.set({colour:'white'});

        t.equals( esComponent.get('colour'), 'blue', 'the es component retains its colour');
    })
    .then( () => t.end() )
    .catch( err => { log.debug('t.error: ' + err ); log.debug( err.stack );} )
})


test('should clear all contained entities by calling reset', t => {
    return initialise().then( ([registry,entitySet,entities]) => {

        const spy = Sinon.spy();

        entitySet.on('reset', spy);
        entitySet.addEntity( entities );
        t.equals( entitySet.size(),  entities.size() );

        entitySet.reset(null);
        t.equals( entitySet.size(), 0);
        t.ok( spy.called, 'reset should have been called' );
        t.end();
    });
});


test('attached entitysets', async t => {
    const [registry,entitySet,entities] = await initialise();
    
    // other ES will accept only entities with Position and Realname
    const oEntitySet = registry.createEntitySet();
    // set a filter on the other entitySet so that it will only accept components that
    // have /position and /realname
    oEntitySet.setQuery( Q => Q.all(['/component/position','/component/realname']) );

    // make the other entitySet listen to the origin entitySet
    oEntitySet.attachTo( entitySet );

    // add some entities to the origin entitySet
    entitySet.addEntity( entities.at(0) );
    entitySet.addEntity( entities.at(4) );

    // these added entities should end up in the other entityset
    t.equals( oEntitySet.size(), 2 );

    t.end();
});


test('map transfers an entitySet through a filter into another entityset', t => {
    let eventSpy = Sinon.spy();
    return initialise().then( ([registry,entitySet,entities]) => {
        let oEntitySet = registry.createEntitySet();
        let entityFilter = Q => Q.include('/component/score');

        // printE( loadedEntitySet );

        // Common.logEvents( oEntitySet );
        oEntitySet.on('all', eventSpy);

        // Common.logEvents( oEntitySet );
        // map the entities from the loaded set into the other set, using the entityfilter
        entities.map( entityFilter, oEntitySet );


        // loadedEntitySet.map( entityFilter, oEntitySet );

        // printIns( eventSpy.args[1] );

        t.ok( eventSpy.calledWith('reset'), 'entitySet should trigger a reset event');
        t.ok( eventSpy.calledWith('component:add'), 'entitySet should trigger a component:add event');
        t.ok( eventSpy.calledWith('entity:add'), 'entitySet should trigger a entity:add event');

        t.equal( _.size(eventSpy.args[1][1]), 3, 'three components reported as being added' );
        t.equal( _.size(eventSpy.args[2][1]), 3, 'three entities reported as being added' );

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


test('map transfers an entitySet through a filter into another entityset again', t => {
    let eventSpy = Sinon.spy();
    return initialise().then( ([registry,entitySet,entities]) => {
        const oEntitySet = registry.createEntitySet();
        let entityFilter = Q => Q.none('/component/position');

        oEntitySet.on('all', eventSpy);
        // Common.logEvents( oEntitySet );

        // Common.logEvents( oEntitySet );
        // map the entities from the loaded set into the other set, using the entityfilter
        entities.map( entityFilter, oEntitySet );
        // loadedEntitySet.map( entityFilter, oEntitySet );

        // printE( loadedEntitySet );
        // printE( oEntitySet );

        t.equal( _.size(eventSpy.args[1][1]), 5, 'three components reported as being added' );
        t.equal( _.size(eventSpy.args[2][1]), 2, 'two entities reported as being added' );

        t.end();
    })
    .catch( err => log.error('test error: %s', err.stack) )
});


test('possible to add 2 entities with same entityIds but different entityset ids', t => {
    return initialise().then( ([registry,entitySet,entities]) => {
        // logEvents( entitySet );
        
        let entityA = entities.at(0);
        let entityB = entities.at(1);

        entityA.setEntityId( 22 );
        entityA.setEntitySetId( 100 );
        entityB.setEntityId( 22 );
        entityB.setEntitySetId( 101 );

        entitySet.addEntity(entityA);
        entitySet.addEntity(entityB);
        
        t.equals( entitySet.size(), 2, 'two entities should have been added' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
})


test.skip('iterator', t => {
    let it, entity, count;
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
//     let it, entity, count;
//     let registry = initialiseRegistry();
//     let entitySet = registry.createEntitySet();
//     let entities = loadEntities( registry );

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
//     let it, entity, count;
//     let registry = initialiseRegistry();
//     let entitySet = registry.createEntitySet();
//     let entities = loadEntities( registry );

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
    return initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();
        let entities = loadEntities( registry );
        return [registry,entitySet,entities];    
    });
}
