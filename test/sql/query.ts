import { assert } from 'chai';
import Path from 'path';
import Fs from 'fs-extra';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';
import * as Tokenizer from '../../src/query/tokenizer';

import { 
    // EntitySet, 
    EntitySetSQL,
    create as createEntitySet,
    register,
    getByUri,
    getByHash,
    size as entitySetSize,
    add as esAdd, 
    createComponent, 
    // removeComponent, 
    // removeEntity,
    getEntity,
    getComponent,
    // getComponents as esGetComponents,
    // getEntities as esGetEntities,
    getComponentDefs,
    createEntity,
    // clearIDB,
    markComponentAdd,
    // getComponent,
    addComponents,
    // EntitySetMem,
    // ESQuery,
    // compileQueryPart
} from '../../src/entity_set_sql';

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
    onEntity,
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
    onBuildMap,
    onSelect,
    unpackStackValueR
} from '../../src/query/words';
import {
    stackToString,
} from '../../src/query/util';
// import { VL, valueOf } from '../../src/query/insts/value';
import { stringify } from '../../src/util/json';
import { create as createComponentDef, isComponentDef } from '../../src/component_def';
import { isString } from '../../src/util/is';
import {
    Entity, create as createEntityInstance, isEntity,
    addComponent as addComponentToEntity,
    getEntityId
} from '../../src/entity';
import { isComponent, Component, isComponentList } from '../../src/component';
import { esToInsts } from '../util/stack';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { sqlClear } from '../../src/entity_set_sql/sqlite';





const Log = createLog('TestSQLQuery');

const liveDB = {uuid:'test.sqlite', isMemory:false};

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];


describe('Select', () => {

    beforeEach( async () => {
        await sqlClear('test.sqlite');
    })

    it('fetches entities by id', async () => {
        let query = `[ 102 @e ] select`;
        let [stack] = await prep(query, 'todo.ldjson');

        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stack.items );
        let [,result] = pop(stack);

        // the return value is an entity
        assert.equal( unpackStackValue(result), 102 );
        // Log.debug('stack:', unpackStackValue(stack.items[0]).map(e => e.bitField.toValues()) );
    });


    it('fetches entities by did', async () => {
        let query = `[ "/component/completed" !bf @e] select`;
        let [stack] = await prep(query, 'todo.ldjson');

        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', unpackStackValue(stack.items[0]).map(e => e.bitField.toValues()) );
        let [,result] = pop(stack);


        assert.deepEqual( 
            unpackStackValue(result).map(e => getEntityId(e)), 
            [ 100, 101, 102 ] );

        assert.deepEqual( 
            unpackStackValue(result).map(e => e.bitField.toValues()), 
            [ [ 1, 2, 3 ], [ 1, 2 ], [ 1, 2 ] ] );
    });

    it('fetches component attributes', async () => {
        let [stack] = await prep(`[ 
            /component/title !bf
            @c
            text pluck
        ] select`, 'todo.ldjson');

        // ilog(stack.items);
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stack.items );

        let [,result] = pop(stack);
        assert.deepEqual( unpackStackValueR(result), [
            'get out of bed',
            'phone up friend', 
            'turn on the news', 
            'drink some tea', 
            'do some shopping', 
        ])
    })

    it('fetches entity component attribute', async () => {
        let [stack] = await prep(`[ 
            103 @e 
            /component/title !bf
            @c
            text pluck
        ] select`, 'todo.ldjson');

        // ilog(stack.items);
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stack.items );
        let [,result] = pop(stack);
        assert.equal(unpackStackValueR(result), 'drink some tea' );
    })

    it('fetches matching component attribute', async () => {
        let [stack] = await prep(`[ 
            // fetches values for text from all the entities in the es
            /component/title text !ca
            "do some shopping"
            // equals in this context means match, rather than equality
            // its result will be components
            ==
            /component/title !bf
            @c
        ] select`, 'todo.ldjson');
        
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );
        // const util = require('util');
        // console.log( util.inspect( stack.items, {depth:null} ) );

        let [,result] = pop(stack);
        assert.equal( result[0], SType.Array );
        let coms = unpackStackValueR(result);
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
        ] select`, 'todo.ldjson');
        
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );
        
        let [,result] = pop(stack);
        let ents = unpackStackValueR(result);
        // Log.debug('stack:', ents );
        
        assert.deepEqual( ents.map(e => getEntityId(e)), [101, 100] );
    });

    it('uses mulit conditions', async () => {
        // get pawn where colour = black and file = a
        let query = `[
        /component/position file !ca a ==
        /component/position rank !ca 2 ==
        // // /component/colour colour !ca white ==
        // // and
        // /component/piece/pawn !bf
        // // 2 2 =
        and
        // this results in a list of entity ids
        // fetch components
        all
        // /component/piece/pawn !bf @e
        // [/component/position /component/colour] !bf
        @c
        ] select`
        
        let [stack,es] = await prep(query, 'chess.insts');
        // console.log('\n');
        // ilog( stack.items );
    })

    it('or condition', async () => {
        let query = `[
            /component/position file !ca a ==
            /component/position file !ca f ==
            or
            /component/colour colour !ca white ==
            and
            // @c
        ] select`;

        let [stack,es] = await prep(query, 'chess.insts');
        console.log('\n');
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );
        ilog( stack.items );

    })


    async function prep(insts?:string, fixture?:string): Promise<[QueryStack,EntitySetSQL]> {
        let [stack, es] = await loadEntitySetFromFixture(fixture);

        stack = addWords(stack, [
            ['cls', onClear],
            ['select', onSelect, SType.EntitySet, SType.Array],
            ['spread', onArraySpread, SType.Array ],
            ['[', onArrayOpen],
        ]);

        // Log.debug('stack:', stack.items );
        if( insts ){
            [stack] = await pushValues(stack, parse(insts) );
        }
        return [stack, es];
    }
});

async function loadEntitySetFromFixture(name: string): Promise<[QueryStack, EntitySetSQL]> {
    let insts = await loadFixture(name);
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

    let es = createEntitySet({...liveDB, debug:false});
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

function ilog(...args){
    const util = require('util');
    console.log( util.inspect( ...args, {depth:null} ) );
}