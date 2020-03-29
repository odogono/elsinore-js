import { assert } from 'chai';

import { ComponentDef, Type as DefT, getDefId } from '../src/component_def';
import { 
    Component, 
    Type as ComponentT,
    getComponentDefId, 
    toObject as comToObject, 
    getComponentEntityId 
} from '../src/component';
import { create as createQueryStack, 
    push as pushQueryStack,
    peekV as peekQueryStack,
    
    pushValues,
    findV,
    QueryStack, 
    StackValue,
    popEntity,
    push} from '../src/query/stack';
    import { Type as EntityT } from '../src/entity';
import {
    BuildQueryParams, 
    buildAndExecute as buildQuery 
} from '../src/query/build';
import { EntitySet, 
        create as createEntitySet,
        size as entitySetSize,
        add as esAdd, 
        Type as EntitySetT,
        createEntity} from '../src/entity_set';
import { 
    ComponentRegistry,
    Type as ComponentRegistryT,
    create as createComponentRegistry,
    getByUri
 } from '../src/component_registry';
import { createLog } from '../src/util/log';
import { Select } from '../src/query/insts/select';


import { Entity, getComponent, getEntityId } from '../src/entity';
import { 
    prepareFixture,
    buildQueryStack, 
    serialiseStack, 
    assertHasComponents,
    assertIncludesComponents,
    serialiseEntitySet,
    serialiseEntity} from './util/stack';
import Path from 'path';
import { loadFixture } from './util/import';
import { VL } from '../src/query/insts/value';
import { Get, Fetch } from '../src/query/insts/stack';
import { Attribute } from '../src/query/insts/attribute';
import { BF } from '../src/query/insts/bitfield';
const Log = createLog('TestQuery');



describe('Query', () => {

    it('should evaluate a boolean expression', () => {
        const insts:any[] = [
            'hello',
                    4 , 6 , '+',
                    10 ,
                '==' ,
                7, 7, '==',
            '==',
        ];
        
        let value:StackValue;
        let stack = buildQueryStack();
        [stack, value] = pushValues( stack, insts );
        
        // Log.debug('stack', stack.items )

        assert.ok( value[1], 'the values are equal' );
    });

    it('operates on objects', () => {
        let value:StackValue;
        let stack = buildQueryStack();

        [stack,value] = pushValues( stack, [
            {},
            1,
            'rank',
            'PT'
        ]);
        
        assert.deepEqual( value[1], {rank: 1} );
        
        
        // add op works providing first element is the object
        [stack,value] = pushValues( stack, [
            'b',
            'file',
            {},
            '+'
        ]);

        
        assert.deepEqual( value[1], {file: 'b'} );
        
        [stack,value] = pushValues( stack, [
            'CLS',
            'rank',
            { name:'knight', rank:5, file:'e' },
            '-'
        ]);
        
        // Log.debug('stack', stack.items )
        
        assert.deepEqual( value[1], {name:'knight', file: 'e'} );

        // [stack,value] = pushValues( stack, [
        //     'rank',
        //     'GT'
        // ]);

    });

    it('defines a list and calls it', () => {
        const insts:any[] = [
            '[', 9, '+', ']',
            10,
            'SW', // swap the last two values
            '@sl', // push list
        ];
        
        let value:StackValue;
        let stack = buildQueryStack();
        [stack, value] = pushValues( stack, insts );
        // Log.debug('stack', stack.items )
        // Log.debug('value', value )
        assert.equal( value[1], 19 );
        
        [stack, value] = pushValues( stack, [
            'cls',
            10,
            ['@sl', [[ VL, 11], '+'] ]
        ] );
        
        assert.equal( value[1], 21 );

    });

    // 
    // IF

    it('defines an instruction', () => {
        let value:StackValue;
        let stack = buildQueryStack();

        // defines an instruction with a list value
        [stack, value] = pushValues( stack, [
            '[', 8, '*', ']',
            'mult8',
            'def',
        ] );

        
        [stack, value] = pushValues( stack, [
            8,
            'mult8'
        ]);
        
        assert.equal( value[1], 64 );
        
        [stack,value] = pushValues( stack, [ [VL,'mult8'], 'gdef'] );

        // Log.debug('stack', stack.items );
    })


    it('should register a component def', async () => {

        // instructions make up a query
        // a query is executed against the query engine
        const insts:StackValue[] = [
            
            [ 'VL', { "properties":[ "rank", "file" ] } ],
            [ 'VL', "/piece/knight" ],
            [ "@d" ],

            [ 'VL', { "rank": 1, "file": "g" } ],
            [ 'VL', "/piece/knight" ],
            [ "@c" ],
        ];

        let value:StackValue;
        let component:Component;
        let registry = createComponentRegistry();
        let stack = buildQueryStack();

        // important that a ComponentRegistry exists on the stack, otherwise
        // the definition command will fail
        [stack,value] = pushQueryStack( stack, [ComponentRegistryT,registry] );
        
        [stack,[,component]] = pushValues( stack, insts );

        // Log.debug('stack', stack.items );

        registry = findV( stack, ComponentRegistryT );
        
        const def:ComponentDef = getByUri( registry, '/piece/knight');
        
        assert.equal( def.uri, '/piece/knight' );
        assert.equal( getComponentDefId(component), def[DefT] );
        assert.equal( component.file, "g" );
    })

    describe('Entity', () => {

        it('should create from a component', () => {

            let registry = createComponentRegistry();
            let stack = buildQueryStack();
            let value:StackValue;

            // add the registry to the stack
            [stack] = pushQueryStack( stack, [ComponentRegistryT,registry] );

            // register the username component
            [stack] = pushValues( stack, [

                'username',
                '/component/username',
                '@d',
                
                // create a component and add it to the stack
                { '@e':23, 'username': 'alex' },
                '/component/username',
                '@c',

                { 'username': 'peter' },
                '/component/username',
                '@c',
            ]);

            // get the updated component registry
            registry = findV( stack, ComponentRegistryT );

            const def = getByUri( registry, '/component/username' );
            let entity:Entity;
            
            // add the component to a new entity
            [stack, [,entity]] = pushQueryStack( stack, [ '@e' ] );
            
            // Log.debug('[result]', stack.items );

            assert.equal( entity.bitField.count(), 1 );

            const component = getComponent( entity, getDefId(def) );

            assert.equal( component.username, 'alex' );
        });

        it('should create from a shortform',() => {
            let registry = createComponentRegistry();
            let stack = buildQueryStack();

            stack = buildQuery( stack, ({component, def, entity, inst, value}:BuildQueryParams) => {
                value( registry );
                def('/component/username', 'username');
                def('/component/isActive', {name: 'isActive', type: 'boolean', default:false});
                // inst(['AL', ComponentRegistry.Code ])
                component('/component/username', {username: 'alex'}),
                component('/component/isActive', {isActive: true}),
                entity()
            });

            const entity:Entity = peekQueryStack( stack );
            assert.equal( entity.bitField.count(), 2 );

            // Log.debug('[post stack]', stack.items );
        })
    })

    
    describe('EntitySet', () => {

        // it('should add a component with an entity id', () => {

        //     let registry = createComponentRegistry();
        //     let stack = buildQueryStack();

        //     // add the registry to the stack
        //     stack = pushQueryStack( stack, registry );

        //     // register the username component
        //     stack = executeQueryStack( stack, [
        //         [ '@d', '/component/username', [ 'username' ] ],
        //     ]);

        //     // create an entityset
        //     let es = createEntitySet();

        //     // add the entityset to the stack
        //     stack = pushQueryStack( stack, es );

        //     // create a component and add it to the stack
        //     stack = executeQueryStack( stack, [
        //         [ '@c', '/component/username', { '@e':23, 'username': 'alex' } ],
        //     ]);

        //     // add the component to the es
        //     stack = executeQueryStack( stack, [
        //         [ 'ADD', '@es' ]
        //     ]);
        // })
    })

    describe('Select', () => {

        // select entities/components 
        //   - which have dids - SEA/ SCA
        //   - which have one of the dids - SEO/SCO
        //   - which do not have any of dids - SEN/SCN
        


        it('selects entities which contain a given def id', async () => {
            let ents;
            let value:StackValue;
            let [stack,registry] = await prepareFixture('todo.ldjson');

            // add entities on stack to an entityset
            [stack] = push( stack, '@es' );
            
            // execute a select. the result will be a new entitylist
            // on the stack
            [stack,value] = pushValues(stack, [ 
                '/component/priority',
                Select.AllEntities
            ]);
            
            // Log.debug('loaded', stack.items[2] );
            
            // // resolve the entity list to entities
            [stack, ents] = popEntity( stack );

            // Log.debug('loaded', ents );
            assert.lengthOf( ents, 2 );

            assertIncludesComponents( registry, ents[0], ['/component/priority'] );
            assertIncludesComponents( registry, ents[1], ['/component/priority'] );

            // // const lines = serialiseStack(stack);

            // // Log.debug('output', lines.map( l => JSON.stringify(l) ));
            // // Log.debug('output', stack );
        });

        it('selects a component which matches the component attribute value', async () => {
            let registry = createComponentRegistry();
            let stack = buildQueryStack();
            let value:StackValue;

            // add the registry to the stack
            [stack] = pushQueryStack( stack, [ComponentRegistryT,registry] );

            [stack] = pushValues(stack, [
                [ VL, { "properties":[ "rank", "file" ] } ],
                [ VL, "/piece/knight" ],
                [ "@d" ],
    
                [ VL, { "rank": 1, "file": "g" } ],
                [ VL, "/piece/knight" ],
                [ '@c' ],
            ]);

            [stack,value] = pushValues( stack, [
                [ Attribute, '/piece/knight#file'],
                Get
            ]);

            assert.equal( value[1], 'g' );

            // Log.debug('stack', stack.items );
        });

        it('selects components which match the component attribute', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson', {addToEntitySet:true});
            let value:StackValue;
            
            // [stack,value] = push( stack, ['AT', '/component/completed#isComplete'] );
            [stack,value] = pushValues( stack, [
                // { '@c':'/component/title#text' }
                { '@c':'/component/title#text' },
                [ 'turn on the news', { '@c':'/component/title#text' }, '=='],
                [Attribute, '/component/title#text'], // return attribute values
                // { '@c':'/component/title' }
                [ '@c', '/component/title'], // return components
                // { '@e':'/component/title' }
                [ "@bf", '/component/title'], // return entities
                // { '@e':100 }
                [ '@e', 100], // fetch entity by id
                { '@e':100, '@c': '/component/title' }, // fetch component from entity 100
                [ '@c', '@e', 100, '@d', '/component/title' ], // fetch component by entity id
                Fetch
            ]);

            // Log.debug( serialiseEntitySet( value[1], registry ) );
            // Log.debug('stack', stack.items );

            assert.deepEqual( value, 
                [ VL, [
                  'do some shopping',
                  'drink some tea',
                  'turn on news',
                  'phone up friend',
                  'get out of bed'
                ] ] );

            // Log.debug('stack', stack.items );
        });

        it.only('indicates whether any of the entities have the given component attribute value', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson', {addToEntitySet:true});
            let value:StackValue;

            // [stack] = push(stack, ['@debug',true] );
            
            [stack,value] = pushValues( stack, [
                '[', 
                'turn on news',
                ['AT', '/component/title#text'],
                '==', ']',
                Select.AllEntities
            ] );

            // [stack] = push(stack, ['@debug',false] );

            Log.debug('stack', stack.items );
            // returns true since the array of values that the AL returns
            // contains the string
            assert.deepEqual(value, [VL,true] );
        });

        it('selects entity by id', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson', {addToEntitySet:true});
            let value:StackValue;

            [stack,value] = pushValues( stack, [
                101,
                Select.Entity
            ]);
            assert.equal( getEntityId( value[1] ), 101 );
            
            
            // matches the previous entity by a component defid
            [stack,value] = pushValues( stack, [
                '/component/title',
                Select.Entity
            ]);

            // Log.debug( serialiseEntity(value[1], findV(stack,ComponentRegistryT) ));
            // assert.equal( getEntityId( value[1] ), 104 );
            assertIncludesComponents( registry, value[1], ['/component/title'] );

            // Log.debug('stack', stack.items)
        });

        it('selects entities which match the component attribute value', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson', {addToEntitySet:true});
            let value:StackValue;

            
            [stack,value] = pushValues( stack, [
                // define a function that gets passed to entity select
                '[', 'turn on news', ['AT', '/component/title#text'], '==', ']',
                Select.AllEntities,
            ] );

            // Log.debug('stack', stack.items)
            Log.debug('value', value)

            // returns true since the array of values that the AL returns
            // contains the string
            // assert.deepEqual(value, [VL,true] );
        });

        it('selects entities which match the component attribute value', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson');

            [stack] = pushValues( stack, [

                '[', 
                true,
                [ 'AT', '/component/completed#isComplete' ],
                '==',
                ']',

                // FN true '/component/completed#isComplete' AT == END
                // [ 'FN', [ true, '/component/completed#isComplete', AT, == ] ]
                // next - test @c '/component/completed#isComplete', AT
                // next - test fn declaration - FN starts a new stack, prevents execution when pushing
                Select.AllEntities,
            ]);

            // Log.debug('stack', stack.items)
        });//*/
        
        it('selects a component which matches the component attribute value', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson');

            [stack] = pushValues( stack, [

                '[', true, [ 'AT', '/component/completed#isComplete' ], '==', ']',

                // optimisation: after the inst runs, cache the required coms

                // Select. compiles all entities
                // fn is evaluated against each entity bf
                // when the AT is reached, the e component is resolved
                // if the entity has the com, the value is extracted

                // FN true '/component/completed#isComplete' AT == END
                // [ 'FN', [ true, '/component/completed#isComplete', AT, == ] ]
                // next - test @c '/component/completed#isComplete', AT
                // next - test fn declaration - FN starts a new stack, prevents execution when pushing
                Select.AllEntities,
            ]);

            // query = [
            //     {:AL, {:VL, "/component/piece/pawn"}},
            //     {
            //       :AND,
            //       # evals all with a file = a
            //       {:==, {:AT, "/component/position#file"}, {:VL, "a"}},
            //       {:==, {:AT, "/component/position#rank"}, {:VL, 2}}
            //     }
            //   ]

            [
                // select entities with /component/piece/pawn where rank = 2 and file = a
                'a', ['AT', '/component/position#file'], '==',
                2, ['AT', '/component/position#rank'], '==',
                'AND',
                [ 'COM', '/component/piece/pawn' ],
                'AND',
                // /component/piece/pawn && (/component/position#rank == 2 && /component/position#file == a)
                // select entities which have /component/piece/pawn == list of entities
                // select entities which have /component/position == list of entities
                // match rank attribute against 2 == list of entities - equals(bf,rank,2)
                // match file attribute against a == list of entities - equals(bf,file,a)

                Select.AllEntities
            ]

            // <expr> <expr> AND
            // <expr> <expr> OR


            // select /component/piece/pawn

            // Log.debug('stack', stack.items)
        });//*/
    })
    //*/        
})

