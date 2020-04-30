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
    onSwap, onArrayOpen, onAddArray, onAdd, onConcat, onMapOpen, onEntity, onEntityFetch, onComponentDef, onComponent, onEntitySet, onAddComponentToEntity,
    onClear,
    onDefine,
    onAddToEntitySet,
    onAssertType,
    unpackStackValue,
    onBuildMap
} from '../../src/query/words';
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
import { register, createComponent } from '../../src/component_registry';
import {
    Entity, create as createEntityInstance, isEntity,
    addComponent as addComponentToEntity
} from '../../src/entity';
import { isComponent, Component, isComponentList } from '../../src/component';
import { stackToString, esToInsts } from '../util/stack';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';




const Log = createLog('TestQuery');

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];

describe('Query', () => {

    it('executes an async word', async () => {
        let stack = createStack();
        let data = parse('100 doubleit');
        const onDoubleIt = async (stack: QueryStack, v: StackValue): AsyncInstResult => {
            [stack, v] = pop(stack);
            let result = sv(v[1] * 2);
            return Promise.resolve([stack, result]);
        }

        stack = addWords(stack, [['doubleit', onDoubleIt]]);

        // let values;
        [stack] = await pushValues(stack, data);

        assert.deepEqual(stack.items[0], sv(200));
    })

    // it('parses', async () => {

    //     const data = parse('1.0.0 version == assert');

    //     let stack = createStack();
    //     stack = addWords( stack, [
    //         ['version', onVersion],
    //         ['==', onEquals],
    //         ['assert', onAssert]
    //     ]);

    //     [stack] = await pushValues( stack, data );

    //     // Log.debug('stack', stack);
    // });

    it('swaps the top two elements of the stack', async () => {
        let data = parse(`1 2 3 4 swap`);

        let stack = createStack();
        stack = addWords(stack, [
            ['swap', onSwap, SType.Any, SType.Any]
        ]);

        [stack] = await pushValues(stack, data);

        // Log.debug('stack', stack.items );

        assert.deepEqual(stack.items, [sv(1), sv(2), sv(4), sv(3)]);

    })

    it('builds arrays', async () => {
        const data = parse(`[ hello, world ]`);

        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
        ]);

        [stack] = await pushValues(stack, data);
        // stack = addWord(stack, ']', onArrayClose );
        // Log.debug('stack', stringify(stack.items) );
    });

    it('adds to an array', async () => {
        const data = parse(`[] hello +`);

        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            // pattern match stack args
            ['+', onAddArray, SType.Array, SType.Any],
            // important that this is after more specific case
            ['+', onAdd, SType.Value, SType.Value],
        ]);

        [stack] = await pushValues(stack, data);
        // Log.debug('stack', stringify(stack.items) );
    })

    it('builds maps', async () => {
        const data = parse(`{ name: alex, age: 45, isActive }`);

        let stack = createStack();
        stack = addWords(stack, [
            ['{', onMapOpen],
        ]);

        [stack] = await pushValues(stack, data);
        // stack = addWord(stack, ']', onArrayClose );
        // Log.debug('stack', stringify(stack.items,1) );

        assert.deepEqual(stack.items, [
            [SType.Map, {
                name: [SType.Value, 'alex'],
                age: [SType.Value, 45],
                isActive: [SType.Value, undefined],
            }]
        ]);
    });

    it('builds a map from an array', async () => {
        const data = parse(`[ name alex age 45 ] to_map`);

        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['to_map', onBuildMap]
        ]);

        [stack] = await pushValues(stack, data);

        let map = unpackStackValue(stack.items[0], SType.Map);

        // Log.debug('stack', map );
        assert.deepEqual(map, { name: 'alex', age: 45 });
    })

    it('defines a word', async () => {
        let data = parse(`1974 year define year`);
        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['+', onAdd, SType.Value, SType.Value],
            ['define', onDefine],
            ['cls', onClear],
        ]);

        [stack] = await pushValues(stack, data);

        assert.deepEqual(stack.items, [[SType.Value, 1974]]);
        // Log.debug('stack', stringify(stack.items) );

        data = parse('cls [100, +] plus1k define');

        // Log.debug('data', stringify(data));

        [stack] = await pushValues(stack, data);

        data = [
            13, 'plus1k'
        ];

        [stack] = await pushValues(stack, data);

        assert.deepEqual(stack.items, [[SType.Value, 113]]);
    });

    it('creates a ComponentDef', async () => {
        let data = parse(`[ /component/title, text ] !d`);
        // let data = parse(`/component/title !d`);
        // Log.debug('data', stringify(data));

        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['+', onAdd, SType.Value, SType.Value],
            ['cls', onClear],
            ['!d', onComponentDef, SType.Array],
            ['!d', onComponentDef, SType.Value],
        ]);

        [stack] = await pushValues(stack, data);
        // Log.debug('stack', stringify(stack.items,1) );

        assert.ok(isComponentDef(stack.items[0][1]));
    })

    it('creates an EntitySet', async () => {
        let data = parse(`{} !es`);
        // Log.debug('data', stringify(data));

        let stack = createStack();
        stack = addWords(stack, [
            ['{', onMapOpen],
            ['+', onAdd, SType.Value, SType.Value],
            ['cls', onClear],
            ['!es', onEntitySet, SType.Map],
        ]);

        [stack] = await pushValues(stack, data);
        // Log.debug('stack', stringify(stack.items,1) );

        assert.ok(isEntitySet(stack.items[0][1]));
    })

    it('adds a def to an EntitySet', async () => {
        let data = parse(`{} !es /component/text !d +`);
        // Log.debug('data', stringify(data));

        let stack = createStack();
        stack = addWords(stack, [
            ['{', onMapOpen],
            ['+', onAdd, SType.Value, SType.Value],
            ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
            ['cls', onClear],
            ['!d', onComponentDef, SType.Value],
            ['!es', onEntitySet, SType.Map],
        ]);

        [stack] = await pushValues(stack, data);
        // Log.debug('stack', stringify(stack.items,1) );
        let es = stack.items[0][1];
        // Log.debug('es', es );

        assert.ok(isEntitySet(es));
    })

    it('creates a component', async () => {
        let data = parse(`[ /component/title { text:introduction } ] !c`);

        let stack = createStack();
        let es = createEntitySet();
        let def;
        [es, def] = register(es, { uri: "/component/title", properties: ["text"] });

        [stack] = await push(stack, [SType.EntitySet, es]);

        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['!c', onComponent, SType.Array],
            ['!d', onComponentDef, SType.Value],
            ['!es', onEntitySet, SType.Map],
        ]);

        [stack] = await pushValues(stack, data);
        // Log.debug('stack', stringify(stack.items,1) );
        // Log.debug('stack', stack.items );

        assert.ok(isComponent(stack.items[1][1]));
    });

    it('adds a component', async () => {
        let query = parse(`[ /component/completed {isComplete: true} ] !c +`)

        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
            ['!c', onComponent, SType.Array],
            ['!d', onComponentDef, SType.Array],
            ['!d', onComponentDef, SType.Value],
            ['!es', onEntitySet, SType.Map],
        ]);

        let setup = parse(`{} !es 
        [/component/completed [{name: isComplete, type:boolean default:false}]] !d
        + 
        `);

        [stack] = await pushValues(stack, setup);

        // Log.debug('stack>>>:', stackToString(stack) );

        [stack] = await pushValues(stack, query);

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
        let setup = parse(`
        {} !es
        [ "/component/title", "text" ] !d
        { "name":"Completed","uri":"/component/completed","properties":[ { "name":"isComplete","type":"boolean" } ] } !d
        concat
        + // add array of defs to es
        `);

        let add = parse(`
        [ /component/title {text: "add defs"} ] !c
        [ /component/completed {isComplete: true} ] !c
        concat
        +
        [ /component/title {text: "add components"} ] !c
        +
        `)

        let stack = createStack();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['concat', onConcat],
            ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
            ['!c', onComponent, SType.Array],
            ['!d', onComponentDef, SType.Any],
            ['!es', onEntitySet, SType.Map],
        ]);

        [stack] = await pushValues(stack, setup);

        [stack] = await pushValues(stack, add);
        // Log.debug('stack>>>:', stackToString(stack) );

        let es: EntitySetMem;
        [, es] = findValue(stack, SType.EntitySet);

        // Log.debug('es:', es );
        assert.equal(entitySetSize(es), 2);

        // Log.debug('stack>>>:', stackToString(stack) );
        // let insts = await esToInsts(es);
        // Log.debug('out', insts );

        // add = parse(insts);

        // [stack] = await pushValues(stack, parse(`cls {} !es`) );
        // [stack] = await pushValues(stack, add );
        // [,es] = findValue( stack, SType.EntitySet );

        // Log.debug('es', es);

        // Log.debug('out', await esToInsts(es) );
    });






    it('creates an entity', async () => {
        let insts = parse(`100 !e`);

        let stack = createStack();
        stack = addWords(stack, [
            ['!e', onEntity, SType.Value]
        ]);

        [stack] = await pushValues(stack, insts);
        // Log.debug('stack', stringify(stack.items,2) );

        assert.ok(isEntity(stack.items[0][1]));
    });

    it('adds a component to an entity', async () => {
        let insts = parse(`
            []
            [ "/component/title", { "text":"get out of bed"} ] !c +
            [ "/component/completed", {"isComplete":true}] !c +
            [ "/component/priority", {"priority":10}] !c +
            0 !e swap +
        `);

        // Log.debug( insts );

        let stack = createStack();
        [stack] = await buildEntitySet(stack);
        stack = addWords(stack, [
            ['swap', onSwap],
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['!e', onEntity],
            ['!c', onComponent, SType.Array],
            ['+', onAddArray, SType.Array, SType.Any],
            ['+', onAddComponentToEntity, SType.Entity, SType.Component],
            ['+', onAddComponentToEntity, SType.Entity, SType.Array],
        ]);

        [stack] = await pushValues(stack, insts);
        // Log.debug('stack', stringify(stack.items,2) );
        let e = unpackStackValue(stack.items[1], SType.Entity);
        // Log.debug( 'e', e );

        assert.ok(isEntity(e));
        assert.lengthOf(e.components, 3);
    });

    it('loads from file', async () => {
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
            ['@e', onEntityFetch, SType.EntitySet, SType.Value],
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

        assert.equal(entitySetSize(es), 5);

        // get entity 102
        // insts = parse(`102 @e`);
        // Log.debug('stack', insts);
        // [stack] = await pushValues(stack, insts);

        // Log.debug('es', unpackStackValue(stack.items[0]));
        // Log.debug('es', unpackStackValue(stack.items[1]));
    });

    describe('Select', () => {

        it('fetches entities by id', async () => {
            let query = parse(`102 @e`);

            let [stack, es] = await loadEntitySetFromFixture('todo.ldjson');

            // Log.debug('stack', stackToString(stack) );
        });

        it('fetches entities with components', async () => {
            let query = parse(`
        [ [ /component/completed ] @e ]
        select
        `)
        })

        it('fetches component attributes', async () => {
            let query = parse(`
        [ /component/title text @ca ]
        select
        `)
        });
        it('fetches component which match the attribute', async () => {
            let query = parse(`
        [ 
            10 limit // sets a value
            // a list of com attributes
            /component/completed isComplete @ca 
            // results in [ [%ca, [true, eid, did]], ... ]
            /component/completed @c
            // results in [ [%c, <com>], ... ]
            /component/completed @e
            // results in [ [%e, <e>], ... ]


            /component/completed isComplete @ca true == 
            // evals to (or throws an error)
            [%ca, did, "isComplete"] true ==
            // the equals fn evaluates against the entityset

            // priority > 0 && isComplete == true
            // evals on entities
             [%ca, did, "isComplete] true == [%ca, did, priority] 0 > &&


             // entity does not have /component/completed and priority < 0
            /component/completed !bf not [%ca, did, priority] 0 < &&
        ]
        select
        `)
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
        ['@e', onEntityFetch, SType.EntitySet, SType.Value],
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

    [, es] = findValue(stack, SType.EntitySet);

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
