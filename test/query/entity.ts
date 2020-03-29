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
import { isEntity, getEntityId, Entity } from '../../src/entity';

const Log = createLog('TestQueryComponent');

describe('Entity', () => {

    it('creates', async () => {
        let stack = buildQueryStack();
        let value:StackValue;
        
        [stack,value] = pushValues( stack, [
            '!e'
        ]);

        // assert.equal( value[0], '@d' );
        assert.ok( isEntity(value[1]) );
        // Log.debug('stack', stack.items );
    });

    it('creates with an id', async () => {
        let stack = buildQueryStack();
        let value:StackValue;
        
        [stack,value] = pushValues( stack, [
            ['!e', 14]
        ]);

        assert.equal( getEntityId(value[1]), 14 );
        assert.ok( isEntity(value[1]) );
    });
    
    it.only('adds a component', async () => {
        // let stack = buildQueryStack();
        let [stack] = await prepareFixture('todo.ldjson', {allowOps:['!d']});
        let value:StackValue;
        let e:Entity;
        
        [stack,[,e]] = pushValues( stack, [
            ['!c', { '@c':'/component/title', text: 'turn on the news' }],
            '!e'
        ]);
        
        Log.debug('stack', e );
    })

});