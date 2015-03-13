'use strict';

var _ = require('underscore');
var test = require('tape');
var Sinon = require('sinon');

var Common = require('../common');
var Elsinore = Common.Elsinore;

var EntityProcessor = Elsinore.EntityProcessor;
var EntityFilter = Elsinore.EntityFilter;
var EntitySet = Elsinore.EntitySet;

/**
    This test demonstrates processors that use filters to determine which
    components it should operate on
*/
test('reaper', function(t){
    var registry, entitySet;
    var cConnection, cTimeToLive, cDead;
    var ConnectionProcessor, ReaperProcessor;
    var reaperProcessor, connectionProcessor;

    var eventSpy = Sinon.spy();

    registry = Elsinore.Registry.create();
    entitySet = registry.createEntitySet();
    entitySet.on('all', eventSpy);
    // Common.logEvents( entitySet );

    cConnection = registry.registerComponent({id:'/connection', addr:{ type:'string' }});
    cTimeToLive = registry.registerComponent({id:'/ttl', expires_at:{ type:'number' }});
    cDead = registry.registerComponent({id:'/dead'});

    /**
    *   The reaper processor looks out for entities that have a certain component, and
    *   deletes them from the entitySet
    */
    ReaperProcessor = EntityProcessor.extend({
        name:'/p/reaper',
        // the processor will receive entities which have the /dead component
        entityFilter: [ EntityFilter.ALL, '/dead' ],
        
        onUpdate: function( entityArray, timeMs ){
            var entity, i, len;
            // any entities marked as dead should be removed
            for( i=0,len=entityArray.length;i<len;i++ ){
                entity = entityArray[i];
                this.destroyEntity( entity );
            }
        }
    });

    ConnectionProcessor = EntityProcessor.extend({
        name:'/p/connection',
        
        // the processor will not receive any entities which have the /dead component
        entityFilter: [EntityFilter.ALL, '/ttl'],

        onUpdate: function( entityArray, timeMs ){
            var entity, i, len;
            // log.debug('updating /p/connection with ' + entityArray.length + ' entities');
            // any entities which have an expired ttl should be marked as dead
            for( i=0,len=entityArray.length;i<len;i++ ){
                entity = entityArray[i];
                // printE( entity );

                if( entity.Ttl.get('expires_at') <= timeMs ){
                    // removing /ttl means that this will no longer be processed
                    // by this processor
                    this.removeComponentFromEntity( entity, entity.Ttl );

                    // adding the /dead component means that the entity will 
                    // eventually be destroyed by the reaper processor
                    this.addComponentToEntity( entity, '/dead' );
                }
            }
        }
    });

    entitySet = createTestEntitySet( registry, entitySet );

    reaperProcessor = registry.addProcessor( ReaperProcessor, entitySet, {priority:200} );
    connectionProcessor = registry.addProcessor( ConnectionProcessor, entitySet );

    // Common.logEvents( entitySet );
    // log.debug('reaper processor is ' + reaperProcessor.get('view').cid );

    registry.updateSync( Date.now() + 1200, {debug:true} );

    t.equals(
        FilterEntitySet( entitySet, [EntityFilter.ALL, '/dead'] ).length,
        2, 'there should be two components with /dead' );


    // printE( processor.get('view') );    

    // log.debug('--- 2nd update');
    // printE( entitySet );
    // printE( reaperProcessor.get('view') );
    registry.updateSync( Date.now() + 1300, {debug:false} );


    registry.updateSync( Date.now() + 1500, {debug:false} );

    // printE( entitySet );

    // after the second update, two entities (with the /dead component) should have been removed
    // log.debug('2nd check');
    // t.ok( eventSpy.calledWith('entity:remove'), 'entity:remove should have been called twice');
    t.equals( entitySet.length, 3, 'three connection entities remain' );

    t.end();
});



function FilterEntitySet( entitySet, entityFilter ){
    var registry = entitySet.getRegistry();
    entityFilter = registry.createEntityFilter( entityFilter );

    var collection = EntitySet.createView( entitySet, entityFilter, {listen:false} );
    return collection.models;
}



function createTestEntitySet( registry, entitySet ){
    return populateEntitySet( registry, entitySet, [
        [
            [ '/connection', { 'addr': '192.3.0.1'} ],
            [ '/ttl', { expires_at:Date.now()-300 } ]
        ],
        [
            [ '/connection', { 'addr': '192.3.0.2'} ]
        ],
        [
            [ '/connection', { 'addr': '192.3.0.3'} ],
            [ '/ttl', { expires_at:Date.now()+600, 'comment':'a' }]
        ],
        [
            [ '/connection', { 'addr': '192.3.0.4'} ],
            [ '/ttl', { expires_at:Date.now()+2000, 'comment':'b' } ]
        ],
        [
            [ '/connection', { 'addr': '192.3.0.5'} ]
        ]
    ] );
}

function populateEntitySet( registry, entitySet, data ){
    return _.reduce( data, function( entitySet, entityData ){
        entitySet.addComponent( entityData.map( function(comData){
            return registry.createComponent.apply( registry, comData );
        }), {debug:false} );
        return entitySet;
    }, entitySet );
}