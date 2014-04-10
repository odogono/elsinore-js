require('./common');

var ComponentDef = Elsinore.ComponentDef;
var SchemaRegistry = Elsinore.SchemaRegistry;

describe('ComponentDef', function(){

    describe('naming', function(){
        it('should create a name from a schema id', function(){
            var schema = {
                id: '/component/example'
            };
            ComponentDef.nameFromSchema( schema ).should.equal( 'ExampleComDef' );
        });
        it('should create a name from a schema id', function(){
            var schema = {
                id: '/component/example',
                name: 'real_name'
            };
            ComponentDef.nameFromSchema( schema ).should.equal( 'RealNameComDef' );
        });
    });

    describe('schema', function(){
        it('should return the schemaId from its object property', function(){
            var def = ComponentDef.create( {id:'/component/flower'} );
            expect( def.getSchemaId() ).to.equal('/component/flower');
        });

        it('should return the schemaId from a string property', function(){
            var def = ComponentDef.create( '/component/flower' );
            expect( def.getSchemaId() ).to.equal('/component/flower');
        })
    });


    describe('default properties', function(){
        it('should return default properties', function(){
            var schema = {
                id: '/component/example',
                properties:{
                    name:{ type:'string', 'default':'pepper' }
                }
            };

            // result.should.equal( { name:'pepper' } );
        })
    });

    describe('creating', function(){
        it('should create with defaults', function(){
            var schemaRegistry = SchemaRegistry.create();
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
            ComponentDef.isComponentDef(def).should.equal(true);
            var com = def.create();

            com.toJSON().should.deep.equal({
                name:'daisy', colour: 'red', height: 1.0
            });
        });

        it('should have a schema property', function(){
            var def = ComponentDef.create( {id:'/component/flower'} );
            def.get('schema').should.deep.equal({id:'/component/flower'});
        });

        it('should have a name property', function(){
           var def = ComponentDef.create( {id:'/component/flower'} );
           def.get('className').should.equal('FlowerComDef');
           def.get('name').should.equal('Flower');
        });

        it('should set the component def on the component instance', function(){
            var def = ComponentDef.create( {id:'/component/flower'} );
            var com = def.create();
            com.ComponentDef.should.deep.equal( def );
        });

        it('should set its id on component instances', function(){
            var def = ComponentDef.create( {id:'/component/flower'} );
            def.id = 22;
            var com = def.create();
            com.ComponentDef.id.should.equal( def.id );
        });
    });
});