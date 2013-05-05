require('../lib/common');
var inspect = require('util').inspect;
var Entity = require('odgn-entity');

Common.log.transports.console.silent = false;

describe('Sync.Redis', function(){

    after(function(){
        for (var key in Object.keys(require.cache)){ delete require.cache[key]; }
    });
    
    var testEntities = [
        { type: 'test_a', ER:[ { oneToMany: 'test_b' } ] },
        { type: 'test_b', ER:[ { oneToMany:'test_c'} ] },
        { type: 'test_c' },
        { type: 'test_d', ER:[ { oneToOne:'test_c', name:'friend'},{ oneToOne:'test_c', name:'colleague'} ] },
        { type: 'test_e', ER:[ {oneToOne:'test_f', name:'comrade'}, {oneToMany:'test_f', name:'others'} ] },
        { type: 'test_f', ER:[ {oneToOne:'test_a', name:'associate'} ] },
    ];

    _.each( testEntities.reverse(), function(e){
        Entity.registerEntity(e);
    });




    jstonkers.sync.set('override','redis');

    beforeEach( function(done){
        jstonkers.sync.clear( function(err){
            if( err ) return done(err);
            done();
        });
    });

    /*
    describe('id generation', function(){
        var id1, id2;
        it('should create a new id', function(done){
            Step(
                function(){
                    jstonkers.sync.generateUuid(this);
                },
                function(err,id){
                    if(err) throw err;
                    id1 = id;
                    jstonkers.sync.generateUuid(this);
                },
                function(err,id){
                    if(err) throw err;
                    id.should.not.equal(id1);
                    done();
                }
            );
        });
    });//*/

    describe('Entity', function(){
        
        // it('should make the entity belong to a status set');

        // it('should delete the entity cleanly');
        
        
        it('should save an entity', function(done){
            var user = Entity.create(Entity.TYPE_TEST_A, {name:'freddy'}); 
            Step(
                function(){
                    assert( user.isNew() );
                    assert( !user.id );
                    user.saveCb( this );
                },
                function(err,result){
                    if( err ) throw err;
                    assert( !user.isNew() );
                    assert( user.id );
                    result.get('name').should.equal('freddy');
                    Entity.create( Entity.TYPE_TEST_A, result.id ).fetchCB( this );
                },
                function(err,result){
                    if( err ) throw err;
                    result.get('name').should.equal('freddy');
                    done();
                }
            )
        });

        it('should save part of a o2o relationship', function(done){
            var a = Entity.create( Entity.TYPE_TEST_E, {name:'enigma'} );
            var b = Entity.create( Entity.TYPE_TEST_F, {name:'foxtrot'} );
            a.set( {comrade:b} );
            Step(
                function(){
                    a.saveCb( this );
                },
                function(err,result){
                    Entity.create( Entity.TYPE_TEST_E, a.id ).fetchCB( this );
                },
                function(err,model,resp){
                    assert.equal( model.id, a.id );
                    assert.equal( model.get('name'), a.get('name') );
                    
                    assert( !model.get('comrade') );
                    done();
                }
            );
        });



        
        it.only('should save a complete o2o relationship', function(done){
            var a = Entity.create( Entity.TYPE_TEST_E, {name:'enigma'} );
            var b = Entity.create( Entity.TYPE_TEST_F, {name:'foxtrot'} );
            // print_ins(a);
            a.set( {comrade:b} );

            Step(
                function(){
                    assert( a.isNew() );
                    assert( b.isNew() );
                    a.saveRelatedCb( this );
                },
                function(err,result){
                    if( err ) throw err;
                    assert( !a.isNew() );
                    assert( !b.isNew() );
                    var aC = Entity.create( Entity.TYPE_TEST_E, a.id );
                    aC.fetchRelatedCB( this );
                },
                function(err,model,resp){
                    if( err ) throw err;
                    print_ins(model);
                    assert.equal( model.get('comrade').get('name'), 'foxtrot' );
                    done();
                }
            );
        });
        
        
        it('should save a parent and child entity', function(done){
            var a = Entity.create( Entity.TYPE_TEST_A, {name:'alex'} );
            var b = Entity.create( Entity.TYPE_TEST_B, {name:'beatrix'} );
            
            a.test_b.add( b );
            assert( a.test_b.length, 1 );
            assert( a.test_b instanceof Entity.EntityCollection );
            // print_ins( a );
            Step(
                function (){
                    assert( a.isNew() );
                    assert( b.isNew() );
                    a.saveRelatedCb( this );
                },
                function(err,result){
                    assert( !a.isNew() );
                    assert( !b.isNew() );
                    // should still have the same objects essentially
                    assert( result.test_b.length, 1 );
                    // attempt restore
                    var aCopy = Entity.create( Entity.TYPE_TEST_A, a.id );
                    assert.equal( aCopy.id, a.id );
                    // fetch the parent and children to a depth of two
                    aCopy.fetchRelatedCB( this );
                },
                function(err,result){
                    if( err ) throw err;
                    assert.equal( result.get('name'), 'alex');
                    assert.equal( result.test_b.length, 1 );
                    assert.equal( result.test_b.at(0).get('name'), 'beatrix' );
                    done();
                }
            );

        });

        
        it('should retrieve an associated entity', function(done){
            var a = Entity.create( Entity.TYPE_TEST_D, {name:'alpha'} );
            var b = Entity.create( Entity.TYPE_TEST_C, {name:'beta'} );
            a.set('friend',b);
            a.set('colleague',b);
            Step(
                function(){
                    a.saveRelatedCb( null, this ); 
                },
                function(err,result){
                    var copy = Entity.create( Entity.TYPE_TEST_D, result.id );
                    copy.fetchRelatedCB( this );
                },
                function(err,result){
                    assert( result.get('name') === a.get('name') );
                    assert( result.get('friend').get('name') === b.get('name') );
                    done();
                }
            );
        });

        it('should retrieve a o2m relationship', function(done){
            var a = Entity.create({
                id:"enigma_1",
                type: "test_e",
                comrade:{ id:'foxtrot_1', type:'test_f' },
                others:[
                    { id:'foxtrot_2', type:'test_f' },
                    { id:'foxtrot_3', type:'test_f' }
                ]
            });

            Step(
                function(){
                    a.saveRelatedCb( null, this ); 
                },
                function(err,result){
                    Entity.create( Entity.TYPE_TEST_E, result.id ).fetchRelatedCB( this );
                },
                function(err,result){
                    // print_var( result );
                    assert.equal( result.get('comrade').id, 'foxtrot_1' );
                    assert.equal( result.others.length, 2 );
                    // assert( result.get('name') === a.get('name') );
                    // assert( result.get('friend').get('name') === b.get('name') );
                    done();
                }
            );
        });
        
        it('should respond correctly to fetching a nonexistent entity', function(done){
            Step(
                function(){
                    Entity.create( Entity.TYPE_TEST_A, 'unknown.001' ).fetchCB( this );
                },
                function(err, result){
                    assert.equal( err, 'unknown.001 not found');
                    done();
                }
            );
        });

        it('should generate ids correctly', function(done){
            var a = Entity.create({
                name: "enigma",
                type: "test_e",
                comrade:{
                    name: "foxtrot",
                    type:"test_f",
                    associate:{ type:'test_a', name:'arnold' }
                },
                others:[
                    { name:'foxtrot_2', type:'test_f' },
                    { name:'foxtrot_3', type:'test_f' }
                ]
            });

            Step(
                function(){
                    a.saveRelatedCb(this);
                },
                function(err,result){
                    var json = a.toJSON();
                    assert.equal( a.id, json.id );
                    assert( json.comrade.id );
                    assert.equal( a.get('comrade').id, json.comrade.id );
                    assert( json.others[1].id );
                    assert.equal( a.others.at(1).id, json.others[1].id );
                    done();
                }
            );
        });

        
        it('should logically delete an entity', function(done){
            var a = Entity.create( Entity.TYPE_TEST_A, {name:'alf',status:jstonkers.Status.ACTIVE} );
            assert.equal( a.get('status'), jstonkers.Status.ACTIVE );
            Step(
                function(){
                    a.saveCb( null, this);
                },
                function(err,result){
                    Entity.create( Entity.TYPE_TEST_A, a.id ).fetchCB( this );
                },
                function(err,result){
                    assert.equal(result.get('name'), 'alf');
                    assert.equal(result.get('status'),jstonkers.Status.ACTIVE);
                    result.destroyCB(this);
                },
                function(err,result){
                    assert( !err );
                    Entity.create( Entity.TYPE_TEST_A, a.id ).fetchCB( this );
                },
                function(err,result){
                    assert.equal(err, a.id + ' not found');
                    Entity.create( Entity.TYPE_TEST_A, a.id ).fetchCB( {ignoreStatus:true}, this );
                },
                function(err, finalResult ){
                    if( err ) throw err;
                    assert( finalResult.get('name'), 'alf' );
                    assert( finalResult.get('status'), jstonkers.Status.LOGICALLY_DELETED );
                    done();
                }
            );
        });


        it('should completely delete an entity', function(done){
            var a = Entity.create( {type:Entity.TYPE_TEST_A, name:'ash', status:jstonkers.Status.ACTIVE} );
            var initialCount;
            var initialKeys;
            Step(
                function(){
                    jstonkers.sync.keys( this );
                },
                function(err, result){
                    initialKeys = result;
                    initialCount = result.length;
                    a.saveCb( null, this );
                },
                function(err,result){
                    result.destroyCB({destroyHard:true},this);
                },
                function(){
                    Entity.create( Entity.TYPE_TEST_A, a.id ).fetchCB( {ignoreStatus:true}, this );
                },
                function(err,result){
                    assert.equal(err, a.id + ' not found');
                    jstonkers.sync.keys( this );
                },
                function(err, keys){
                    var config = Common.config.sync.redis;
                    var key = config.key_prefix + ':' + config.uuid.key;
                    // print_var( keys );

                    // the only difference should be the uuid key
                    // assert.equal(key, _.difference( keys, initialKeys )[0] );
                    // same count minus the uuid key
                    assert.equal( initialCount, keys.length );
                    done();
                }
            );
        });

        it('should logically delete an entity and related', function(done){
            var a = Entity.create({
                id:"enigma_1",
                name: "enigma",
                status: "atv",
                type: "test_e",
                comrade:{
                    id:"foxtrot_1",
                    name: "foxtrot",
                    status: "atv",
                    type:"test_f",
                    associate:{
                        id:'alpha_a',
                        status:'atv',
                        type:'test_a',
                        name:'arnold'
                    }
                },
                others:[
                    { id:'foxtrot_2', type:'test_f' },
                    { id:'foxtrot_3', type:'test_f' }
                ]
            });

            Step(
                function(){
                    a.saveRelatedCb( this);
                },
                function(err,result){
                    Entity.create( Entity.TYPE_TEST_E, a.id ).fetchRelatedCB( this );
                },
                function(err,result){
                    assert.equal(result.get('name'), 'enigma');
                    result.destroyRelatedCB(this);
                },
                function(err,result){
                    assert( !err );
                    Entity.create( Entity.TYPE_TEST_E, a.id ).fetchRelatedCB( this );
                },
                function(err,result){
                    assert.equal(err, a.id + ' not found');
                    Entity.create( Entity.TYPE_TEST_E, a.id ).fetchRelatedCB( {ignoreStatus:true}, this );
                },
                function(err, result ){
                    if( err ) throw err;
                    assert( result.get('name'), 'enigma' );
                    assert( result.get('status'), jstonkers.Status.LOGICALLY_DELETED );
                    assert( result.get('comrade').get('status'), jstonkers.Status.LOGICALLY_DELETED );
                    assert( result.get('comrade').get('associate').get('status'), jstonkers.Status.LOGICALLY_DELETED );
                    done();
                }
            );
        });//*/

        it('should completely delete an entity and related', function(done){
            var initialCount, initialKeys;
            var a = Entity.create({
                id:"enigma_1",
                name: "enigma",
                status: "atv",
                type: "test_e",
                comrade:{
                    id:"foxtrot_1",
                    name: "foxtrot",
                    status: "atv",
                    type:"test_f",
                    associate:{
                        id:'alpha_a',
                        status:'atv',
                        type:'test_a',
                        name:'arnold'
                    }
                },
                others:[
                    { id:'foxtrot_2', type:'test_f' },
                    { id:'foxtrot_3', type:'test_f' }
                ]
            });

            Step(
                function fetchAllKeys(){
                    jstonkers.sync.keys( this );
                },
                function countCurrentKeysAndSave(err, result){
                    initialKeys = result;
                    initialCount = result.length;
                    a.saveRelatedCb( null, this );
                },
                function destroyEntity(err,result){
                    result.destroyRelatedCB({destroyHard:true},this);
                },
                function recreateEntityAndFetch(){
                    Entity.create( Entity.TYPE_TEST_E, a.id ).fetchRelatedCB( {ignoreStatus:true}, this );
                },
                function recountCurrentKeys(err,result){
                    assert.equal(err, a.id + ' not found');
                    jstonkers.sync.keys( this );
                },
                function confirmAllDestroyed(err, keys){
                    assert.equal( keys.length, 0 );
                    // same count minus the uuid key
                    assert.equal( initialCount, keys.length );
                    done();
                }
            );
        });

        
        it('should retrieve by storeKeys', function(done){
            var TestEntity = Entity.Entity.extend({
                storeKeys: function(){
                    var keys = Entity.prototype.storeKeys.apply(this,arguments);
                    return _.union( [ {key:"ans_id", unique:true} ], keys );
                }
            });

            Entity.registerEntity( 'test_ent', TestEntity );

            var col = Entity.Collection.create({entityType:'test_ent'}, [
                { name:'ent1' },
                { name:'ent2' },
                { name:'ent3', ans_id:'sigma5', variance:'none' },
                { name:'ent4' }
            ]);

            Step(
                function(){
                    // var ent = Entity.create( TestEntity, { ans_id:'sigma5', variance:'none' } );
                    col.saveCb(this);
                    // ent.saveCb(this);
                },
                function(err,result){
                    if( err ) throw err;

                    var ent = Entity.create( TestEntity );
                    ent.fetchCB({query:{ans_id:'sigma5'}}, this);
                },
                function(err,result){
                    if( err ) throw err;
                    assert.equal( result.get('variance'), 'none' );
                    done();
                }
            );

        });//*/
        
    });

    
    
    describe('CommandQueue', function(){
        var initialCount, initialKeys;
        var CmdTestA = jstonkers.CommandQueue.Command.extend({
            execute: function(options,callback){
                callback( null, true, this );
            },
            isCmdTestA: function(){
                return true;
            }
        });

        Entity.registerEntity( 'cmd_test_a', CmdTestA );

        it('should destroy processed commands', function(done){
            var q = jstonkers.CommandQueue.create();

            Step(
                function fetchAllKeys(){
                    jstonkers.sync.keys( this );
                },
                function countCurrentKeysAndSave(err, result){
                    initialKeys = result;
                    initialCount = result.length;
                    q.saveRelatedCb( this );
                },
                function createCommandAndAdd(err,result){
                    if( err ) throw err;
                    var cmd = Entity.create( CmdTestA, {execute_time:-1} );
                    q.add( cmd );
                    assert.equal( q.length, 1 );
                    q.saveRelatedCb( this );
                },
                function processQueue(err,result){
                    if( err ) throw err;
                    q.destroyRelatedCB( {destroyHard:true}, this );
                },
                function recreateQueue(err,result){
                    if( err ) throw err;
                    // the fetched queue should contain no items
                    Entity.CommandQueue.create({id:q.id}).fetchRelatedCB(this);
                },
                function recountCurrentKeys(err,result){
                    assert.equal( result.length, 0)
                    jstonkers.sync.keys( this );
                },
                function confirmAllDestroyed(err, keys){
                    var config = Common.config.sync.redis;
                    var key = config.key_prefix + ':' + config.uuid.key;

                    // the only difference should be the uuid key
                    // assert.equal(key, _.difference( keys, initialKeys )[0] );
                    // same count minus the uuid key
                    assert.equal( initialCount, keys.length );
                    done();
                }
            );

        });
    });//*/
    
    
    describe('EntityCollection', function(){
        
        it('should save contained entities', function(done){
            var entityIds = [];

            var col = Entity.Collection.create({entityType:'test_a'},[
                { name:'test entity 1' },
                { name:'test entity 2' },
                { name:'test entity 3' }
            ]);
            // print_ins(col);
            col.at(2).set('created_at', '1974-09-05T15:32Z');
            col.length.should.equal(3);
            col.get('item_count').should.equal(3);

            Step(
                function(){
                    col.saveCb( this );
                },
                function(err,result){
                    if( err ) throw err;
                    // print_ins( col );
                    var group = this.group();

                    // verify the entites were saved
                    col.each( function(ent){
                        ent.fetchCB( group() );
                    });
                },
                function(err,entities){
                    if( err ) throw err;
                    assert.equal( entities[1].get('name'), 'test entity 2');
                    assert.equal( 
                        new Date(entities[2].get('created_at')).toUTCString(), 
                        new Date('1974-09-05T15:32:00.000Z').toUTCString() );
                    done();
                }
            );
        });//*/

        it('should retrieve entities by type and status', function(done){
            var entityIds = [];

            var col = Entity.Collection.create({entityType:'test_a'},[
                { name:'test entity 1' },
                { name:'test entity 2', status:jstonkers.Status.INACTIVE },
                { name:'test entity 3' }
            ]);

            Step(
                function(){
                    col.saveCb( this );
                },
                function(err,result){
                    if( err ) throw err;
                    
                    var fetchCol = Entity.Collection.create({
                        entityType:'test_a',
                        entityStatus:jstonkers.Status.ACTIVE
                    });
                    fetchCol.fetchCB( this );
                },
                function(err,resultCol){
                    if( err ) throw err;
                    // print_ins( arguments );
                    assert.equal( resultCol.length, 2 );
                    assert.equal( resultCol.at(0).get('name'), 'test entity 1' );
                    assert.equal( resultCol.at(1).get('name'), 'test entity 3' );
                    done();
                }
            );
        });
        
        /*
        it('should work as part of an entity', function(done){
            var entityDef = {
                type: 'ecenta',
                ER:[
                    { oneToMany: 'ecentb', name:'friends' }
                ]
            };
            Entity.registerEntity( { type: 'ecentb' } );
            Entity.registerEntity( entityDef );

            var inst = Entity.create( 'ecenta.001' );
            inst.friends.add( Entity.create({id:'002', type:'ecentb', name:'friend A'}) );

            var friend = inst.friends.at(0);
            friend.should.be.an.instanceof( Entity.Ecentb.entity );
            inst.friends.length.should.equal(1);
            inst.friends.get('item_count').should.equal(1);

            Step(
                function(){
                    inst.save( null, Bjs2Callback(this) );
                },
                function(err, model, resp){
                    // print_ins(arguments);
                    var restored = new Entity.create( inst.id );
                    restored.friends.length.should.equal(0);
                    restored.friends.get('item_count').should.equal(0);
                    restored.fetch( Bjs2Callback(this) );
                },
                function(err, result, resp){
                    result.friends.length.should.equal(0);
                    result.friends.get('item_count').should.equal(1);
                    done();
                }
            );
        });

        
        it('should retrieve an entities children', function(done){
            var entityDef = {
                type: 'sraeca',
                ER:[
                    { oneToMany: 'sraecb', name:'chums' }
                ]
            };
            Entity.registerEntity( { type: 'sraecb' } );
            Entity.registerEntity( entityDef );

            var inst = Entity.create( 'sraeca.001' );
            inst.chums.add( Entity.create({id:'002', type:'sraecb', name:'Good chum no.1'}) );

            var other = Entity.create({id:'sraecb:OUTSIDER', type:'sraecb', name:'should not return'});

            Step(
                function(){
                    // save the other entity which isn't part of the entities collection
                    other.save(null, Bjs2Callback(this) );
                },
                function(){
                    inst.save( null, Bjs2Callback(this) );
                }, 
                function(err, model, resp){
                    var restored = new Entity.create( inst.id );
                    restored.fetch( Bjs2Callback(this, {retrieveChums:true} ) );
                },
                function(err, result, resp){
                    result.chums.length.should.equal(1);
                    result.chums.get('item_count').should.equal(1);
                    result.chums.at(0).get('name').should.equal( 'Good chum no.1' );
                    done();
                }
            );
        });

        it('should retrieve an entities children directly', function(done){
            var entityDef = {
                type: 'sraeca',
                ER:[
                    { oneToMany: 'sraecb', name:'chums' }
                ]
            };
            Entity.registerEntity( { type: 'sraecb' } );
            Entity.registerEntity( entityDef );

            var inst = Entity.create( 'sraeca.001' );
            inst.chums.add( Entity.create({id:'002', type:'sraecb', name:'Good chum no.1'}) );

            // create another entity just to be sure
            var other = Entity.create({id:'sraecb:OUTSIDER', type:'sraecb', name:'should not return'});

            var restored = null;

            Step(
                function(){
                    // save the other entity which isn't part of the entities collection
                    other.save(null, Bjs2Callback(this) );
                },
                function(){
                    inst.save( null, Bjs2Callback(this) );
                }, 
                function(err, model, resp){
                    restored = new Entity.create( inst.id );
                    restored.chums.length.should.equal(0);
                    restored.chums.get('item_count').should.equal(0);

                    // this is the difference - we are asking the collection directly to get its members
                    restored.chums.fetch( Bjs2Callback(this) );
                },
                function(err, result, resp){
                    restored.chums.length.should.equal(1);
                    restored.chums.get('item_count').should.equal(1);

                    // print_var( restored.chums.at(0) );
                    restored.chums.at(0).get('name').should.equal( 'Good chum no.1' );
                    done();
                }
            );
        });

        
        it('should be able to query entities', function(done){
            
            var entityDefA = { type:'qenta' };
            // var entityDefB = { type:'qentb' };
            Entity.registerEntity( entityDefA );
            // Entity.registerEntity( entityDefB );

            var col, i, entities;

            Step(
                function(){
                    var ent = Entity.create( {id:'qenta.A001', name:'totally special QuentA'} );
                    ent.save(null,{error:this, success:this});
                },
                function(){
                    entities = [];
                    for( i=0;i<5;i++ )
                        entities.push( {id:_.sprintf('qenta.%03d', i+1), name:'test entity ' + (i+1)} );
                    entities = _.shuffle( entities );
                    col = Entity.createEntityCollection( {items:entities, entity:entityDefA} );
                    col.length.should.equal(5);
                    col.get('item_count').should.equal(5);
                    col.at(0).should.be.an.instanceof( Entity.Qenta.entity );
                    col.save(null, {error:this, success:this});
                },
                function fetchAllEntityA(){
                    col = Entity.createEntityCollection({entity:entityDefA});
                    col.fetch({error:this,success:this});
                },
                function(result){
                    result.length.should.equal(6);
                    result.get('item_count').should.equal(6);
                    done();
                }
            )
        });

        it('should retrieve a subset of entities', function(done){
            var entityDefA = { type:'qenta' };
            Entity.registerEntity( entityDefA );

            var col, i, entities = [];

            for( i=0;i<15;i++ )
                entities.push( {id:_.sprintf('qenta.%03d', i+101), name:'test entity ' + (i+101)} );
            entities = _.shuffle( entities );

            Step(
                function(){
                    col = Entity.createEntityCollection( {items:entities, entity:entityDefA} );
                    col.length.should.equal(15);
                    col.at(0).should.be.an.instanceof( Entity.Qenta.entity );
                    col.save(null, Bjs2Callback(this) );
                },
                function fetchAllEntityA(err,result){
                    col = Entity.createEntityCollection({entity:entityDefA});
                    col.fetch( Bjs2Callback(this) );
                },
                function(err, result){
                    result.length.should.equal(10);
                    result.get('item_count').should.equal(15);
                    done();  
                }
            );
        });
        
        
        it('should retrieve a specified entity', function(done){
            var retrieveId;

            Step(
                function(){
                    var col = Entity.createEntityCollection({entity:Entity.TYPE_TEST});
                    for( var i=0;i<5;i++ )
                        col.add( Entity.create( Entity.TYPE_TEST_A, {name:'test entity ' + i, status:jstonkers.Status.INACTIVE} ) );
                    retrieveId = col.at(2).id;
                    col.save( null, {success:this});
                },
                function fetchAllEntityA(){
                    var next = this;
                    var col = Entity.createEntityCollection({entity:Entity.TYPE_TEST});
                    // col.fetch({error:this,success:this, find:{id:retrieveId} });

                    col.fetch({find:{id:retrieveId},
                        success:function(model,resp){
                        // print_ins( arguments );
                        next( null, model );
                    }, error:function(err,model,resp){
                        next( err, model );
                    }});
                },
                function(err,result){
                    // print_ins(arguments);
                    result.length.should.equal(1);
                    result.get('item_count').should.equal(1);
                    result.at(0).id.should.equal( retrieveId );
                    done(); 
                }
            );
        });


        it('should retrieve entities with a given status', function(done){
            var entityIds = [];

            Step(
                function(){
                    var col = Entity.createEntityCollection({entity:Entity.TYPE_TEST});
                    for( var i=0;i<5;i++ )
                        col.add( Entity.create( Entity.TYPE_TEST_A, {name:'test entity ' + i, status:jstonkers.Status.INACTIVE} ) );

                    col.at(1).set('status', jstonkers.Status.ACTIVE );
                    col.at(3).set('status', jstonkers.Status.ACTIVE );
                    
                    entityIds = col.items.map( function(i){ return i.id; });
                    col.save( null, {success:this});
                },
                function fetchAllEntityA(){
                    var next = this;
                    var col = Entity.createEntityCollection({entity:Entity.TYPE_TEST});
                    col.fetch({find:{status:{$ne:jstonkers.Status.INACTIVE}},
                        success:function(model,resp){
                        // print_ins( arguments );
                        next( null, model );
                    }, error:function(err,model,resp){
                        next( err, model );
                    }});
                },
                function(err,result){
                    result.length.should.equal(2);
                    result.get('item_count').should.equal(2);
                    done(); 
                }
            );
        });//*/
    });
    


});