import { assert } from 'chai';
import { 
    buildQueryStack,
} from '../util/stack';
import { QueryStack, StackValue, push, pushValues, StackOp } from '../../src/query/stack';
import { BF } from '../../src/query/insts/bitfield';
import { Cls, OpenList, CloseList, Swap } from '../../src/query/insts/stack';
import { createLog } from '../../src/util/log';
import { BitField } from 'odgn-bitfield';
import { Add, Sub } from '../../src/query/insts/equals';
import { Type as ComponentRegistryT, 
    ComponentRegistry,
    create as createComponentRegistry 
} from '../../src/component_registry';
import { isComponentDef } from '../../src/component_def';

const Log = createLog('TestQueryComponent');

describe('ComponentDef', () => {

    it('creates', () => {
        let stack = buildQueryStack();
        let value:StackValue;
        
        // /uri - '/component/priority'
        // /property - def_id, name, type, default

        [stack,value] = pushValues( stack, [
            { uri:'/component/priority', 
              properties:[ {"name":"priority", "type":"integer", "default": 0} ] },
            '!d'
        ]);

        assert.equal( value[0], '@d' );
        assert.ok( isComponentDef(value[1]) );
    });

    it('creates from value', () => {
        let stack = buildQueryStack();
        let value:StackValue;
        
        [stack,value] = push( stack, 
            ['!d', { uri:'/component/title', properties:[ 'text' ] } ]
        );

        assert.equal( value[0], '@d' );
        assert.ok( isComponentDef(value[1]) );
    });

    it('adds to registry', () => {
        let op:StackOp;
        let stack = buildQueryStack();
        let value:StackValue;
        let registry:ComponentRegistry;

        registry = createComponentRegistry();
        [stack] = push( stack, [ComponentRegistryT, registry] );
        
        [stack,value] = push( stack, 
            ['!d', { uri:'/component/title', properties:[ 'text' ] } ]
        );

         [stack,value] = pushValues( stack, [
             '/component/title',
             '@' // fetch
         ] );
        
         assert.equal( value[0], '@d' );
         assert.ok( isComponentDef(value[1]) );
    });

});