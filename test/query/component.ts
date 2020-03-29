import { assert } from 'chai';
import { 
    buildQueryStack, prepareFixture,
} from '../util/stack';
import { QueryStack, StackValue, push, pushValues, StackOp } from '../../src/query/stack';
import { BF } from '../../src/query/insts/bitfield';
import { Cls, OpenList, CloseList, Swap } from '../../src/query/insts/stack';
import { createLog } from '../../src/util/log';
import { BitField } from 'odgn-bitfield';
import { Add, Sub } from '../../src/query/insts/equals';
import { loadFixture } from '../util/import';
import { VL } from '../../src/query/insts/value';
import { 
    Type as ComponentRegistryT, 
    create as createComponentRegistry,
    ComponentRegistry } from '../../src/component_registry';
import { Component, isComponent } from '../../src/component';

const Log = createLog('TestQueryComponent');

describe('Component/Attribute', () => {

    it('creates', async () => {

        let op:StackOp;
        let com:Component;
        let stack = buildQueryStack();
        let value:StackValue;
        let registry = createComponentRegistry();

        // definition
        [stack] = pushValues( stack, [
            [ComponentRegistryT, registry],
            ['!d', { uri:'/component/title', properties:[ 'text' ] } ]
        ]);

        [stack, [op,com]] = pushValues( stack, [
            ['!c', { '@c':'/component/title', text: 'turn on the news' }]
        ]);

        assert.ok( isComponent(com) );
        assert.equal( com.text, 'turn on the news' );

        // create component
        [stack, [op,com]] = pushValues( stack, [
            { '@c':'/component/title', text: 'drink some tea' },
            '!c'
        ]);

        assert.ok( isComponent(com) );
        assert.equal( com.text, 'drink some tea' );

        [stack, [op,com]] = push( stack,
            ['!c', { '@c':'/component/title', 'text': 'do some shopping' } ]
        );

        // Log.debug('stack', stack.items );

        assert.ok( isComponent(com) );
        assert.equal( com.text, 'do some shopping' );

    });

    it('loads', async () => {

        let stack:QueryStack;// = buildQueryStack();
        let registry:ComponentRegistry;
        // let value:StackValue;

        [stack, registry] = await prepareFixture('todo.ldjson');

        
        // Log.debug('stack', stack.items );
        
    });

});