import { assert } from 'chai';
import Path from 'path';
import Fs from 'fs-extra';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';

import {
    EntitySetSQL
} from '../../src/entity_set_sql';

import {
    addWords,
    push,
    find as findValue,
    QueryStack,
} from '../../src/query/stack';

import { 
    SType, 
    StackValue, 
    InstResult, AsyncInstResult, 
} from '../../src/query/types';

import {
    onSwap, onListOpen,
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
    onAddToEntitySet,
    onAssertType,
    onBuildMap,
    onSelect,
    onDup,
    fetchComponentDef,
    onPrint,
    onDrop,
    onFetchArray,
    onUnexpectedError,
    onUnique
} from '../../src/query/words';
import {
    stackToString, unpackStackValue, unpackStackValueR,
} from '../../src/query/util';
import {
    toValues as bfToValues,
} from '../../src/util/bitfield';
import {
    getEntityId
} from '../../src/entity';
import { sqlClear } from '../../src/entity_set_sql/sqlite';
import { fetchComponents } from '../../src/entity_set/query';
import { onPluck } from '../../src/query/words/pluck';
import { onDefine } from '../../src/query/words/define';





const Log = createLog('TestSQLQuery');

const liveDB = { uuid: 'test.sqlite', isMemory: false };
const testDB = { uuid: 'TEST-1', isMemory: true };

const createEntitySet = () => new EntitySetSQL(testDB);

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];


describe('Query (SQL)', () => {

    beforeEach(async () => {
        await sqlClear('test.sqlite');
    })

    it('fetches entities by id', async () => {
        let query = `[ 102 @e ] select`;
        let [stack] = await prep(query, 'todo');
        let result = stack.pop();

        // the return value is an entity
        assert.equal(unpackStackValue(result), 102);
    });


    it('fetches entities by did', async () => {
        let query = `[ "/component/completed" !bf @e] select`;
        let [stack] = await prep(query, 'todo');
        let result = stack.pop();


        assert.deepEqual(
            unpackStackValue(result).map(e => getEntityId(e)),
            [100, 101, 102]);

        assert.deepEqual(
            unpackStackValue(result).map(e => bfToValues(e.bitField)),
            [[1, 2, 3], [1, 2], [1, 2]]);
    });

    it('fetches component attributes', async () => {
        let [stack] = await prep(`[ 
            /component/title !bf
            @c
            text pluck
        ] select`, 'todo');

        // ilog(stack.items);
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stack.items );

        let result = stack.pop();
        assert.deepEqual(unpackStackValueR(result), [
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
        ] select`, 'todo');

        // ilog(stack.items);
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stack.items );
        let result = stack.pop();
        assert.equal(unpackStackValueR(result), 'drink some tea');
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
        ] select`, 'todo');

        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );
        // const util = require('util');
        // console.log( util.inspect( stack.items, {depth:null} ) );

        let result = stack.pop();
        assert.equal(result[0], SType.List);
        let coms = unpackStackValueR(result);
        assert.equal(coms[0].text, "do some shopping");
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
        ] select`, 'todo');

        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );

        let result = stack.pop();
        let ents = unpackStackValueR(result);
        // Log.debug('stack:', ents );

        assert.deepEqual(ents.map(e => getEntityId(e)), [100, 101]);
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

        let [stack, es] = await prep(query, 'chess');
        // console.log('\n');
        // ilog( stack.items );
    })

    it('or condition', async () => {
        let query = `
        // create an es with the defs
        dup @d {} !es swap + swap
        [
            /component/position file !ca a ==
            /component/position file !ca f ==
            or
            /component/colour colour !ca white ==
            and
            @c
        ] select +`;

        let [stack] = await prep(query, 'chess');
        let result = stack.pop();
        let es = unpackStackValue(result, SType.EntitySet);

        assert.equal(await es.size(), 4);
    })

    it('super select', async () => {
        let [stack, es] = await prep(`
        // define a variable holding the es so we don't have to
        // keep swapping things aroung
        es let

        [
            uid let
            ^es [ /component/username username !ca  *^uid == ] select
            0 @
        ] selectUserId define
        
        [
            ch_name let
            // adding * to a ^ stops it from being eval'd the 1st time, but not the 2nd
            ^es [ /component/channel name !ca *^ch_name == ] select
            0 @
        ] selectChannelId define
        
        ggrice selectUserId 
        
        "mr-rap" selectChannelId
        
        // compose a new component which belongs to the 'mr-rap' channel
        [ /component/channel_member { "@e":14, channel: ^^$0, client: ^^$0 } ]

        `, 'irc');

        // Log.debug( stackToString(stack) );
        // ilog(stack.items);
        assert.equal(stackToString(stack), '[/component/channel_member, {@e: 14,channel: (%e 3),client: (%e 11)}]');
        // ilog( es );
    });

    it('multi fn query', async () => {
        let [stack, es] = await prep(`
        es let
        [
            client_id let
            ^es [
                /component/channel_member client !ca *^client_id ==
                /component/channel_member !bf
                @c
            ] select

            // pick the channel attributes
            channel pluck 
        ] selectChannelsFromMember define

        [
            channel_ids let
            ^es [
                /component/channel_member channel !ca *^channel_ids ==
                /component/channel_member !bf
                @c
            ] select

            // select client attr, and make sure there are no duplicates
            client pluck unique 
            
            // make sure this list of clients doesnt include the client_id
            [ ^client_id != ] filter

        ] selectChannelMemberComs define

        [
            eids let
            ^es [ *^eids [/component/name /component/nickname] !bf @c ] select
        ] selectNames define

        [
            // 1. select channel ids which 'client_id' belongs to
            selectChannelsFromMember

            // 2. select channel members which belong to channel_ids
            selectChannelMemberComs
         
            // 3. using the channel_member client ids select the entities
            selectNames

        ] selectChannelMembersByClientId define

        // selects the nicknames of other entities who share
        // the same channel as 9 (roxanne)
        9 selectChannelMembersByClientId

        `, 'irc');

        let result;
        result = stack.pop();
        result = unpackStackValue(result, SType.List);
        let nicknames = result.map(v => v[1].nickname).filter(Boolean);
        assert.includeMembers(nicknames, ['koolgrap', 'lauryn', 'missy']);
    })


});


async function prep(insts?: string, fixture?: string): Promise<[QueryStack, EntitySetSQL]> {
    let stack = new QueryStack();
    let es: EntitySetSQL;

    stack = addWords(stack, [
        ['+', onAddComponentToEntity, SType.Entity, SType.Component],
        ['+', onAddComponentToEntity, SType.Entity, SType.List],
        ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
        // pattern match stack args
        ['+', onAddArray, SType.List, SType.Any],
        // important that this is after more specific case
        ['+', onAdd, SType.Value, SType.Value],
        ['*', onAdd, SType.Value, SType.Value],
        ['%', onAdd, SType.Value, SType.Value],
        ['==', onAdd, SType.Value, SType.Value],
        ['!=', onAdd, SType.Value, SType.Value],
        ['.', onPrint, SType.Any],
        ['..', onPrint],
        ['@', onFetchArray, SType.List, SType.Value],

        ['[', onListOpen],
        ['{', onMapOpen],
        ['}', onUnexpectedError],
        [']', onUnexpectedError],
        ['to_map', onBuildMap],
        ['drop', onDrop, SType.Any],
        ['swap', onSwap, SType.Any, SType.Any],
        ['map', onMap, SType.List, SType.List],
        ['pluck', onPluck, SType.List, SType.Value],
        ['pluck', onPluck, SType.List, SType.List],
        ['unique', onUnique, SType.List],
        ['filter', onFilter, SType.List, SType.List],
        ['reduce', onReduce, SType.List, SType.Value, SType.List],
        ['define', onDefine, SType.Any, SType.Value],
        ['let', onDefine, SType.Any, SType.Value],
        ['concat', onConcat],
        ['cls', onClear],
        ['dup', onDup, SType.Any],
        ['over', onDup, SType.Any],
        ['select', onSelect, SType.EntitySet, SType.List],
        ['spread', onArraySpread, SType.List],
        ['!d', onComponentDef, SType.Map],
        ['!d', onComponentDef, SType.List],
        ['!d', onComponentDef, SType.Value],
        ['@d', fetchComponentDef, SType.EntitySet],
        ['@d', fetchComponentDef, SType.EntitySet, SType.Value],
        // ['!bf', buildBitfield, SType.List],
        // ['!bf', buildBitfield, SType.Value],
        ['!es', onEntitySet, SType.Map],
        ['!c', onComponent, SType.List],
        ['@c', fetchComponents],
        ['!e', onEntity, SType.Value],
        ['assert_type', onAssertType],
    ]);
    if (fixture) {
        es = createEntitySet();
        [stack] = await push(stack, [SType.EntitySet, es]);

        let todoInsts = await loadFixture(fixture);
        await stack.pushValues(todoInsts);

        let esValue = findValue(stack, SType.EntitySet);
        es = esValue ? esValue[1] : undefined;
    }
    if (insts) {
        const words = parse(insts);
        // Log.debug('[parse]', words );
        await stack.pushValues(words);
    }
    return [stack, es];
}

// async function loadEntitySetFromFixture(name: string): Promise<[QueryStack, EntitySetSQL]> {
//     let insts = await loadFixture(name);
//     // Log.debug(insts);
//     let stack = createStack();
//     stack = addWords(stack, [
//         ['assert_type', onAssertType],
//         ['swap', onSwap],
//         ['dup', onDup],
//         ['over', onDup],
//         ['concat', onConcat],
//         ['[', onArrayOpen],
//         ['{', onMapOpen],
//         ['!e', onEntity],
//         // ['@e', onEntityFetch, SType.Value],
//         ['!d', onComponentDef, SType.List],
//         ['@d', fetchComponentDef, SType.EntitySet],
//         ['!c', onComponent, SType.List],
//         ['!es', onEntitySet, SType.Map],
//         ['+', onAddArray, SType.List, SType.Any],
//         ['+', onAddComponentToEntity, SType.Entity, SType.Any],
//         ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
//     ]);

//     let es = createEntitySet({...liveDB, debug:false});
//     [stack] = await push(stack, [SType.EntitySet, es]);

//     [stack] = await pushValues(stack, insts);

//     let esValue = findValue(stack, SType.EntitySet);
//     es = esValue ? esValue[1]: undefined;

//     return [stack, es];
// }

async function loadFixture(name: string) {
    const Path = require('path');
    const Fs = require('fs-extra');
    const path = Path.resolve(__dirname, `../fixtures/${name}.insts`);
    const data = await Fs.readFile(path, 'utf8');
    const parsed = parse(data);
    // Log.debug(parsed);
    // Log.debug(chessData);
    // assert.deepEqual(parsed, chessData);
    return parsed;
}

function ilog(...args) {
    const util = require('util');
    console.log(util.inspect(...args, { depth: null }));
}