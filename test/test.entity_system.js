require('./common');
var odgn = require('../index')();

describe('EntitySystem', function(){
    beforeEach( function(done){
        var self = this;
        // passing a callback to create will initialise
        this.registry = odgn.entity.Registry.create({initialise:true}, function(err,registry){
            self.registry = registry;
            done();
        });
    });

    it('should add a system to the registry', function(done){
        var SystemModel = odgn.entity.EntitySystem.Model.extend({});
        this.registry.listenTo( this.registry, 'system:add', function(system,registry){
            done();
        });
        this.registry.addSystem( SystemModel );
    });

    it('should add a system to the registry which is then updated', function(done){
        var SystemModel = odgn.entity.EntitySystem.Model.extend({
            update: function( deltaTime, startTime, currentTime, options, callback ){
                done();
            },
        });
        this.registry.addSystem( {Model:SystemModel,id:'/system/test'} );
        this.registry.update();
    });
});