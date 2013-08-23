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
});