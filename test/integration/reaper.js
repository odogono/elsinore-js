var _ = require('underscore');
var test = require('tape');

var Common = require('../common');
var Elsinore = Common.Elsinore;

var EntityProcessor = Elsinore.EntityProcessor;
var EntityFilter = Elsinore.EntityFilter;


/**
    This test demonstrates processors that use filters to determine which
    components it should operate on
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
        
        onUpdate: function( entityArray, timeMs ){
            var entity, i, len;
            
            // log.debug('updating /p/reaper with ' + entityArray.length + ' entities');

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
        entityFilter: [ [EntityFilter.ALL, '/ttl'], [ EntityFilter.NONE, '/dead' ] ],

        onUpdate: function( entityArray, timeMs ){
            var entity, i, len;
            // log.debug('updating /p/connection with ' + entityArray.length + ' entities');
            // any entities which have an expired ttl should be marked as dead
            for( i=0,len=entityArray.length;i<len;i++ ){
                entity = entityArray[i];
                // printE( entity );

                if( entity.Ttl.get('expires_at') <= timeMs ){
                    // adding the /dead component means that the entity will 
                    // no longer be processed by this processor
                    log.debug('adding /dead to entity ' + entity.Connection.get('addr') );
                    this.addComponentToEntity( entity, '/dead' );
                }
            }
        }
    });


    processor = registry.addProcessor( ReaperProcessor, entitySet, {priority:200} );
    processor = registry.addProcessor( ConnectionProcessor, entitySet );

    entitySet = populateEntitySet( registry, entitySet, [
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

    
    registry.updateSync( Date.now() + 1200, {debug:true} );
    // on the first update, two components should have the /dead component

    registry.updateSync( Date.now() + 1300, {debug:true} );

    // printE( entitySet );

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