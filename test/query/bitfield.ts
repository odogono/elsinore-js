import { assert } from 'chai';
import { 
    buildQueryStack,
} from '../util/stack';
import { QueryStack, StackValue, push, pushValues, StackOp } from '../../src/query/stack';
import { BF, BFs } from '../../src/query/insts/bitfield';
import { Cls, OpenList, CloseList, Swap, ToString } from '../../src/query/insts/stack';
import { createLog } from '../../src/util/log';
import { BitField } from 'odgn-bitfield';
import { Add, Sub } from '../../src/query/insts/equals';
import { Type as ComponentRegistryT, 
    ComponentRegistry,
    create as createComponentRegistry 
} from '../../src/component_registry';

const Log = createLog('TestQuery');

describe('Bitfield Query', () => {

    // it('creates a bitfield', () => {
    //     let stack = buildQueryStack();
    //     let value:StackValue;
    //     [stack,value] = push( stack, [BF] );
    //     assert.ok( BitField.isBitField(value[1]) );
    // })

    it('creates a bitfield with a value', () => {

        let op:StackOp;
        let bf:BitField;
        let stack = buildQueryStack();
        let value:StackValue;
        
        [stack,[op,bf]] = pushValues( stack, [
            2,
            '!bf'
         ]);

        // Log.debug('bf', bf.toValues(), bf.get(2) );

        assert.ok( bf.get(2) );

        [stack,[op,bf]] = pushValues( stack, [
            Cls,
            OpenList, 3, 29, 168, CloseList,
            '!bf'
        ]);

        // Log.debug('stack', stack.items);

        assert.ok( bf.get(3) );
        assert.ok( bf.get(29) );
        assert.ok( bf.get(168) );
    });

    it.only('resolves component def ids', () => {
        let stack = buildQueryStack();
        let reg = createComponentRegistry();
        [stack] = push(stack, [ComponentRegistryT, reg]);
        [stack] = push( stack, ['@bf', '/component/title']);

        Log.debug('stack', stack.items );
    });

    it('adds and removes', () => {
        let op:StackOp;
        let bf:BitField;
        let value:StackValue;
        let stack = buildQueryStack();
        let initialStack:QueryStack;

        [initialStack] = push( stack, BF );
        
        // Log.debug('stack', stack.items);
        [stack, [op,bf]] = pushValues( initialStack, [
            OpenList, 14, 5, CloseList,
            Swap,
            Add
        ]);


        [stack] = push( stack, ToString );
        // Log.debug('stack', stack.items);

        assert.ok( bf.get(14) );
        assert.ok( bf.get(5) );

        [stack, [op,bf]] = pushValues( initialStack, [
            14,
            Swap,
            Sub
        ]);

        assert.ok( bf.get(5) );

        // Log.debug('bf', bf.toValues() );

        // [stack] = push( stack, 'TOS' );
        // Log.debug('stack', stack.items);
    })
});