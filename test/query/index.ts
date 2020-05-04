import { assert } from 'chai';
import Path from 'path';
import Fs from 'fs-extra';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';
import * as Tokenizer from '../../src/query/tokenizer';
import {
    create as createStack,
    SType,
    addWords,
    pushValues,
    QueryStack,
    StackValue,
    InstResult, AsyncInstResult,
    push, pop, peek, pushRaw,
    findV,
    find as findValue,
    popOfType,
    assertStackValueType,

} from '../../src/query/stack';

import {
    onSwap, onArrayOpen, 
    onAddArray, 
    onArraySpread,
    onAdd, onConcat, onMapOpen, 
    onEntity, onSelect, 
    onArgError,
    onComponentDef, onComponent, 
    onEntitySet, onAddComponentToEntity,
    onMap,
    onReduce,
    onFilter,
    onClear,
    onValue,
    onDefine,
    onAddToEntitySet,
    onAssertType,
    unpackStackValue,
    onBuildMap
} from '../../src/query/words';
import {
    stackToString,
} from '../../src/query/util';
// import { VL, valueOf } from '../../src/query/insts/value';
import { stringify } from '../../src/util/json';
import { create as createComponentDef, isComponentDef } from '../../src/component_def';
import {
    create as createEntitySet,
    add as addToES,
    isEntitySet,
    createEntity,
    EntitySet,
    size as entitySetSize,
    EntitySetMem
} from '../../src/entity_set';
import { isString } from '../../src/util/is';
import { register, createComponent } from '../../src/entity_set/registry';
import {
    Entity, create as createEntityInstance, isEntity,
    addComponent as addComponentToEntity,
    getEntityId
} from '../../src/entity';
import { isComponent, Component, isComponentList } from '../../src/component';
import { esToInsts } from '../util/stack';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';





const Log = createLog('TestQuery');

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];

describe('Query', () => {

    async function prep( insts?:string ): Promise<QueryStack> {
        let stack = createStack();
        stack = addWords(stack, [
            ['+', onAddComponentToEntity, SType.Entity, SType.Component],
            ['+', onAddComponentToEntity, SType.Entity, SType.Array],
            ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
            // pattern match stack args
            ['+', onAddArray, SType.Array, SType.Any],
            // important that this is after more specific case
            ['+', onAdd, SType.Value, SType.Value],
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['to_map', onBuildMap],
            ['swap', onSwap, SType.Any, SType.Any],
            ['define', onDefine],
            ['concat', onConcat],
            ['cls', onClear],
            ['!d', onComponentDef, SType.Map],
            ['!d', onComponentDef, SType.Array],
            ['!d', onComponentDef, SType.Value],
            ['!es', onEntitySet, SType.Map],
            ['!c', onComponent, SType.Array],
            ['!e', onEntity, SType.Value]
        ]);
        if( insts ){
            [stack] = await pushValues(stack, parse(insts) );
        }
        return stack;
    }


    it('executes an async word', async () => {
        let stack = createStack();
        let data = parse('100 doubleit');
        const onDoubleIt = async (stack: QueryStack, v: StackValue): AsyncInstResult<QueryStack> => {
            [stack, v] = pop(stack);
            let result = sv(v[1] * 2);
            return Promise.resolve([stack, result]);
        }

        stack = addWords(stack, [['doubleit', onDoubleIt]]);

        // let values;
        [stack] = await pushValues(stack, data);

        assert.deepEqual(stack.items[0], sv(200));
    })

    it('swaps the top two elements of the stack', async () => {
        let stack = await prep(`1 2 3 4 swap`);

        assert.deepEqual(stack.items, [sv(1), sv(2), sv(4), sv(3)]);
    })

    it('builds arrays', async () => {
        let stack = await prep(`[ hello, world ]`);
        let [,result] = pop(stack);
        assert.deepEqual( unpackStackValue(result), [ 'hello', 'world' ]);
    });

    it('adds to an array', async () => {
        let stack = await prep(`[] hello +`);
        let [,result] = pop(stack);
        assert.deepEqual( unpackStackValue(result), [ 'hello' ]);
    })

    it('builds maps', async () => {
        let stack = await prep(`{ name: alex, age: 45, isActive }`);

        // stack = addWord(stack, ']', onArrayClose );
        // Log.debug('stack', stringify(stack.items,1) );
        let [,result] = pop(stack);

        assert.deepEqual(result,
            [SType.Map, {
                name: [SType.Value, 'alex'],
                age: [SType.Value, 45],
                isActive: [SType.Value, undefined],
            }]);
    });

    it('builds a map from an array', async () => {
        let stack = await prep(`[ name alex age 45 ] to_map`);

        let [,result] = pop(stack);
        let map = unpackStackValue(result, SType.Map);
        assert.deepEqual(map, { name: 'alex', age: 45 });
    })

    it('defines a word', async () => {
        let stack = await prep(`1974 year define year`);
        
        assert.deepEqual(stack.items, [[SType.Value, 1974]]);
        // Log.debug('stack:', stackToString(stack));
    });
        
    it('defines a word that is a function', async () => {
        let stack = await prep(`cls [100, +] plus1k define`);

        let data = parse(` 13 plus1k`);

        [stack] = await pushValues(stack, data);
        let [,result] = pop(stack);
        assert.deepEqual( unpackStackValue(result) , 113);
    });

    it('creates a ComponentDef', async () => {
        let stack = await prep(`[ /component/title, text ] !d`);

        let [,result] = pop(stack);
        assert.ok(isComponentDef( unpackStackValue(result) ));
    })

    it('creates an EntitySet', async () => {
        let stack = await prep(`{} !es`);
        
        let [,result] = pop(stack);
        assert.ok(isEntitySet( unpackStackValue(result) ));
    })

    it('adds a def to an EntitySet', async () => {
        let stack = await prep(`{} !es /component/text !d +`);
        
        let [,result] = pop(stack);
        assert.ok(isEntitySet( unpackStackValue(result) ));
    })

    it('creates a component', async () => {
        let query = `[ /component/title { text:introduction } ] !c`;
        let stack = await prep(`{} !es`);
        
        let result;
        [stack,result] = pop(stack);
        // Log.debug('stack', stack.items );
        let es = unpackStackValue(result);
        let def;
        [es, def] = register(es, { uri: "/component/title", properties: ["text"] });
        [stack] = await push(stack, [SType.EntitySet, es]);

        [stack] = await pushValues(stack, parse(query));
        // Log.debug('stack', stringify(stack.items,1) );

        assert.ok(isComponent(stack.items[1][1]));
    });

    it('adds a component', async () => {
        
        let stack = await prep(`{} !es 
        [/component/completed [{name: isComplete, type:boolean default:false}]] !d
        + 
        [ /component/completed {isComplete: true} ] !c +
        `);

        // Log.debug('stack:', stackToString(stack) );

        let es: EntitySetMem;
        [, es] = findValue(stack, SType.EntitySet);

        // Log.debug('es:', es );

        assert.equal(entitySetSize(es), 1);

        const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

        let com = es.esGetComponent(es, cid);

        assert.equal(com.isComplete, true);
    });

    it('adds components', async () => {
        let stack = await prep(`
        // setup
        {} !es
        [ "/component/title", "text" ] !d
        { "name":"Completed","uri":"/component/completed","properties":[ { "name":"isComplete","type":"boolean" } ] } !d
        concat
        + // add array of defs to es
        
        // query
        [ /component/title {text: "add defs"} ] !c
        [ /component/completed {isComplete: true} ] !c
        concat
        +
        [ /component/title {text: "add components"} ] !c
        +
        `)

        // Log.debug('stack>>>:', stack.items );
        // Log.debug('stack>>>:', stackToString(stack) );

        let [,result] = pop(stack);
        let es = unpackStackValue(result);
        assert.ok(isEntitySet( es ));

        // Log.debug('es:', es );
        assert.equal(entitySetSize(es), 2);
    });






    it('creates an entity', async () => {
        let stack = await prep(`100 !e`);
        let [,result] = pop(stack);
        assert.ok(isEntity(unpackStackValue(result)));
    });

    it('adds a component to an entity', async () => {
        let query = `
            []
            [ "/component/title", { "text":"get out of bed"} ] !c +
            [ "/component/completed", {"isComplete":true}] !c +
            [ "/component/priority", {"priority":10}] !c +
            0 !e swap +
        `;
        let stack = await prep();
        [stack] = await buildEntitySet(stack);
        [stack] = await pushValues(stack, parse(query));

        let [,result] = pop(stack);
        let e = unpackStackValue(result);

        assert.ok(isEntity(e));
        assert.lengthOf(e.components, 3);
    });

    it('loads from file', async () => {
        // let insts = await loadFixture('todo.ldjson');
        let insts = await loadFixture('chess.insts');
        // Log.debug(insts);
        let stack = createStack();
        stack = addWords(stack, [
            ['assert_type', onAssertType],
            ['swap', onSwap],
            ['concat', onConcat],
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['!e', onEntity],
            ['!d', onComponentDef, SType.Map],
            ['!d', onComponentDef, SType.Array],
            ['!c', onComponent, SType.Array],
            ['!es', onEntitySet, SType.Map],
            ['+', onAddArray, SType.Array, SType.Any],
            ['+', onAddComponentToEntity, SType.Entity, SType.Any],
            ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
        ]);

        let es = createEntitySet();
        [stack] = await push(stack, [SType.EntitySet, es]);

        [stack] = await pushValues(stack, insts);


        es = unpackStackValue(stack.items[0]);

        // Log.debug('es', es);
        assert.equal(entitySetSize(es), 32);

        // get entity 102
        // insts = parse(`102 @e`);
        // Log.debug('stack', insts);
        // [stack] = await pushValues(stack, insts);

        // Log.debug('es', unpackStackValue(stack.items[1]));
    });

    describe('Map', () => {

        async function prep( insts?:string ): Promise<QueryStack> {
            let stack = createStack();
            stack = addWords(stack, [
                ['*', onAdd, SType.Value, SType.Value],
                ['+', onAdd, SType.Value, SType.Value],
                ['%', onAdd, SType.Value, SType.Value],
                ['==', onAdd, SType.Value, SType.Value],
                ['swap', onSwap, SType.Any, SType.Any],
                ['map', onMap, SType.Array, SType.Array],
                ['filter', onFilter, SType.Array, SType.Array],
                ['reduce', onReduce, SType.Array, SType.Value, SType.Array],
                ['[', onArrayOpen],
            ]);
            if( insts ){
                [stack] = await pushValues(stack, parse(insts) );
            }
            return stack;
        }

        it('applies to each value in the array', async () => {
            let stack = await prep(`[1 2 3 4] [10 *] map`);
            
            let [,result] = pop(stack);
            assert.deepEqual( unpackStackValue(result), [10,20,30,40] );
        })

        it('reduces values', async () => {
            let stack = await prep(`[1 2 3 4] 0 [+] reduce`);
            let [,result] = pop(stack);
            assert.equal( unpackStackValue(result), 10 );
        })

        it('filters values', async () => {
            // applies an is-even filter
            let stack = await prep(`[1 2 3 4] [ 2 swap % 0 == ] filter`);
            Log.debug('stack:', stackToString(stack) );
            let [,result] = pop(stack);
            assert.deepEqual( unpackStackValue(result), [2,4] );
        })

    })

    describe('Select', () => {

        async function prep(insts?:string): Promise<[QueryStack,EntitySet]> {
            let [stack, es] = await loadEntitySetFromFixture('todo.ldjson');

            stack = addWords(stack, [
                ['cls', onClear],
                ['select', onSelect, SType.EntitySet, SType.Array],
                ['spread', onArraySpread, SType.Array ],
                ['[', onArrayOpen],
            ]);

            if( insts ){
                [stack] = await pushValues(stack, parse(insts) );
            }

            return [stack, es];
        }
        
        it('fetches entities by id', async () => {
            let query = `[ 102 @e ] select`;
            let [stack] = await prep(query);

            // Log.debug('stack:', stackToString(stack) );
            // Log.debug('stack:', stack.items );
            let [,result] = pop(stack);

            // the return value is an entity
            assert.equal( unpackStackValue(result), 102 );
            // Log.debug('stack:', unpackStackValue(stack.items[0]).map(e => e.bitField.toValues()) );
        });

        it('fetches entities by did', async () => {
            let query = `[ "/component/title" !bf @e] select`;
            let [stack] = await prep(query);

            // Log.debug('stack:', stackToString(stack) );
            // Log.debug('stack:', unpackStackValue(stack.items[0]).map(e => e.bitField.toValues()) );
            let [,result] = pop(stack);
            assert.deepEqual( 
                unpackStackValue(result).map(e => e.bitField.toValues()), 
                [ [ 1, 3 ], [ 1 ], [ 1, 2 ], [ 1, 2 ], [ 1, 2, 3 ]] );
        });


        it('fetches component attributes', async () => {
            let [stack] = await prep(`[ 
                /component/title text !ca 
                @cv
            ] select`);

            // Log.debug('stack:', stackToString(stack) );
            // Log.debug('stack:', stack.items );

            let [,result] = pop(stack);
            assert.deepEqual( unpackStackValue(result), [
                'do some shopping', 
                'drink some tea', 
                'turn on the news', 
                'phone up friend', 
                'get out of bed'
            ])
        })

        it('fetches entity component attribute', async () => {
            let [stack] = await prep(`[ 
                103 @e 
                /component/title text !ca 
                @cv 
            ] select`);

            // Log.debug('stack:', stackToString(stack) );
            // Log.debug('stack:', stack.items );
            let [,result] = pop(stack);
            assert.equal(unpackStackValue(result), 'drink some tea' );
        })

        it('fetches matching component attribute', async () => {
            let [stack] = await prep(`[ 
                // fetches values for text from all the entities in the es
                /component/title text !ca
                "do some shopping"
                // equals in this context means match, rather than equality
                // its result will be components
                ==
            ] select`);
            
            // Log.debug('stack:', stackToString(stack) );
            // Log.debug('stack:', stringify(stack.items,1) );

            let [,result] = pop(stack);
            assert.equal( result[0], SType.Array );
            let coms = unpackStackValue(result);
            assert.equal( coms[0].text, "do some shopping" );
        });

        it('fetches entities matching component attribute', async () => {
            let [stack] = await prep(`[ 
                // fetches values for text from all the entities in the es
                /component/completed isComplete !ca
                true
                // equals in this context means match, rather than equality
                // its result will be components
                ==
                @e
            ] select`);
            
            // Log.debug('stack:', stackToString(stack) );
            // Log.debug('stack:', stringify(stack.items,1) );
            
            let [,result] = pop(stack);
            let ents = unpackStackValue(result);
            // Log.debug('stack:', ents );
            
            assert.deepEqual( ents.map(e => getEntityId(e)), [101,100] );
        });


    });

});


async function loadEntitySetFromFixture(name: string): Promise<[QueryStack, EntitySet]> {
    let insts = await loadFixture('todo.ldjson');
    // Log.debug(insts);
    let stack = createStack();
    stack = addWords(stack, [
        ['assert_type', onAssertType],
        ['swap', onSwap],
        ['concat', onConcat],
        ['[', onArrayOpen],
        ['{', onMapOpen],
        ['!e', onEntity],
        // ['@e', onEntityFetch, SType.Value],
        ['!d', onComponentDef, SType.Array],
        ['!c', onComponent, SType.Array],
        ['!es', onEntitySet, SType.Map],
        ['+', onAddArray, SType.Array, SType.Any],
        ['+', onAddComponentToEntity, SType.Entity, SType.Any],
        ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
    ]);

    let es = createEntitySet();
    [stack] = await push(stack, [SType.EntitySet, es]);

    [stack] = await pushValues(stack, insts);

    let esValue = findValue(stack, SType.EntitySet);
    es = esValue ? esValue[1]: undefined;

    return [stack, es];
}

async function loadFixture(name: string) {
    const path = Path.resolve(__dirname, `../fixtures/${name}`);
    const data = await Fs.readFile(path, 'utf8');
    return parse(data);
}

export async function buildEntitySet(stack: QueryStack): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet();
    let def;
    [es, def] = register(es,
        { uri: "/component/title", properties: ["text"] });
    [es, def] = register(es,
        { uri: "/component/completed", properties: [{ "name": "isComplete", "type": "boolean", "default": false }] });
    [es, def] = register(es,
        { uri: "/component/priority", properties: [{ "name": "priority", "type": "integer", "default": 0 }] });
    [stack] = await push(stack, [SType.EntitySet, es]);
    return [stack, es];
}
