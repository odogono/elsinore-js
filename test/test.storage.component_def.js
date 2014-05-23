require('./common');

var _ = require('underscore');
var Backbone = require('backbone');
var Promise = require('bluebird');

var Registry = Elsinore.Registry;
var RedisStorage = require('../index');
var ComponentDef = Elsinore.ComponentDef;
var Entity = Elsinore.Entity;

var testOptions = {
    key_prefix: 'test-elsinore-redis',
    db_id: 0
};



describe('RedisStorage', function(){

    describe('ComponentDef', function(){

        beforeEach( function(){
            var self = this;
            return createAndInitialize(testOptions).then(function(storage){ self.storage = storage; });
        });

        afterEach( function(){
        });


        it('should register a componentDef', function(){

        });

        it('should throw an error when attempting to register an existing componentDef', function(){

        });

        it('should unregister a componentDef', function(){

        });

        it('should retrieve an existing componentDef', function(){

        });

        it('should throw an error when retrieving an unknown componentDef', function(){

        });

        it('should indicate that a componentDef exists', function(){

        });

        it('should indicate that a componentDef does not exist', function(){

        });
        
    });

});


function createAndInitialize(options){
    var storage = RedisStorage.create();
    storage.registry = {toEntity:function(id){
        var result = Entity.toEntity(id);
        // log.debug('creating with ' + JSON.stringify(id));
        return result;
    }};

    return storage.initialize(options)
        .then( function(storage){
            return storage.clear();
        });
}

function createEntity(id){
    return Entity.create(id);
}

function createEntities( count ){
    return _.times( count, function(i){ return createEntity() });
}