var Common = require('./common');

describe('Storage', function(){

    describe('ComponentDef', function(){

        beforeEach( function(){
            var self = this;
            return Common.createAndInitialize().then(function(storage){ self.storage = storage; });
        });

        afterEach( function(){
        });


        it('should register a componentDef', function(){
            var self = this;
            var def = Common.createComponentDef('/component/test');
            return this.storage.registerComponentDef( def )
                .then(function(def){
                    return self.storage.isComponentDefRegistered('/component/test').should.eventually.equal(true);
                });
        });

        it('should throw an error when attempting to register an existing componentDef', function(){
            var self = this;
            var def = Common.createComponentDef('/component/test');
            return this.storage.registerComponentDef( def )
                .then(function(def){
                    return self.storage.registerComponentDef( def ).should.be.rejectedWith( Error, '/component/test already registered' );
                });
        });

        it('should indicate that a componentDef exists', function(){
            var self = this;
            var def = Common.createComponentDef('/component/test');
            return this.storage.registerComponentDef( def )
                .then(function(def){
                    return self.storage.isComponentDefRegistered( '/component/test' ).should.eventually.equal( true );
                });
        });

        it('should indicate that a componentDef does not exist', function(){
            var self = this;
            return self.storage.isComponentDefRegistered( '/component/test' ).should.eventually.equal( false );
        });

        it('should unregister a componentDef', function(){
            var self = this;
            var def = Common.createComponentDef('/component/test');
            return this.storage.registerComponentDef( def )
                .then(function(def){
                    return self.storage.unregisterComponentDef( '/component/test' );
                })
                .then(function(def){
                    return self.storage.isComponentDefRegistered( '/component/test' ).should.eventually.equal( false );
                });
        });


        it('should retrieve an existing componentDef', function(){
            var self = this;
            var schema = {
                id: '/component/flower',
                properties:{
                    name: { type:'string', 'default':'daisy' },
                    colour: { type:'string', 'default':'red' },
                    height: { type:'number', 'default':1.0 }
                }
            };
            var defaults = { name:'daisy', colour:'red', height:1.0 };
            var def = ComponentDef.create( schema, null, defaults );

            // var def = Common.createComponentDef('/component/rtest');
            return this.storage.registerComponentDef( def )
                .then(function(def){
                    return self.storage.retrieveComponentDef( '/component/flower' );
                })
                .then(function(def){
                    def.get('schema').id.should.equal('/component/flower');
                    def.get('schema').properties.name.should.deep.equal( { type:'string', 'default':'daisy' } );
                });
        });

        it('should throw an error when retrieving an unknown componentDef', function(){
            return this.storage.retrieveComponentDef( '/component/test' ).should.be.rejectedWith( Error, '/component/test is not registered' );
        });
        
    });

});
