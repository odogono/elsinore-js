'use strict';

let _ = require('underscore');
let test = require('tape');
let Sinon = require('sinon');

let Common = require('../common');
let Elsinore = Common.Elsinore;

let EntityProcessor = Elsinore.EntityProcessor;
let EntityFilter = Elsinore.EntityFilter;
let EntitySet = Elsinore.EntitySet;
let Query = Elsinore.Query;

/**
    This test demonstrates processors that use filters to determine which
    components it should operate on
*/
test('reaper', function(t){
    return Common.initialiseRegistry().then( registry => {
        let entitySet = registry.createEntitySet();

        return registry.registerComponent({
            connection: {id:'/connection', addr:{ type:'string' }},
            ttl: {id:'/ttl', expires_at:{ type:'number' }},
            dead: {id:'/dead'}
        })
        .then( () => [registry,entitySet] )
    })
    .then( ([registry,entitySet]) => {

        // printIns( registry.schemaRegistry );
        // printIns( registry.schemaRegistry.get('/connection') );
        // let cConnection, cTimeToLive, cDead;
        let ConnectionProcessor, ReaperProcessor;
        let reaperProcessor, connectionProcessor;

        let eventSpy = Sinon.spy();

        entitySet.on('all', eventSpy);

        /**
        *   The reaper processor looks out for entities that have a certain component, and
        *   deletes them from the entitySet
        */
        ReaperProcessor = EntityProcessor.extend({
            type:'ReaperProcessor',
            // the processor will receive entities which have the /dead component
            entityFilter: Query.all('/dead'),
            
            onUpdate: function( entityArray, timeMs ){
                let entity, ii, len;
                // log.debug('/p/reaper ' + entityArray.length + ' models' );
                // any entities marked as dead should be removed
                for( ii=0,len=entityArray.length;ii<len;ii++ ){
                    entity = entityArray[ii];
                    // log.debug('destroying entity ' + entity.id );
                    // printE( entity );
                    this.destroyEntity( entity );
                }
            }
        });

        ConnectionProcessor = EntityProcessor.extend({
            type:'ConnectionProcessor',
            
            // the processor will not receive any entities which have the /dead component
            entityFilter: Query.all('/ttl'),

            onUpdate: function( entityArray, timeMs ){
                let entity, ii, len;
                // log.debug('updating /p/connection with ' + entityArray.length + ' entities');
                // any entities which have an expired ttl should be marked as dead
                for( ii=0,len=entityArray.length;ii<len;ii++ ){
                    entity = entityArray[ii];
                    // printE( entity );

                    if( entity.Ttl.get('expires_at') <= timeMs ){
                        // removing /ttl means that this will no longer be processed
                        // by this processor
                        this.removeComponentFromEntity( entity.Ttl, entity );

                        // adding the /dead component means that the entity will 
                        // eventually be destroyed by the reaper processor
                        // log.debug('adding dead to ' + entity.id );
                        this.addComponentToEntity( '/dead', entity );
                    }
                }
            }
        });

        entitySet = createTestEntitySet( registry, entitySet );

        reaperProcessor = registry.addProcessor( ReaperProcessor, entitySet, {debug:false} );
        connectionProcessor = registry.addProcessor( ConnectionProcessor, entitySet, {priority:200} );

        // Common.logEvents( entitySet );
        // log.debug('reaper processor is ' + reaperProcessor.get('view').cid );

        // printE( entitySet );

        // Common.logEvents( entitySet );

        registry.updateSync( Date.now() + 500, {debug:false} );

        // log.debug('called ' + eventSpy.callCount );
        t.ok( eventSpy.calledWith('entity:remove'), 'two entities will have been removed' );
        // process.exit();
        t.equals( entitySet.length, 4, 'four connection entities remain' );


        
        // t.equals(
        //      entitySet.where( '/dead ).length    FilterEntitySet( entitySet, [EntityFilter.ALL, '/dead'] ).length,
        //     2, 'there should be two components with /dead' );

        // t.equals( reaperProcessor.get('view').length, 0, 'reaper should have no entities');

        // process.exit();

        // log.debug('--- 2nd update');
        // log.debug( 'entityset ' + reaperProcessor.get('entitySet').cid );
        // log.debug( 'reaper view ' + reaperProcessor.get('view').cid );
        // log.debug( 'connection view ' + connectionProcessor.get('view').cid );
        // printE( entitySet );
        // printE( reaperProcessor.get('view') );
        registry.updateSync( Date.now() + 1300, {debug:false} );
        t.equals( entitySet.length, 3, 'three connection entities remain' );
        // printE( reaperProcessor.get('view') ); //connectionProcessor.get('view') );    

        registry.updateSync( Date.now() + 2500, {debug:false} );
        t.equals( entitySet.length, 2, 'three connection entities remain' );

        // printE( entitySet );

        // after the second update, two entities (with the /dead component) should have been removed
        // log.debug('2nd check');
        // t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called twice');
        

        t.end();
    })
    .catch( err => log.error('test error: ' + err.stack) )
});



function FilterEntitySet( entitySet, entityFilter ){
    let registry = entitySet.getRegistry();
    entityFilter = registry.createEntityFilter( entityFilter );
    let collection = entitySet.where( entityFilter );
    return collection.models;
}



function createTestEntitySet( registry, entitySet ){
    return populateEntitySet( registry, entitySet, [
        [
            [ { id:'/connection', 'addr': '192.3.0.1'} ],
            [ { id:'/ttl', expires_at:Date.now()-300 } ]
        ],
        [
            [ { id:'/connection', 'addr': '192.3.0.2'} ]
        ],
        [
            [ { id:'/connection', 'addr': '192.3.0.3'} ],
            [ { id:'/ttl', expires_at:Date.now()+600, 'comment':'a' }]
        ],
        [
            [ { id:'/connection', 'addr': '192.3.0.4'} ],
            [ { id:'/ttl', expires_at:Date.now()+2000, 'comment':'b' } ]
        ],
        [
            [ { id:'/connection', 'addr': '192.3.0.5'} ]
        ]
    ] );
}

function populateEntitySet( registry, entitySet, data ){
    return _.reduce( data, (entitySet, entityData) => {
        entitySet.addComponent( 
            entityData.map( comData => registry.createComponent.apply(registry, comData) )
        , {debug:false} );
        return entitySet;
    }, entitySet );
}