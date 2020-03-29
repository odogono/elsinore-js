import { assert } from 'chai';
import { 
    buildQueryStack, prepareFixture, loadFixtureDefs, buildEntity,
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
import { isEntitySet, EntitySetMem, size as entitySetSize } from '../../src/entity_set';

const Log = createLog('TestQueryEntitySet');

describe('EntitySet', () => {

    it('creates', async () => {
        let stack = buildQueryStack();
        let value:StackValue;
        
        [stack,value] = pushValues( stack, [
            '!es'
        ]);

        assert.ok( isEntitySet(value[1]) );
    });
    
    it('adds an entity', async () => {
        let [stack,registry] = await loadFixtureDefs('todo.ldjson');
        let e:Entity;
        let es:EntitySetMem;
        let value:StackValue;

        [stack,e] = buildEntity( stack, ({component}) => {
            component('/component/title', {text: 'get out of bed'});
            component('/component/completed', {isComplete: true});
        });

        [stack,[,es]] = pushValues( stack, [
            '!es'
        ]);
        
        // Log.debug('stack', stack.items );
        // Log.debug('stack', es );

        assert.equal( entitySetSize(es), 1 );
    });

});