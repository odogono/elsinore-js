import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import {
    createComponent, 
    getByUri, getByHash, getByDefId,
    register } from '../../src/entity_set/registry';
import { Entity,
    create as createEntityInstance, 
    getComponent as getEntityComponent,
    size as entitySize, 
    isEntity,
    addComponentUnsafe
} from '../../src/entity';
import { EntitySet, 
    create as createEntitySet,
    size as entitySetSize,
    add as esAdd, 
    removeComponent, 
    getEntity,
    getComponent,
    getComponents as esGetComponents,
    getEntities as esGetEntities,
    createEntity,
    EntitySetMem,
    removeEntity} from '../../src/entity_set';
import { assertHasComponents } from '../util/assert';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';
import { isComponentDef, hash as hashDef, getDefId } from '../../src/component_def';
import { BuildQueryFn } from '../../src/query/build';

const Log = createLog('TestEntitySet');


describe('Entity Set (Mem)', () => {
    
    describe('Component Defs', () => {
        it('registers', async () => {
            let def;
            let es = createEntitySet({});
            const data = { uri: '/component/position', properties:[ {name:'rank',type:'integer'}, 'file' ] };
    
            [es, def] = register<EntitySetMem>( es, data );

            // Log.debug('es', es);

            [es,def] = register( es, "/component/piece/king" );
            [es,def] = register( es, "/component/piece/queen" );

            def = getByUri(es, '/component/position');

            assert.ok( isComponentDef(def) );

            def = getByHash(es, hashDef(def) );

            assert.equal( def.uri, '/component/position' );
        })
    })


    describe('Adding', () => {

        it('should create an entity (id)', () => {
            let es = createEntitySet({});
            let id = 0;

            [es, id] = createEntity(es);

            assert.isAtLeast( id, 1 );
        });

        it('should ignore an entity without an id', () => {
            let es = createEntitySet({});
            let e = createEntityInstance();

            es = esAdd(es, e);

            assert.equal( entitySetSize(es), 0 );
        })

        it('should ignore an entity with an id, but without any components', () => {
            let es = createEntitySet({});
            let e = createEntityInstance(2);

            es = esAdd(es, e);

            assert.equal( entitySetSize(es), 0 );

            // Log.debug('es', e);
        })

        it('adds an entity with components', async () => {
            let e:Entity;
            let [es,buildEntity] = buildEntitySet();

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            });
            
            
            assert.equal( entitySize(e), 3 );
            
            es = esAdd( es, e );
            
            // Log.debug('es', es);
            
            assert.equal( entitySetSize(es), 1 );
            
            // get the entity added changes to find the entity id
            const [eid] = getChanges( es.entChanges, ChangeSetOp.Add );
            
            e = getEntity( es, eid, true );

            // e.Channel = {...e.Channel, name: 'bbc1' };
            

            assertHasComponents(
                es,
                e,
                ["/component/channel", "/component/status", "/component/topic"]
            );
        });

        it('adds a component', async () => {
            let [es] = buildEntitySet();
            let com = createComponent(es, '/component/channel', {name: 'chat'} );

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );

            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];

            com = getComponent( es, cid );
            // Log.debug('es', com);

            assert.equal( com.name, 'chat' );
        });
        
        it('adds a component with an entity id', async () => {
            let [es] = buildEntitySet();
            let com = createComponent(es, '/component/channel', {'@e':23, name: 'discussion'} );

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );

            let e = getEntity(es, 23);

            assertHasComponents( es, e, ['/component/channel'] );

            com = getEntityComponent( e, getComponentDefId(com) );

            assert.equal( com.name, 'discussion' );

            // Log.debug('es', es);
        });

        it('adds a single entity from two different components', async () => {
            let [es] = buildEntitySet();
            let coms = [
                createComponent(es, '/component/channel', {name: 'discussion'} ),
                createComponent(es, '/component/status', {status:'active'} )
            ];

            es = esAdd( es, coms );
            assert.equal( entitySetSize(es), 1 );
        })

        it('adds a number of components of the same type', () => {
            let e:Entity;
            let coms:Component[];
            let [es] = buildEntitySet();

            // create a number of components
            coms = ['chat', 'dev', 'politics'].map( name => 
                createComponent(es, '/component/channel', {name}));

            es = esAdd( es, coms );

            assert.equal( entitySetSize(es), 3 );

            // Log.debug('stack', es )
        });

        it('overwrites an entity', () => {
            let e:Entity;
            // let es = createEntitySet({});
            let [es,buildEntity] = buildEntitySet();

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            }, 15);

            // Log.debug('e', e );

            es = esAdd( es, e );

            e = getEntity(es,15);
            // Log.debug('e', es );

            assert.ok( isEntity( e ) );

            e = buildEntity( es, ({component}) => {
                component('/component/username', {username: 'alex'});
                component('/component/status', {status: 'inactive'});
                component('/component/channel_member', {channel: 3});
            }, 15);

            // Log.debug('>----');
            es = esAdd( es, e );

            // Log.debug('e', es.entChanges, es.comChanges);

            e = getEntity(es, 15);
            // Log.debug('e', e);

            assertHasComponents( es, e, 
                ['/component/username', '/component/status', '/component/channel_member' ] );

            
            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'general'});
            }, 15);
            es = esAdd( es, e );
            e = getEntity(es, 15);

            assertHasComponents( es, e, ['/component/channel']);
        });

        it('updates an entity', async () => {
            let [es] = await buildEntitySet();

            let com:OrphanComponent = { "@d": "/component/topic", topic: 'chat' };

            es = await esAdd( es, com );

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            // Log.debug('changes', es);

            com = await getComponent(es, cid );
            
            com = {...com, topic:'discussion'};

            // Log.debug('🦄', 'updating here');
            
            es = await esAdd(es, com);

            com = await getComponent(es, cid );

            // Log.debug('final com', com );

            assert.equal( com.topic, 'discussion' );
        });

    });


    describe('Removing', () => {
        it('removes a component', () => {
            let [es] = buildEntitySet();
            let com = createComponent(es, '/component/channel', {name: 'chat'} );

            es = esAdd( es, com );

            assert.equal( entitySetSize(es), 1 );
            
            const cid = getChanges( es.comChanges, ChangeSetOp.Add )[0];
            
            es = removeComponent( es, cid );

            // Log.debug('es', es);
            
            assert.equal( entitySetSize(es), 0 );

        });
        
        it('removes an entity and all its components', () => {
            let e:Entity;
            let [es,buildEntity] = buildEntitySet();

            e = buildEntity( es, ({component}) => {
                component('/component/channel', {name: 'chat'});
                component('/component/status', {status: 'inactive'});
                component('/component/topic', {topic: 'data-structures'});
            }, 15);

            es = esAdd( es, e );

            assert.equal( entitySetSize(es), 1 );
            
            const eid = getChanges( es.entChanges, ChangeSetOp.Add )[0];
            
            assert.exists( eid, 'entity should have been added' );

            es = removeEntity( es, eid );

            assert.equal( entitySetSize(es), 0 );
        });
    });

})

function buildEntitySet(options?): [EntitySetMem, Function] {
    let es = createEntitySet(options);

    const defs = [
        { uri: '/component/channel', properties: ['name'] },
        { uri: '/component/status', properties: ['status'] },
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/username', properties: ['username'] },
        { uri: '/component/channel_member', properties: ['channel_member'] },
    ]

    es = defs.reduce((es, dspec) => {
        [es] = register(es, dspec);
        return es;
    }, es);

    const buildEntity = (es: EntitySet, buildFn: BuildQueryFn, eid: number = 0) => {
        let e = createEntityInstance(eid);
        const component = (uri: string, props: object) => {
            let def = getByUri(es, uri);
            let com = createComponent(es as any, def, props);
            e = addComponentUnsafe(e, getDefId(def), com, def.name );
        };

        buildFn({ component });
        return e;
    }

    return [es, buildEntity];
}

// https://stackoverflow.com/a/29581862
function _getCallerFile() {
    var originalFunc = Error.prepareStackTrace;

    var callerfile;
    try {
        var err = new Error();
        var currentfile;

        Error.prepareStackTrace = function (err, stack) { return stack; };

        // let stack:string[] = err.stack as any;
        let entry = (err.stack as any).shift();
        // console.log('eNtRy', entry.getFunctionName());
        currentfile = entry.getFileName();

        while (err.stack.length) {
            entry = (err.stack as any).shift();
            // console.log('eNtRy', entry.getFunctionName());
            callerfile = entry.getFileName();

            if(currentfile !== callerfile) break;
        }
    } catch (e) {}

    Error.prepareStackTrace = originalFunc; 

    return callerfile;
}