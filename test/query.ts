import { assert } from 'chai';

import { ComponentDef, Token as DefT } from '../src/component_def';
import { Component, getComponentDefId, toObject as comToObject } from '../src/component';
import { create as createQueryStack, 
    execute as executeQueryStack,
    pushV as pushQueryStack,
    peekV as peekQueryStack,
    findV,
    addInstruction,
    QueryStack } from '../src/query/stack';
import * as ComponentRegistry from '../src/component_registry';
import { createLog } from '../src/util/log';
import util from 'util';
import { stringify } from '../src/util/json';

const Log = createLog('TestQuery');



describe('Query', () => {

    it('should register a component def', async () => {

        // instructions make up a query
        // a query is executed against the query engine
        const insts = [
            [ "@d", "/piece/knight", { "properties":[ "rank", "file" ] } ],
            [ "@c", "/piece/knight", { "rank": 1, "file": "g" } ]
        ];

        let registry = ComponentRegistry.create();
        let stack = await buildQueryStack();

        // important that a ComponentRegistry exists on the stack, otherwise
        // the definition command will fail
        stack = pushQueryStack( stack, registry );
        
        // Log.debug('[post stack]', stack ); //stringify( stack, '\t' ) );

        stack = executeQueryStack( stack, insts );

        registry = findV( stack, ComponentRegistry.Type );
        
        // Log.debug('[post stack]', registry );

        const def:ComponentDef = ComponentRegistry.getByUri( registry, '/piece/knight');
        const component:Component = peekQueryStack( stack );

        // Log.debug('def id', component, comToObject(component) );

        assert.equal( def.uri, '/piece/knight' );
        assert.equal( getComponentDefId(component), def[DefT] );
        assert.equal( component.file, "g" );

        // convert the stack to instructions - should be the same as the initial
    })
})



async function buildQueryStack(){
    let stack = createQueryStack();

    let inst = await import('../src/query/insts/component_def');
    stack = addInstruction( stack, inst );
    
    inst = await import('../src/query/insts/component_create');
    stack = addInstruction( stack, inst );
    

    return stack;
}