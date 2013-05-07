require('./common');

// var Common = require( '../src/common.js' );
// var MainServer = require( '../src/main.server' );
var CommandQueue = require('../lib/command_queue');

var CmdTestA = CommandQueue.Command.extend({
    execute: function(options,callback){
        callback( null, true, this );
    },
    isCmdTestA: function(){
        return true;
    }
});

// var t = new CmdTestA();
// console.log( t.testFunction() ); process.exit();

Entity.registerEntity( 'cmd_test_a', CmdTestA, {debug:true} );

// if( true ){
//     print_ins( CmdTestA );
//     process.exit();
// }

Entity.registerEntity({ entityType:'test_a' });

Entity.registerEntity({
    entityType: 'test_container', ER:[ { entityType:'cmd_queue' }, {oneToOne:'test_a', name:'friend'}, { oneToMany:'test_a', name:'friends'} ]
});


describe('Command Queue', function(){

    beforeEach( function(done){
        this.queue = CommandQueue.create();
        done();
    });

    after(function(){
        for (var key in Object.keys(require.cache)){ delete require.cache[key]; }
    });
    
    describe('create', function(){
        it('should create', function(){
            
        });

        
        it('should add commands correctly', function(){
            var cmd = CmdTestA.create({ id:'cmd_001', execute_time:201 } );
            this.queue.add( cmd );
            assert( this.queue.at(0).isCmdTestA() );
        });
    });//*/

    
    describe('process', function(){
        
        it('should process multiple commands', function(done){
            var self = this, processCount = 0;
            var Cmd = CommandQueue.Command.extend({
                execute: function(options,callback){
                    processCount++;
                    callback();
                }
            });

            this.queue.add( new Cmd({id:'cmd_a'}) );
            this.queue.add( new Cmd({id:'cmd_b'}) );
            this.queue.add( new Cmd({id:'cmd_c'}) );

            assert.equal( this.queue.length, 3 );

            async.waterfall([
                function(callback){
                    self.queue.process({isBlocking:true},function(err, executeCount, removeCount){
                        assert.equal( processCount, 3 );
                        assert.equal( executeCount, 3 );
                        assert.equal( removeCount, 0 );
                        assert.equal( self.queue.length, 3 );
                        callback();
                    });
                },
                function(callback){
                    self.queue.process({isBlocking:true},function(err, executeCount, removeCount){
                        assert.equal( processCount, 3 );
                        assert.equal( executeCount, 0 );
                        assert.equal( removeCount, 3 );
                        assert.equal( self.queue.length, 0 );
                        callback();
                    });
                }
            ],
            function(err){
                done();
            })
        });

        
        it('should run the callback', function(done){
            var self = this, processed = false;
            var cmd = new CommandQueue.Command();
            cmd.execute = function(options,callback){
                processed = true;
                callback();
            };

            this.queue.add( cmd );
            assert.equal( this.queue.length, 1 );
            this.queue.process(function(err,executeCount,removeCount){
                assert( processed );
                assert.equal( executeCount, 1 );
                done();
            });
        });

        
        it('should process multiple commands', function(done){
            var self = this, processCount = 0;
            var Cmd = CommandQueue.Command.extend({
                execute: function(options,callback){
                    processCount++;
                    callback();
                }
            });

            // override the time function to return a specific time
            this.queue.time = function(){
                return 50;
            }

            this.queue.add( new Cmd({execute_time:0}) );
            this.queue.add( new Cmd({execute_time:100}) );
            this.queue.add( new Cmd({execute_time:200}) );
            
            assert.equal( this.queue.length, 3 );
            this.queue.process(function(err, executeCount, removeCount ){
                assert.equal( processCount, 1 );
                assert.equal( executeCount, 1 );
                assert.equal( self.queue.length, 3 );
                done();
            });
        });

        it('should order added commands', function(){
            this.queue.add( { id:'cmd_001', entityType:'cmd_test_a', execute_time:201 } );
            this.queue.add( { id:'cmd_002', entityType:'cmd_test_a', execute_time:0 } );
            this.queue.add( { id:'cmd_003', entityType:'cmd_test_a', execute_time:20 } );
            this.queue.add( { id:'cmd_004', entityType:'cmd_test_a', execute_time:-1 } );

            assert.equal( this.queue.at(0).id, 'cmd_004' );
            assert.equal( this.queue.at(1).id, 'cmd_002' );
            assert.equal( this.queue.at(2).id, 'cmd_003' );
            assert.equal( this.queue.at(3).id, 'cmd_001' );
        });

        it('should cope with re-occuring commands', function(done){
            var Cmd = CommandQueue.Command.extend({
                execute: function(options,callback){
                    this.isFinished = false;
                    callback();
                }
            });

            this.queue.add( new Cmd({execute_time:0}) );
            this.queue.process( function(err, executeCount, finishedCount){
                assert.equal( executeCount, 1 );
                assert.equal( finishedCount, 0 );
                done();
            });
        });//*/

        it('should not block on long running commands', function(done){
            var self = this;
            var currentIndex = 0;

            // a function that each complete command calls to ensure they were completed in sequence
            var onComplete = function(index){
                assert( index > currentIndex );
                currentIndex = index;
            };

            var CmdWait = CommandQueue.CommandQueue.extend({
                execute: function(options,callback){
                    var self = this;
                    // log.debug(Date.now() + ' cmdWait started ' + self.id +'/' + self.cid);
                    setTimeout(function(){
                        // log.debug(Date.now() + ' cmdWait complete ' + self.id +'/' + self.cid);
                        onComplete( self.get('index') );
                        callback();
                    }, 200);
                }
            });

            var CmdShort = CommandQueue.CommandQueue.extend({
                execute: function(options,callback){
                    // log.debug(Date.now() + ' cmdShort complete ' + this.id +'/' + this.cid);
                    onComplete( this.get('index') );
                    callback();
                }
            });

            // so that only one command can execute at once
            this.queue.set({isSerial:true});
            this.queue.add( new CmdShort({id:'cmd_002', index:1}) );
            this.queue.add( new CmdWait( {id:'cmd_001', index:2}) );
            this.queue.add( new CmdShort({id:'cmd_003', index:3}) );

            async.whilst(
                function(){
                    return self.queue.length > 0;
                },
                function(callback){
                    self.queue.process( function(err, executeCount, finishedCount){
                        // if( executeCount != 0 || finishedCount !== 0 )
                        //     log.debug( Date.now() + ' process ' + executeCount + ' - ' + finishedCount );
                        callback();
                    });
                },
                function(err){
                    log.debug('finished');
                    assert.equal( self.queue.length, 0 );
                    done();
                }
            );

        })
    });


    describe('serialisation', function(){

        it('should persist to JSON', function(){

            this.queue.set('id', 'cq_000');
            this.queue.add( [{ id:'cmd_001', entityType:'cmd_test_a', execute_time:201 },
                            { id:'cmd_002', entityType:'cmd_test_a', execute_time:0 },
                            { id:'cmd_003', entityType:'cmd_test_a', execute_time:20 },
                            { id:'cmd_004', entityType:'cmd_test_a', execute_time:-1 }] );

            var expected = {
                "id": "cq_000",
                "entityType":"cmd_queue",
                "items": [
                    {
                        "id": "cmd_004",
                        "entityType": "cmd_test_a",
                        "execute_time": -1
                    },
                    {
                        "id": "cmd_002",
                        "entityType": "cmd_test_a",
                    },
                    {
                        "id": "cmd_003",
                        "entityType": "cmd_test_a",
                        "execute_time": 20
                    },
                    {
                        "id": "cmd_001",
                        "entityType": "cmd_test_a",
                        "execute_time": 201
                    }
                ]
            };
            
            // console.log( this.queue.toJSON({noDates:true, debug:true}) );
            // print_var( this.queue.attributes );
            assert.deepEqual( this.queue.toJSON({noDates:true}), expected );
        });
        
        it('should reference items', function(){
            this.queue.set('id', 'cq_000');
            this.queue.add( [{ id:'cmd_001', entityType:'cmd_test_a', execute_time:201 },
                            { id:'cmd_002', entityType:'cmd_test_a', execute_time:0 },
                            { id:'cmd_003', entityType:'cmd_test_a', execute_time:20 },
                            { id:'cmd_004', entityType:'cmd_test_a', execute_time:-1 }] );

            var expected = {
                "id": "cq_000",
                "entityType":"cmd_queue",
                "items": [
                    "cmd_004",
                    "cmd_002",
                    "cmd_003",
                    "cmd_001"
                ]
            };
            assert.deepEqual( this.queue.toJSON({referenceItems:true,noDates:true}), expected );
        });

        it('should flatten to JSON', function(){
            this.queue.set('id', 'cq_000');
            this.queue.add( [{ id:'cmd_001', entityType:'cmd_test_a', execute_time:201 },
                            { id:'cmd_002', entityType:'cmd_test_a', execute_time:0 },
                            { id:'cmd_003', entityType:'cmd_test_a', execute_time:20 },
                            { id:'cmd_004', entityType:'cmd_test_a', execute_time:-1 }] );

            var expected = {
                "cq_000": {
                    "id": "cq_000",
                    "items": [ "cmd_004", "cmd_002", "cmd_003", "cmd_001" ],
                    "entityType": "cmd_queue"
                },
                "cmd_004": {
                    "id": "cmd_004",
                    "entityType": "cmd_test_a",
                    "execute_time": -1
                },
                "cmd_002": {
                    "id": "cmd_002",
                    "entityType": "cmd_test_a"
                },
                "cmd_003": {
                    "id": "cmd_003",
                    "entityType": "cmd_test_a",
                    "execute_time": 20
                },
                "cmd_001": {
                    "id": "cmd_001",
                    "entityType": "cmd_test_a",
                    "execute_time": 201
                }
            };

            // print_ins( this.queue.flatten({toJSON:true}) );
            assert.deepEqual( this.queue.flatten({toJSON:true,referenceItems:true,noDates:true}), expected );
        });

        it('should set from a JSON form', function(){
            var ser = {
                "id":"test.001",
                "entityType":"test_container",
                "cmd_queue":[
                    { "id":"cmd.001", "entityType": "cmd_test_a", "execute_time":10 },
                    { "id":"cmd.002", "entityType": "cmd_test_a", "execute_time":11 },
                ]
            };

            var a = Entity.create( ser );

            // var data = a.parse(ser,null,{parseFor:'test.001',removeId:false,debug:true});
            // print_var( data );

            assert.equal( a.cmd_queue.at(0).get('execute_time'), 10 );
            assert.equal( a.cmd_queue.at(1).get('execute_time'), 11 );
        });

        it('should parse from a serialised form', function(){
            var ser = {
                "test.001":{
                    "cmd_queue":[ {"entityType":"cmd_test_a", "execute_time":10} ]
                }
            };
            var a = Entity.create( {entityType:'test_container', id:'test.001'} );
            var data = a.parse(ser,null,{parseFor:'test.001'});
            a.set( data );

            assert.equal( a.cmd_queue.at(0).get('execute_time'), 10 ); 
        });

        it('should serialise without relations', function(){
            this.queue.set({
                "id":"test.001",
                "items":[
                    { "id":"cmd.001", "entityType": "cmd_test_a", "execute_time":10 },
                    { "id":"cmd.002", "entityType": "cmd_test_a", "execute_time":11 },
                ]
            });

            assert.deepEqual( this.queue.toJSON({relations:false}), { "entityType":"cmd_queue", "id":"test.001"});
        });//*/

        it.skip('should flatten to JSON with an empty queue', function(){
            var a = Entity.create( {entityType:'test_container', id:'test.001'} );
            var fr = Entity.create( {entityType:'test_a', id:'test.a.001'} );

            a.friends.add(fr);
            a.set('friend', fr);
            a.cmd_queue.set({id:'cq', debug:true});

            var flat = a.flatten({toJSON:true, debug:false});
            var expected = {
                "test.001":{
                    "entityType":"test_container",
                    "id":"test.001",
                    "friend":"test.a.001",
                    "cmd_queue":"cq",
                    "friends": [
                        "test.a.001"
                    ]
                },
                "cq":{
                    "id":"cq",
                    "debug":true,
                    "entityType":"cmd_queue"
                },
                "test.a.001":{
                    "entityType":"test_a",
                    "id":"test.a.001"
                }
            };

            // print_ins( flat );
            print_var( flat );
            assert.deepEqual( flat, expected );
        });
    });


    /*
    describe('persistence', function(){
        
        it('should add and remove commands', function(done){
            var self = this;
            var cmd;

            // this.queue.set('auto_save',true);
            Step(
                function saveQueueFirst(){
                    self.queue.saveCb( this );
                },
                function createCommandAndAdd(err,result){
                    cmd = Entity.create( CmdTestA, {execute_time:-1} );
                    self.queue.add( cmd );
                    assert.equal( self.queue.length, 1 );
                    self.queue.saveCb( this );
                },
                function destroyCommand(err,result){
                    if( err ) throw err;
                    cmd.destroyCB({destroyHard:true},this);
                },
                function retrieveQueue(err,result){
                    if( err ) throw err;
                    var q = CommandQueue.create({id:self.queue.id});
                    q.fetchRelatedCB(this);
                },
                function(err,result){
                    if( err ) throw err;
                    assert.equal( result.items.length, 0)
                    done();
                }
            );
        });

        it('should indicate when missing', function(done){
            var self = this;
            Step(
                function retrieveQueue(){
                    var q = CommandQueue.create({id:'missing.001'});
                    q.fetchRelatedCB(this);
                },
                function(err,result){
                    assert.equal( err, 'missing.001 not found' );
                    done();
                }
            );
        });

        it('should destroy processed commands', function(done){
            var self = this;
            Step(
                function saveQueueFirst(){
                    self.queue.saveCb( this );
                },
                function createCommandAndAdd(err,result){
                    if( err ) throw err;
                    var cmd = Entity.create( CmdTestA, {execute_time:-1} );
                    self.queue.add( cmd );
                    assert.equal( self.queue.length, 1 );
                    self.queue.saveCb( this );
                },
                function processQueue(err,result){
                    if( err ) throw err;
                    self.queue.process( this );
                },
                function recreateQueue(err,result){
                    if( err ) throw err;
                    assert.equal( self.queue.length, 0)
                    var q = CommandQueue.create({id:self.queue.id});
                    // the fetched queue should contain no items
                    q.fetchRelatedCB(this);
                },
                function(err,result){
                    if( err ) throw err;
                    // print_var( result.flatten() );
                    assert.equal( result.length, 0)
                    done();
                }
            );

        });

        it('should persist as part of a parent entity', function(done){
            var self = this;

            var container = Entity.create( Entity.TYPE_TEST_CONTAINER, {name:'game', colour:'red'} );

            assert.equal( container.entityType, Entity.TYPE_TEST_CONTAINER );
            assert.equal( container.cmd_queue.entityType, Entity.TYPE_CMD_QUEUE );

            var a = Entity.create( CmdTestA, {execute_time:201} );
            var b = Entity.create( CmdTestA, {execute_time:101} );

            container.cmd_queue.add( a );
            container.cmd_queue.add( b );
            
            Step(
                function(){
                    container.saveCb(this);
                },
                function(err,result){
                    if( err ) throw( err );
                    var flat = result.flatten({toJSON:true});
                    assert.equal( flat['2'].entityType, 'cmd_queue' );
                    var newContainer = Entity.create( Entity.TYPE_TEST_CONTAINER, {id:result.id} );
                    newContainer.fetchRelatedCB( this );
                },
                function(err,result){
                    if( err ) throw err;
                    var flat = result.flatten({toJSON:true});
                    assert.equal( flat['2'].entityType, 'cmd_queue' );
                    // print_var( flat );
                    assert( result.cmd_queue.at(0).isCmdTestA() );
                    done();
                }
            );
        });
    });//*/

});