var Common = require('./common');


describe('Storage', function(){

    describe('Entity', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ self.storage = storage; });
        });

        beforeEach( function registerComponentDefs(){
            return Common.registerComponentDef( this.storage, Common.loadJSONFixture('components.json') );
        });

        afterEach( function(){
        });

        it('should not retrieve an entity by its id without it having a component', function(){
            var self = this;
            return self.storage.retrieveEntity( {id:36} ).should.be.rejectedWith( Error, 'entity 36 not found');
        });

        it('should retrieve an entity with a component', function(){
            var self = this;
            var component = Common.createComponent('/component/flower', {colour:'yellow', _e:36});

            this.storage.saveComponents( [component] )
                .then(function(){
                    return self.storage.retrieveEntity({id:36});
                })
                .then(function(entity){
                    expect( entity.id ).to.equal(36);
                    expect( entity.Flower.get('colour') ).to.equal('yellow');
                });
        });

        it('should throw an error when retrieving an entity with an unknown id', function(){
            return this.storage.retrieveEntity( {id:37} ).should.be.rejectedWith( Error, 'entity 37 not found' );
        });


        it('should know that an entity does not exist', function(){
            return this.storage.hasEntity( {id:39} ).should.eventually.equal( false );
        });

        it('should create a new entity', function(){
            // this.storage.on('all', function(evt){
            //     log.debug('storage evt ' + JSON.stringify( _.toArray(arguments)) );
            // });
            var component = Common.createComponent('/component/animal', {name:'tiger'});

            expect(component.getEntityId()).to.equal(undefined);

            this.storage.saveComponents( [component], {createEntity:true} )
                .then( function(components){
                    expect( component.getEntityId() ).to.not.be.undefined;
                });
        });

        describe('destroying an entity', function(){
            beforeEach( function(){
                var component = Common.createComponent('/component/mineral', {name:'rock', _e:981});
                return this.storage.saveComponents([component]);
            });

            it('should destroy an entity', function(){
                var self = this;
                return self.storage.destroyEntity( {id:981} )
                    .then( function(){
                        return self.storage.hasEntity( {id:981} ).should.eventually.equal( false );
                    });
            });

            it('should emit an event when the entity is destroyed', function(){
                // this.storage.on('all', function(evt){
                //     log.debug('storage evt ' + JSON.stringify( _.toArray(arguments)) );
                // });
                var eventSpy = Sinon.spy();
                this.storage.on('entity:remove', eventSpy);

                return this.storage.destroyEntity({id:981})
                    .then( function(){
                        expect(eventSpy.called).to.be.ok;
                        eventSpy.getCall(0).args[0].should.equal( 981 );
                    });
            });
        });

    });

});