var Common = require('./common');



describe('Storage', function(){

    describe('Component', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ self.storage = storage; });
        });

        afterEach( function(){
        });

        it('should give a new component an id after creating', function(){
            var component = Common.createComponent();
            
            expect(component.isNew()).to.be.true;
            expect(component.id).to.be.undefined;

            return this.storage.saveComponents( [component] )
                .then( function(components){
                    expect(components[0].isNew()).to.be.false;
                    expect(components[0].id).not.to.be.undefined;
                });
        });

        it('should create an array of components', function(){
            var self = this;
            var storage = this.storage;

            return Common.registerComponentDef( storage, '/component/flower' )
                .then( function(def){
                    var components = Common.createComponents([
                        {schema:'/component/flower', name:'daisy'},
                        {schema:'/component/flower', name:'rose'},
                        {schema:'/component/flower', name:'bluebell'}
                    ]);

                    return storage.saveComponents( components )
                        .then( function(components){
                            expect( components[2].isNew() ).to.be.false;
                        });
                });
        });


        it('should retrieve a component by id', function(){
            var self = this;
            var component = Common.createComponent(102);

            var registry = { instantiateComponent:function(){} };
            var registryMock = Sinon.mock(registry);

            registryMock.expects('instantiateComponent').once().withArgs().returns( Common.createComponent(102) );
            this.storage.registry = registry;

            return this.storage.saveComponents( [component] )
                .then( function(components){
                    return self.storage.retrieveComponentById( components[0].id ).should.eventually.be.fulfilled;
                })
                .then( function( component ){
                    registryMock.verify();
                })
        });

        it('should throw an error when retrieving an unknown component', function(){
            return this.storage.retrieveComponentById( 403 ).should.be.rejectedWith(Error, 'component 403 not found');
        });

        describe('retrieving components', function(){
            beforeEach( function(){
                var self = this;                
            });

            it('should retrieve components by a schema id', function(){
                var self = this;
                var registry = { instantiateComponent:function(){} };
                var registryMock = Sinon.mock(registry);

                registryMock.expects('instantiateComponent')
                    .once()
                    .withArgs(2001, { id: 3001, name: "alex" })
                    .returns( Common.createComponent() );

                this.storage.registry = registry;

                return Common.registerComponentDef( this.storage, '/component/person')
                    .then( function(){
                        return Common.createComponents( self.storage,[
                            { schema:'/component/person', name:'alex'}
                        ]);
                    })
                    .then( function(components){
                        var def = Common.ComponentDef['/component/person'];
                        return self.storage.retrieveComponentsByComponentDef( def );
                    })
                    .then( function(components){
                        registryMock.verify();
                    });
            });
        });

        describe('deleting components', function(){
            beforeEach( function(){
                var self = this;
                this.storage.registry.instantiateComponent = function( defId, attrs){
                    return Common.createComponent( defId, attrs );
                };
                return Common.registerComponentDef( self.storage, ['/component/vegetable', '/component/mineral'] )
                    .then( function(){
                        // create some components
                        return Common.createComponents( self.storage, [
                            { schema:'/component/vegetable', name:'carrot' },
                            { schema:'/component/vegetable', name:'tomato' },
                            { schema:'/component/vegetable', name:'broccoli' },
                            { schema:'/component/mineral', name:'quartz' },
                            { schema:'/component/mineral', name:'topaz' },
                            { schema:'/component/mineral', name:'diamond' }
                        ]);
                    });
            });

            it('should delete all components', function(){
                var self = this;
                return this.storage.retrieveComponents()
                    .then( function(components){
                        components.length.should.equal(6);
                    })
                    .then( function(){
                        return self.storage.destroyComponents();
                    })
                    .then( function(){
                        return self.storage.retrieveComponents();
                    })
                    .then( function( components){
                        components.length.should.equal(0);
                    });
            });

            it('should delete all components of a given type', function(){
                var self = this;
                var def = Common.getComponentDef('/component/mineral')
                return this.storage.destroyComponents( def )
                    .then( function(){
                        return self.storage.retrieveComponents();
                    })
                    .then( function( components){
                        components.length.should.equal(3);
                    });
            });
        });

        

        

        it('should update the status of a component');

        it('should retrieve components that belong to a set of ids');

        it('should retrieve active components');

        it('should retrieve inactive components');

        it('should retrieve components that do not have an entity');
        
    });

});