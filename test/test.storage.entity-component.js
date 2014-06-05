var Common = require('./common');

describe('Storage', function(){

    describe('Entity-Component', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize()
                .then(function(storage){ 
                    self.storage = storage;
                    return Common.registerComponentDef( storage, 
                        ['/component/position', '/component/velocity', '/component/target'] )
                })
                .then( function(){
                    return Common.createComponents( self.storage, [
                        { schema:'/component/target', type:'hostile' },
                        { schema:'/component/position', x:25, y:-14 },
                        { schema:'/component/velocity', x:0, y:-1 } ] );
                })
                .then( function(components){
                    self.components = components;
                    return Common.createEntity(null, self.storage, {save:true} )
                })
                .then( function(entity){
                    self.entity = entity;
                });
        });

        it('should set the entity id on a component when added to an entity', function(){
            var self = this;
            var component = self.components[0];

            return this.storage.addComponentsToEntity( [component], this.entity )
                .then( function(){
                    return self.storage.retrieveComponentById( component.id );
                })
                .then( function(component){
                    expect( component.getEntityId() ).to.equal( self.entity.id );
                });
        });

        it('should throw an error adding a component to an invalid entity', function(){
            var entity = Common.createEntity();
            var component = this.components[0];
            return this.storage.addComponentsToEntity( [component], entity ).should.be.rejectedWith( Error, 'invalid entity' );
        });

        it('should throw an error adding an invalid component to an entity', function(){
            var component = Common.createComponent(102);
            return this.storage.addComponentsToEntity( [component], this.entity ).should.be.rejectedWith( Error, 'invalid component' );
        });

        it('should retrieve an entities component', function(){
            var self = this;
            var component = self.components[0];
            
            return this.storage.addComponentsToEntity( [component], this.entity )
                .then( function(){
                    return self.storage.retrieveComponentsForEntity( [Common.getComponentDef('/component/target')], self.entity );
                })
                .then( function( result ){
                    expect( result[0].get('type') ).to.equal('hostile');
                });
        });

        it('should retrieve all components for an entity', function(){
            var self = this;
            return this.storage.addComponentsToEntity( this.components, this.entity )
                .then( function(){
                    return self.storage.retrieveComponentsForEntity( null, self.entity );
                })
                .then( function( result ){
                    expect( result.length ).to.equal(3);
                });
        });


        describe('removing', function(){
            beforeEach( function(){
                // var componentDef = [ Common.getComponentDef('/component/velocity'), Common.getComponentDef('/component/position') ];
                return this.storage.addComponentsToEntity( this.components, this.entity )
            });

            it('should remove a component from an entity', function(){
                var self = this;
                var componentDef = [ Common.getComponentDef('/component/velocity') ];
                return self.storage.removeComponentsFromEntity( componentDef, self.entity )
                    .then( function(){
                        return self.storage.retrieveComponentsForEntity( null, self.entity );
                    })
                    .then( function( result ){
                        expect( result.length ).to.equal(2);
                    });
            });

            it('should delete a component by default when removing from an entity', function(){
                var self = this;
                var componentDef = [ Common.getComponentDef('/component/position') ];
                var componentId = this.components[1].id;
                return self.storage.removeComponentsFromEntity( componentDef, self.entity )
                    .then( function(){
                        return self.storage.retrieveComponentById( componentId ).should.be.rejectedWith( Error, 'component ' + componentId + ' not' );
                    });
            });

            it('should throw an error removing an invalid component from an entity' );
            it('should throw an error removing a component from an invalid entity' );
            it('should remove all components from an entity' );

        });

        

        

        
        it('should throw an error when trying to add a second identical component' );
        it('should indicate whether a component belongs to an entity' );
        it('should delete an entity and its components' );

    });


});