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
    buildAndExecute as buildQuery,
    pushValues,
    findV,
    QueryStack, 
    BuildQueryParams,
    StackValue,
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
import { VL } from '../src/query/insts/value';
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

        assert.ok( value[1], 'the values are equal' );
    });

    it('defines an anonymous function', () => {
        const insts:any[] = [
            // define an anonymous function
            'FN', 9, '+', ';',
            10,
            'SW', // swap the last two values
            // ['VL', [ 9, '+'] ], // could also...
            'CL', // call the function
        ];

        let value:StackValue;
        let stack = buildQueryStack();
        [stack, value] = pushValues( stack, insts );
        // Log.debug('stack', stack.items )
        // Log.debug('value', value )
        assert.equal( value[1], 19 );
    });


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
            [stack] = pushQueryStack( stack, registry, ComponentRegistryT );

            // register the username component
            [stack] = pushValues( stack, [

                [ 'VL', [ 'username' ] ],
                [ 'VL', '/component/username' ],
                [ '@d'],
                
                // create a component and add it to the stack
                [ 'VL', { '@e':23, 'username': 'alex' } ],
                [ 'VL', '/component/username' ],
                [ '@c' ],

                [ 'VL', { 'username': 'peter' } ],
                [ 'VL', '/component/username' ],
                [ '@c' ],
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

            
            // execute a select. the result will be a new entitylist
            // on the stack
            [stack,value] = pushValues(stack, [ 
                [VL, '/component/priority'], 
                [Select.AllEntities]] 
                );
                
            // Log.debug('loaded', stack.items );
            
            // // resolve the entity list to entities
            [stack, ents] = popEntity( stack );

            assert.lengthOf( ents, 2 );

            assertIncludesComponents( registry, ents[0], ['/component/priority'] );
            assertIncludesComponents( registry, ents[1], ['/component/priority'] );

            // // const lines = serialiseStack(stack);

            // // Log.debug('output', lines.map( l => JSON.stringify(l) ));
            // // Log.debug('output', stack );
        });

        
        it('selects entities which match the component attribute value', async () => {
            let ents;
            let [stack,registry] = await prepareFixture('todo.ldjson');

            [stack] = pushValues( stack, [
                true,
                [ 'AT', '/component/completed#isComplete' ],
                '==', 
                // FN true '/component/completed#isComplete' AT == END
                // [ 'FN', [ true, '/component/completed#isComplete', AT, == ] ]
                // next - test @c '/component/completed#isComplete', AT
                // next - test fn declaration - FN starts a new stack, prevents execution when pushing
                [ Select.AllEntities ],
            ])
        });//*/
    })
    //*/        
})

