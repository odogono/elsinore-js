var Common = require('./common');
var Es = require('event-stream');
var FixtureComponents = Common.fixtures.components;
var JSONComponentParser = require('../lib/streams').JSONComponentParser;


describe('Storage', function(){

    describe('EntitySet', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ 
                self.storage = storage;
                self.registry = storage.registry;
                self.ComponentDefs = self.registry.ComponentDef;
            })
            .then( function(){
                return self.registry.registerComponent( FixtureComponents );
            })
        });

        beforeEach( function initializeEntities(done){
            var self = this;
            var s = Common.createFixtureReadStream('entity_set.entities.ldjson')
                // convert JSON objects into components by loading into registry
                .pipe( JSONComponentParser(this.registry) )
                .pipe(Es.through( null, function end(){
                    self.entities = self.registry.storage.entities;
                    done();
                }));
        });

        // beforeEach( function(){
        //     this.storage.on('all', function(){
        //         log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
        //     });
        // })

        it('should create an entityset with all the entities in storage', function(){
            return this.storage.createEntitySet()
                .then(function(es){
                    es.length.should.equal(4);
                });
        });

        it('should create an entityset with selected entities in storage', function(){
            return this.storage.createEntitySet({include:[ this.ComponentDefs.Position ]})
                .then(function(es){
                    es.length.should.equal(2);
                });
        });

        it('should create an entityset with selected included/excluded entities in storage', function(){
            return this.storage.createEntitySet({include:[ this.ComponentDefs.Position ], exclude:[ this.ComponentDefs.Realname], debug:true})
                .then(function(es){
                    es.length.should.equal(1);
                });
        });


        it('should add a new entity with component', function(){
            var self = this;
            return this.storage.createEntitySet()
                .then(function(es){ return self.entitySet = es; })
                .then(function(es){
                    return self.registry.createEntity( [{schema:'realname', name:'jon snow'}, 'score'] );
                })
                .then(function(ent){
                    self.entitySet.length.should.equal(5);
                });
        });

        it('should remove a component', function(){
            var self = this;
            return this.storage.createEntitySet()
                .then(function(es){ return self.entitySet = es; })
                .then(function(es){
                    self.entitySet.length.should.equal(4);
                    // grab the first component
                    var ents = self.entitySet.entities;
                    return self.registry.destroyEntity( ents[0] );
                })
                .then( function(){
                    self.entitySet.length.should.equal(3);
                })
        });

    });
});