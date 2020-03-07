import { assert } from 'chai';

import { ComponentDef, Token as DefT, getDefId } from '../src/component_def';
import { Component, getComponentDefId, toObject as comToObject } from '../src/component';
import { create as createQueryStack, 
    execute as executeQueryStack,
    pushV as pushQueryStack,
    peekV as peekQueryStack,
    findV,
    addInstruction,
    InstDef,
    QueryStack } from '../src/query/stack';
import * as ComponentRegistry from '../src/component_registry';
import { createLog } from '../src/util/log';
import util from 'util';
import { stringify } from '../src/util/json';

import * as InstCDef from '../src/query/insts/component_def';
import * as InstComC from '../src/query/insts/component_create';
import * as InstVal from '../src/query/insts/value';
import * as InstEq from '../src/query/insts/equals';
import * as InstAd from '../src/query/insts/add';
import {VL} from '../src/query/insts/value';
import { Entity, getComponent } from '../src/entity';

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

        let registry = ComponentRegistry.create();
        let stack = buildQueryStack();

        // important that a ComponentRegistry exists on the stack, otherwise
        // the definition command will fail
        stack = pushQueryStack( stack, registry );
        
        // Log.debug('[post stack]', stack ); //stringify( stack, '\t' ) );

        stack = executeQueryStack( stack, insts );

        registry = findV( stack, ComponentRegistry.Type );
        
        // Log.debug('[post stack]', stack.items );

        assert.equal( stack.items.length, 2 );

        const def:ComponentDef = ComponentRegistry.getByUri( registry, '/piece/knight');
        const component:Component = peekQueryStack( stack );


        // Log.debug('component', component, comToObject(component) );

        assert.equal( def.uri, '/piece/knight' );
        assert.equal( getComponentDefId(component), def[DefT] );
        assert.equal( component.file, "g" );

        // convert the stack to instructions - should be the same as the initial
    })

    describe('Entity', () => {

        it('should create from a component', () => {

            let registry = ComponentRegistry.create();
            let stack = buildQueryStack();

            // add the registry to the stack
            stack = pushQueryStack( stack, registry );

            // register the username component
            stack = executeQueryStack( stack, [
                [ '@d', '/component/username', [ 'username' ] ],
            // create a component and add it to the stack
                [ '@c', '/component/username', { '@e':23, 'username': 'alex' } ],
            ]);

            // get the updated component registry
            registry = findV( stack, ComponentRegistry.Type );

            const def = ComponentRegistry.getByUri( registry, '/component/username' );

            // Log.debug('[post stack]', stack.items );
            
            // add the component to a new entity
            stack = executeQueryStack( stack, [
                [ 'AD', '@e' ]
            ]);

            const entity:Entity = peekQueryStack( stack );

            // Log.debug('[result]', entity );

            assert.equal( entity.bitField.count(), 1 );

            const component = getComponent( entity, getDefId(def) );

            assert.equal( component.username, 'alex' );

            // const component = entity.getComponent
            // Log.debug('[post stack]', stack.items );

        })
    })

    describe('EntitySet', () => {

        // it('should add a component with an entity id', () => {

        //     let registry = ComponentRegistry.create();
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
})



function buildQueryStack(){
    const insts:InstDef[] = [InstCDef,InstComC,InstVal,InstEq, InstAd];
    let stack = createQueryStack();
    stack = addInstruction( stack, insts );
    // stack = addInstruction( stack, InstComC );
    // stack = addInstruction( stack, InstVal );
    return stack
}

// async function buildQueryStack(){
//     let stack = createQueryStack();

//     let inst = await import('../src/query/insts/component_def');
//     stack = addInstruction( stack, inst );
    
//     inst = await import('../src/query/insts/component_create');
//     stack = addInstruction( stack, inst );
    

//     return stack;
// }