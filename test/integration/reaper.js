var _ = require('underscore');
var test = require('tape');

var Common = require('../common');
var Elsinore = Common.Elsinore;

var EntityProcessor = Elsinore.EntityProcessor;
var EntityFilter = Elsinore.EntityFilter;


/**
    This test 
*/
test('reaper', function(t){

    var registry, entitySet;
    var cConnection, cTimeToLive, cDead;
    var ConnectionProcessor, ReaperProcessor;

    registry = Elsinore.Registry.create();
    entitySet = registry.createEntitySet();
    Common.logEvents( entitySet );

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
        priority: 200,
        onUpdate: function( entitySet, timeMs ){
            // any entities marked as dead should be removed
            var it = entitySet.iteratorSync();
            while( (entity = it.next().value) ){
                this.destroyEntity( entity );
            }
        }
    });

    ConnectionProcessor = EntityProcessor.extend({
        name:'/p/connection',
        
        // the processor will not receive any entities which have the /dead component
        entityFilter: [ [EntityFilter.ALL, '/ttl'], [ EntityFilter.NONE, '/dead' ] ],

        onUpdate: function( entitySet, timeMs ){
            // any entities which have an expired ttl should be marked as dead
            var it = entitySet.iteratorSync();
            while( (entity = it.next().value) ){
                printE( entity );

                if( entity.Ttl.get('expires_at') <= timeMs ){
                    // adding the /dead component means that the entity will 
                    // no longer be processed by this processor
                    this.addComponentToEntity( entity, '/dead' );
                }
            }
        }
    });


    processor = registry.addProcessor( ReaperProcessor, entitySet, {priority:200} );
    processor = registry.addProcessor( ConnectionProcessor, entitySet );

    entitySet = populateEntitySet( registry, entitySet, [
        [
            [ '/connection', { 'addr': '214.140.36.160'} ],
            [ '/ttl', { expires_at:Date.now()-300 } ]
        ],
        [
            [ '/connection', { 'addr': '217.146.191.19'} ]
        ],
        [
            [ '/connection', { 'addr': '76.210.45.4'} ],
            [ '/ttl', { expires_at:Date.now()+300, 'comment':'a' }]
        ],
        [
            [ '/connection', { 'addr': '178.65.210.178'} ],
            [ '/ttl', { expires_at:Date.now()+600, 'comment':'b' } ]
        ],
        [
            [ '/connection', { 'addr': '217.146.191.19'} ]
        ]
    ] );

    registry.updateSync( Date.now() + 1200, {debug:true} );


    t.end();
});



function populateEntitySet( registry, entitySet, data ){
    return _.reduce( data, function( entitySet, entityData ){
        entitySet.addComponent( entityData.map( function(comData){
            return registry.createComponent.apply( registry, comData );
        }), {debug:false} );
        return entitySet;
    }, entitySet );
}