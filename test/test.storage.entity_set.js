var Common = require('./common');
var FixtureComponents = Common.fixtures.components;

describe('Storage', function(){

    describe('EntitySet', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ 
                self.storage = storage;
                self.registry = storage.registry;
            })
            .then( function(){
                return self.registry.registerComponent( FixtureComponents );
            })
        });

        beforeEach( function initializeEntities(){
            var self = this;

            self.entities = [
                [{schema:'position', x:10, y:-10}, {schema:'nickname', nick:'john'}, {schema:'realname', realname:'John Smith'} ],
                [{schema:'score', score:3}, {schema:'nickname', nick:'peter'}],
                [{schema:'position', x:-32, y:10}, {schema:'score', score:10}],
                [{schema:'realname', name:'susan mayall'}],
            ];

            return this.registry.createEntities( self.entities )
                .then( function(entities){
                    self.entities = entities;
                    self.ComponentDefs = self.registry.ComponentDef;
                });
        });

        it('should create an entityset with all the entities in storage', function(){
            return this.storage.createEntitySet()
                .then(function(es){
                    es.length.should.equal(4);
                });
        });

        it('should add a new entity with component', function(){
            var self = this;
            // this.storage.on('all', function(){
            //     log.debug('evt ' + JSON.stringify( _.toArray(arguments) ) );
            // });
            return this.storage.createEntitySet()
                .then(function(es){
                    self.entitySet = es;
                    return self.registry.createEntity( [{schema:'realname', name:'jon snow'}, 'score'] );
                })
                .then(function(ent){
                    self.entitySet.length.should.equal(5);
                });
        });

    });
});