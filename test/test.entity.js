require('./common');


describe('Entity', function(){

    beforeEach( function(){
        // unload and reload the odgn module
        delete require.cache[ require.resolve('../index') ];
        odgn = require('../index')();
        this.registry = odgn.Entity.Registry.create();
    });

    it('should register a new entity',function(){
        
        var ActorEntityDef = this.registry.register({
            id: '/entity/actor',
            type:'object',
            properties:{
                name: { type:'string' }
            }
        });

        var inst = ActorEntityDef.create();
        assert( inst instanceof odgn.Entity.ActorEntityDef.model );
    });


    it('should create an entity instance from a schema id', function(){
        this.registry.register({
            id: '/entity/actor',
            type:'object',
            properties:{
                name: { type:'string' }
            }
        });

        var oinst = this.registry.create('/entity/actor');
        assert( oinst instanceof odgn.Entity.ActorEntityDef.model );
    });
});