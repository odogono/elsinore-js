require('./common');
var EntitySystem = odgnEntity.EntitySystem;

describe('EntitySystem', function(){
    beforeEach( function(done){
        var self = this;
        // passing a callback to create will initialise
        this.registry = odgnEntity.Registry.create({initialize:true}, function(err,registry){
            self.registry = registry;
            done();
        });
    });

    describe('Registration', function(){

        it('should recognise a system as a backbone model', function(){
            var SystemModel = EntitySystem.Model.extend({});
            var systemInstance = new SystemModel();
            assert( systemInstance instanceof Backbone.Model );
            // print_ins( systemInstance,2 );
        });

        it('should add a system to the registry', function(done){
            var SystemModel = EntitySystem.Model.extend({});
            this.registry.listenTo( this.registry, 'system:add', function(system,registry){
                done();
            });
            this.registry.addSystem( SystemModel );
        });

        it('should add a system to the registry which is then updated', function(done){
            var SystemModel = EntitySystem.Model.extend({
                update: function(){
                    done();
                },
            });
            this.registry.addSystem( {Model:SystemModel,id:'/system/test'} );
            this.registry.update();
        });



        it('should execute systems in order', function(done){
            var isExecuted = false;
            var SysA = EntitySystem.Model.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    assert( isExecuted );
                    done();
                }
            });
            var SysB = EntitySystem.Model.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    isExecuted = true;
                    return callback();
                }
            });
            this.registry.addSystem( {Model:SysA,id:'/system/test/a'} );
            this.registry.addSystem( {Model:SysB,id:'/system/test/b'}, {priority:1} );

            this.registry.update();
        });


        it('should not update non-updateable systems', function(done){
            var isExecuted = false;
            var SysB = EntitySystem.Model.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    isExecuted = true;
                    return callback();
                }
            });

            this.registry.addSystem( {Model:SysB,id:'/system/test/b'}, {update:false} );
            this.registry.update(function(err){
                assert(!isExecuted);
                done();
            });
        });

        it('should execute systems serially', function(done){
            var isExecuted = false;
            var SysA = EntitySystem.Model.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    return async.nextTick( function(){
                        isExecuted = true;
                        return callback();
                    });
                }
            });
            var SysB = EntitySystem.Model.extend({
                update: function( deltaTime, startTime, currentTime, options, callback ){
                    return callback();
                }
            });
            this.registry.addSystem( {Model:SysA,id:'/system/test/a'} );
            this.registry.addSystem( {Model:SysB,id:'/system/test/b'} );

            this.registry.update(function(err){
                assert(isExecuted);
                done();
            });
        })
    });

    describe('events', function(){
        it('should publish an event via an entity', function(){
            // var SysA = EntitySystem.Model.extend({
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