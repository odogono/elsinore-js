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

    describe('Component', function(){

        beforeEach( function(){
            var self = this;
            return createAndInitialize(testOptions).then(function(storage){ self.storage = storage; });
        });

        afterEach( function(){
        });

        it('should save a component', function(){
            
        });

        it('should retrieve a previously saved component', function(){

        });

        it('should store additional component properties if allowed', function(){

        });

        it('should not store additional component properties if not allowed', function(){

        });

        it('should delete all components', function(){

        });

        it('should delete all components of a given type', function(){

        });

        it('should update the status of a component', function(){

        });

        it('should retrieve components that belong to a set of ids', function(){

        });

        it('should retrieve active components', function(){

        });

        it('should retrieve inactive components', function(){

        });

        it('should retrieve components that do not have an entity', function(){

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