'use strict';

let _ = require('underscore');
let test = require('tape');
let Backbone = require('backbone');
let Sinon = require('sinon');

module.exports = function( test, Common, Elsinore, CmdBuffer ){
    let Utils = Elsinore.Utils;
    let Entity = Elsinore.Entity;
    let Component = Elsinore.Component;

    test('adding a component with no entity id', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet();
        let com = createComponent();

        return cb.addComponent( es, com )
            .then(added => {
                t.equal( es.entitiesAdded.length, 1, 'one entity should be added' );
                t.equal( es.componentsAdded.length, 1, 'one component should be added' );
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('adding a component with an eid, but not a member of the es', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet( 50 );
        let com = createComponent( {_e:10} );

        return cb.addComponent( es, com )
            .then(added => {
                t.equal( es.entitiesAdded.length, 1, 'one entity should be added' );
                t.equal( es.componentsAdded.length, 1, 'one component should be added' );
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('adding a component with an eid, a non-member of the es', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet( 50 );
        let com = createComponent( {_e:11, _es:50} );

        return cb.addComponent( es, com )
            .then( added => {
                t.equal( es.entitiesAdded.length, 1, 'one entity should be added' );
                t.equal( es.componentsAdded.length, 1, 'one component should be added' );
                t.ok( Component.isComponent(added) );

            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    test('adding a component with an eid, an existing member of the es', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet( 50, [11] );
        let com = createComponent( {_e:11, _es:50} );

        return cb.addComponent( es, com )
            .then( added => {
                t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated' );
                t.equal( es.componentsAdded.length, 1, 'one component should be added' );
                t.ok( Component.isComponent(added) );
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    test('updating an existing component', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet( 50, [11] );
        let com = createComponent( {_e:11, _es:50} );

        es.getEntity = function(entityId){
            let e = createEntity(entityId);
            e.hasComponent = () => true;
            return Promise.resolve(e);
        }
        return cb.addComponent( es, com )
            .then( added => {
                t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated' );
                t.equal( es.componentsUpdated.length, 1, 'one component should be updated' );
                t.ok( Component.isComponent(added) );
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('adding an entity with multiple components', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet(60);
        let e = Entity.create();
        let coms = createComponent({tag:'soft',_s:3},{tag:'hard',_s:10});
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );

        return cb.addEntity( es, e )
            .then( added => {
                t.equal( es.entitiesAdded.length, 1, 'one entity should be added');
                t.equal( es.componentsAdded.length, 2, 'two components should be added');
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} ) 
    });

    test('updating an entity with a new component', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet(62, [10]);
        let e = Entity.create(10,62);
        let coms = createComponent({tag:'soft',_s:3},{tag:'hard',_s:10});
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );


        es.getEntity = function(entityId){
            // let e = createEntity(entityId);
            e.hasComponent = (cIId) => {
                return (cIId.getSchemaId() === 3);
            };
            return Promise.resolve(e);
        }

        return cb.addEntity( es, e )
            .then( added => {
                t.equal( es.entitiesAdded.length, 0, 'no entities should be added');
                t.equal( es.entitiesUpdated.length, 1, 'one entity should be updated');
                t.equal( es.componentsAdded.length, 1, 'one component should be added');
                t.equal( es.componentsUpdated.length, 1, 'one component should be updated' );
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    test('removing a component from an entity', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet(63, [12]);
        let e = Entity.create(12,63);
        let coms = createComponent({tag:'soft',_s:4},{tag:'hard',_s:10},{tag:'kik',_s:13});
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );

        es.getEntity = function(entityId){
            // let e = createEntity(entityId);
            e.hasComponent = (cIId) => true;
            return Promise.resolve(e);
        }

        return cb.removeComponent( es, coms[1] )
            .then( added => {
                t.equal( es.entitiesUpdated.length, 1, 'one entities should be updated');
                t.equal( es.componentsRemoved.length, 1, 'one component should be removed');
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    test('removing all components from an entity', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet(63, [12]);
        let e = Entity.create(12,63);
        let coms = createComponent({tag:'soft',_s:4},{tag:'hard',_s:10},{tag:'kik',_s:13});
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );

        es.getEntity = function(entityId){
            e.hasComponent = (cIId) => true;
            return Promise.resolve(e);
        }

        return cb.removeComponent( es, coms )
            .then( added => {
                t.equal( es.entitiesUpdated.length, 0, 'no entities should be updated');
                t.equal( es.entitiesRemoved.length, 1, 'one entitiy should be removed');
                t.equal( es.componentsUpdated.length, 0, 'no components should be updated');
                t.equal( es.componentsRemoved.length, 3, 'three components should be removed');
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });

    
    test('removing an existing entity', t => {
        let cb = CmdBuffer.create();
        let es = createEntitySet(64, [13]);
        let e = Entity.create(13,64);
        let coms = createComponent({tag:'soft',_s:4},{tag:'hard',_s:10},{tag:'kik',_s:13});
        _.each( coms, com => e.addComponent(com) );
        // printIns( e.getComponentBitfield().toString() );

        es.getEntity = function(entityId){
            // let e = createEntity(entityId);
            e.hasComponent = (cIId) => true;
            // e.hasComponent = (cIId) => {
            //     return (cIId.getSchemaId() === 3);
            // };
            return Promise.resolve(e);
        }

        return cb.removeEntity( es, e )
            .then( added => {
                t.equal( es.entitiesRemoved.length, 1, 'no entities should be added');
                t.equal( es.componentsRemoved.length, 3, 'three component should be added');
            })
            .then( () => t.end() )
            .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
    });


    

    

    function createEntitySet( entitySetId, entityIds ){
        entityIds = _.map( entityIds, id => Utils.setEntityIdFromId(id,entitySetId) );
        return _.extend({
            id: entitySetId,
            update: function( eAdd, eUp, eRem, cAdd, cUp, cRem ){
                [this.entitiesAdded,
                this.entitiesUpdated,
                this.entitiesRemoved,
                this.componentsAdded,
                this.componentsUpdated,
                this.componentsRemoved] = arguments;
                return Promise.resolve(true);
            },
            getEntity: function( entityId, options ){
                if( entityIds.indexOf(entityId) !== -1 ){
                    return Promise.resolve( createEntity(entityId) );
                }
                return Promise.resolve({});
            }
        }, Backbone.Events );
    }


    /**
    *   Creates a mock component
    */
    function createComponent( attrs ){
        // let args = _.toArray(arguments);
        if( arguments.length > 1 ){
            return _.map( arguments, arg => {
                return createComponent.call(this,arg);
                } );
        }

        // if( entitySetId ){
        //     entityId = Utils.setEntityIdFromId( entityId, entitySetId );
        // }

        var result = Component.create( attrs, {parse:true} );
        // printIns( result );
        return result;
    }


    function createEntity( entityId ){
        return Elsinore.Entity.create( entityId );
    }
};





// serverside only execution of tests
if( !process.browser ){
    let Elsinore = require('../lib');
    let CB = require('../lib/cmd_buffer/async');
    module.exports( require('tape'), require('./common'), Elsinore, CB );
}