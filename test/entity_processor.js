import _ from 'underscore';
import test from 'tape';

import EntityProcessor from '../src/entity_processor';
import Entity from '../src/entity';
import Component from '../src/component';
import Registry from '../src/registry/processor';
import {createLog} from '../src/util/log';

import {
    initialiseRegistry,
    entityToString
} from './common';


const Log = createLog('TestEntityProcessor');

test('processor should receive an event when entities are added', async t => {
    try{
    let isAdded = false;
    class Proc extends EntityProcessor {
        constructor(...args){
            super(...args);
            this.events = {
                'entity:add': this.onAdded
            }; 
        }
        onAdded( entityArray ){
            // Log.debug('onAdded', entityToString(entityArray));
            // Log.debug( entityToString(this.entitySet) );
            isAdded = true;
        }
    }

    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();
    const processor = registry.addProcessor(Proc,entitySet, {debug:true} );

    entitySet.addEntity( {'@c':'/component/position', x:100, y:22} );
    t.assert( !isAdded, 'entity not added until update is called' );

    registry.updateSync( 0, {debug:true} );
    t.assert( isAdded, 'entity added when update is called' );

    t.end();
    }catch(err){ Log.error(err.message,err.stack);}
});


test('processor should receive an event when applicable entities are added', async t => {
    try{
    let addCount = 0;
    let removeCount = 0;

    class Proc extends EntityProcessor {
        constructor(...args){
            super(...args);
            this.entityFilter = Q => Q.all('/component/username');
            this.events = {
                'entity:add': this.onAdded,
                'entity:remove': this.onRemoved,
            }; 
        }

        onAdded( entityArray ){
            addCount += entityArray.length;
        }
        onRemoved(entityArray){
            removeCount += entityArray.length;
        }
    }

    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();
    const processor = registry.addProcessor(Proc,entitySet, {debug:false} );

    entitySet.addEntity( {'@c':'/component/position', x:100, y:22} );
    entitySet.addEntity( {'@c':'/component/username', username:'bob'} );
    entitySet.addEntity( {'@c':'/component/status', status:'active'} );
    entitySet.addEntity( {'@c':'/component/username', username:'alice'} );
    
    registry.updateSync( 0, {debug:false} );
    t.equals( addCount, 2, 'only two applicable entities added' );

    // remove all the usernames from the original entityset
    entitySet.removeByQuery( Q => Q.all('/component/username') );
    registry.updateSync( 0, {debug:false} );

    t.equals( removeCount, 2, 'two applicable entities removed' );

    t.end();
    }catch(err){ Log.error(err.message,err.stack);}
});


test('processor can affect original entityset', async t => {
    try{

    class Proc extends EntityProcessor {
        constructor(...args){
            super(...args);
            this.entityFilter = Q => Q.all('/component/username');
            this.events = {
                'entity:add': this.onAdded
            }; 
        }

        onAdded( entityArray ){
            const entity = entityArray[0]; 
            const username = entity.Username.get('username');
            const component = {'@c':'/component/status', status:'active'};
            const position = {'@c':'/component/position'}
            _.each( entityArray, e => this.addComponentToEntity([component,position],e) );
            this.createEntity( [{'@c':'/component/username', username:`friend of ${username}`}, {'@c':'/component/status',status:'active'}] );
        }
    }

    const registry = await initialiseRegistry();
    const entitySet = registry.createEntitySet();
    const processor = registry.addProcessor(Proc,entitySet, {debug:false} );

    entitySet.addEntity( {'@c':'/component/username', username:'bob'} );
    entitySet.addEntity( {'@c':'/component/channel', name:'channel4'} );
    entitySet.addEntity( {'@c':'/component/username', username:'alice'} );

    registry.updateSync( 0, {debug:false} );
    // t.equals( addCount, 2, 'only two applicable entities added' );

    // Log.debug('proc es', entityToString(processor.entitySet));
    // Log.debug('proc es', entityToString(entitySet));

    t.equals(
        entitySet.query( Q => Q.all('/component/username').where(Q.attr('username').equals(/friend of/)) ).length, 
        2, 'two new entities added to src entityset');

    // Log.debug('friends', entityToString(friends));

    // entitySet.removeByQuery( Q => Q.all('/component/username') );
    // registry.updateSync( 0, {debug:false} );
    // t.equals( removeCount, 2, 'two applicable entities removed' );

    // Log.debug('proc es', entityToString(processor.entitySet));

    t.end();
    }catch(err){ Log.error(err.message,err.stack);}
})


// test('adding a processor to the registry', function(t){
//     t.end();
// });

// test('creating should also create an entityset', function(t){
//     t.end();
// });

// test('creating with a filter should apply that filter to the entityset', function(t){
//     t.end();
// });


// test('executing a processor', function(t){
//     t.end();
// });

// test('executing processors in order', function(t){
//     t.end();
// });

// test('not updating non-updateable processors', function(t){
//     t.end();
// });

/*
describe('EntitySystem', function(){
    beforeEach( function(){
        this.registry = Registry.create();
        return this.registry.initialize();
    });

    describe('Registration', function(){

        it('should recognise a processor as a backbone model', function(){
            var SystemProcessor = EntityProcessor.extend({});
            var processorInstance = new SystemProcessor();
            assert( processorInstance instanceof Backbone.Model );
        });

        it('should add a processor to the registry', function(done){
            var SystemProcessor = EntityProcessor.extend({});
            this.registry.listenTo( this.registry, 'processor:add', function(processor,registry){
                done();
            });
            this.registry.addProcessor( SystemProcessor );
        });

        it('should add a processor to the registry which is then updated', function(done){
            var SystemProcessor = EntityProcessor.extend({
                update: function(){
                    done();
                },
            });
            this.registry.addProcessor( {Model:SystemProcessor,id:'/processor/test'} );
            this.registry.update();
        });



        it('should execute processors in order', function(done){
            var isExecuted = false;
            var SysA = EntityProcessor.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    assert( isExecuted );
                    done();
                }
            });
            var SysB = EntityProcessor.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    isExecuted = true;
                    return callback();
                }
            });
            this.registry.addProcessor( {Model:SysA,id:'/processor/test/a'} );
            this.registry.addProcessor( {Model:SysB,id:'/processor/test/b'}, {priority:1} );

            this.registry.update();
        });


        it('should not update non-updateable processors', function(done){
            var isExecuted = false;
            var SysB = EntityProcessor.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    isExecuted = true;
                    return callback();
                }
            });

            this.registry.addProcessor( {Model:SysB,id:'/processor/test/b'}, {update:false} );
            this.registry.update(function(err){
                assert(!isExecuted);
                done();
            });
        });

        it('should execute processors serially', function(done){
            var isExecuted = false;
            var SysA = EntityProcessor.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    return async.nextTick( function(){
                        isExecuted = true;
                        return callback();
                    });
                }
            });
            var SysB = EntityProcessor.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    return callback();
                }
            });
            this.registry.addProcessor( {Model:SysA,id:'/processor/test/a'} );
            this.registry.addProcessor( {Model:SysB,id:'/processor/test/b'} );

            this.registry.update(function(err){
                assert(isExecuted);
                done();
            });
        })
    });

    describe('events', function(){
        it('should publish an event via an entity', function(){
            // var SysA = EntityProcessor.extend({
            //     update: function( deltaTime, startTime, currentTime, options, callback ){
            //         return async.nextTick( function(){
            //             isExecuted = true;
            //             return callback();
            //         });
            //     }
            // });
        })
    });
});//*/
