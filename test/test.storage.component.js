var Common = require('./common');



describe('Storage', function(){

    describe('Component', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ self.registry = storage.registry; self.storage = storage; });
        });

        beforeEach( function registerComponentDefs(){
            return Common.registerComponentDef( this.storage, ['/component/flower','/component/vegetable', '/component/mineral'] )
        });

        afterEach( function(){
        });

        it('should throw an error attempting to save a component without an entity', function(){
            var component = Common.createComponent();
            return this.storage.saveComponents( [component] ).should.be.rejectedWith(Error, 'component is not attached to an entity');
        });

        it('should throw an error attempting to save a component without a ComponentDef', function(){
            var component = Common.createComponent();
            component.setEntityId( 122 );
            return this.storage.saveComponents( [component] ).should.be.rejectedWith(Error, 'component has no def');
        });

        it('should give a new component an id after creating', function(){
            var component = Common.getComponentDef('/component/flower').create({colour:'yellow', entityId:123});
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

            var components = Common.createComponents([
                {schema:'/component/flower', name:'daisy', entityId:125},
                {schema:'/component/flower', name:'rose', entityId:125},
                {schema:'/component/flower', name:'bluebell', entityId:125}
            ]);

            return storage.saveComponents( components )
                .then( function(components){
                    expect( components[2].isNew() ).to.be.false;
                });
        });


        it('should retrieve a component by id', function(){
            var self = this;
            var component = Common.createComponent('/component/flower',{entityId:126,naga:'nog'});

            return this.storage.saveComponents( [component] )
                .then( function(components){
                    return self.storage.retrieveComponentById( components[0].id ).should.eventually.be.fulfilled;
                });
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

                return Common.registerComponentDef( this.storage, '/component/person')
                    .then( function(){
                        return Common.createComponents( self.storage,[
                            { schema:'/component/person', name:'alex', entityId:128 }
                        ]);
                    })
                    .then( function(components){
                        var def = Common.ComponentDef['/component/person'];
                        return self.storage.retrieveComponentsByComponentDef( def );
                    })
                    .then( function(components){
                        components.length.should.equal(1);
                        components[0].get('name').should.equal('alex');
                    });
            });
        });

        describe('deleting components', function(){
            beforeEach( function(){
                var self = this;
                this.storage.registry.createComponent = function( defId, attrs, options){
                    return Common.createComponent( defId, attrs );
                };
                // create some components
                return Common.createComponents( this.storage, [
                    { schema:'/component/vegetable', name:'carrot', entityId:129 },
                    { schema:'/component/vegetable', name:'tomato', entityId:130 },
                    { schema:'/component/vegetable', name:'broccoli', entityId:131 },
                    { schema:'/component/mineral', name:'quartz', entityId:129 },
                    { schema:'/component/mineral', name:'topaz', entityId:130 },
                    { schema:'/component/mineral', name:'diamond', entityId:131 }
                ]);
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