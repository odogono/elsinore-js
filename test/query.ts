import { assert } from 'chai';

import { ComponentDef, Token as DefT, getDefId } from '../src/component_def';
import { Component, getComponentDefId, toObject as comToObject, getComponentEntityId } from '../src/component';
import { create as createQueryStack, 
    execute as executeQueryStack,
    pushV as pushQueryStack,
    peekV as peekQueryStack,
    buildAndExecute as buildQuery,
    findV,
    addInstruction,
    InstDef,
    BuildQueryFn,
    BuildQueryParams,
    QueryStack, 
    popEntity} from '../src/query/stack';
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
import util from 'util';
import { stringify } from '../src/util/json';
import { Select } from '../src/query/insts/select';


import { Entity, getComponent } from '../src/entity';
import { 
    prepareFixture,
    buildQueryStack, 
    serialiseStack, 
    assertHasComponents,
    assertIncludesComponents} from './util/stack';
import Path from 'path';
import { loadFixture } from './util/import';
const Log = createLog('TestQuery');



describe('Query', () => {

    it('should evaluate a boolean expression', () => {
        const insts = [
            [ '==', ['VL', 10], ['VL', 10] ]
        ];

        let stack = buildQueryStack();

        stack = executeQueryStack( stack, insts );

        assert.ok( peekQueryStack(stack), 'the values are equal' );

        stack = executeQueryStack( stack, [ [ '==', ['VL', 10], ['VL', 12] ] ] );

        assert.notOk( peekQueryStack(stack), 'the values are not equal' );
    });


    it('should register a component def', async () => {

        // instructions make up a query
        // a query is executed against the query engine
        const insts = [
            [ "@d", "/piece/knight", { "properties":[ "rank", "file" ] } ],
            [ "@c", "/piece/knight", { "rank": 1, "file": "g" } ]
        ];

        let registry = createComponentRegistry();
        let stack = buildQueryStack();

        // important that a ComponentRegistry exists on the stack, otherwise
        // the definition command will fail
        stack = pushQueryStack( stack, registry );
        
        // Log.debug('[post stack]', stack ); //stringify( stack, '\t' ) );

        stack = executeQueryStack( stack, insts );

        registry = findV( stack, ComponentRegistryT );
        
        // Log.debug('[post stack]', stack.items );

        assert.equal( stack.items.length, 2 );

        const def:ComponentDef = getByUri( registry, '/piece/knight');
        const component:Component = peekQueryStack( stack );


        // Log.debug('component', component, comToObject(component) );

        assert.equal( def.uri, '/piece/knight' );
        assert.equal( getComponentDefId(component), def[DefT] );
        assert.equal( component.file, "g" );

        // convert the stack to instructions - should be the same as the initial
    })

    describe('Entity', () => {

        it('should create from a component', () => {

            let registry = createComponentRegistry();
            let stack = buildQueryStack();

            // add the registry to the stack
            stack = pushQueryStack( stack, registry );

            // register the username component
            stack = executeQueryStack( stack, [
                [ '@d', '/component/username', [ 'username' ] ],
            // create a component and add it to the stack
                [ '@c', '/component/username', { '@e':23, 'username': 'alex' } ],
                [ '@c', '/component/username', { 'username': 'peter' } ],
            ]);

            // get the updated component registry
            registry = findV( stack, ComponentRegistryT );

            const def = getByUri( registry, '/component/username' );

            
            // add the component to a new entity
            stack = executeQueryStack( stack, [
                [ '@e' ]
            ]);
            
            // Log.debug('[post stack]', stack.items );

            const entity:Entity = peekQueryStack( stack );

            // Log.debug('[result]', entity );

            assert.equal( entity.bitField.count(), 1 );

            const component = getComponent( entity, getDefId(def) );

            assert.equal( component.username, 'alex' );

            // const component = entity.getComponent
            // Log.debug('[post stack]', stack.items );
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
            let [stack,registry] = await prepareFixture('todo.ldjson');

            // Log.debug('loaded', stack );

            // execute a select. the result will be a new entitylist
            // on the stack
            stack = executeQueryStack( stack, [
                [ Select.AllEntities, '/component/priority' ]
            ]);

            // resolve the entity list to entities
            [stack, ents] = popEntity( stack );

            // assert.lengthOf( ents, 2 );

            assertIncludesComponents( registry, ents[0], ['/component/priority'] );
            assertIncludesComponents( registry, ents[1], ['/component/priority'] );

            // const lines = serialiseStack(stack);

            // Log.debug('output', lines.map( l => JSON.stringify(l) ));
            // Log.debug('output', stack );
        })
        
    })
})

