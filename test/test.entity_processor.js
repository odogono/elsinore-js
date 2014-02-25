require('./common');
var Registry = Elsinore.Registry;
var EntityProcessor = Elsinore.EntityProcessor;

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
});