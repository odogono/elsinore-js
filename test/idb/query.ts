if( process.env.JS_ENV !== 'browser' ){
    require('fake-indexeddb/auto');
    console.log('using fake idb');
}
import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenizeString } from '../../src/query/tokenizer';

import {
    EntitySetIDB,
    create as createEntitySet,
    register,
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
    addComponents,
    clearIDB,
} from '../../src/entity_set_idb';

import {
    create as createStack,
    SType,
    addWords,
    pushValues,
    QueryStack,
    StackValue,
    push, pop,
    find as findValue,

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
    unpackStackValueR,
    onDup,
    fetchComponentDef,
    onPrint,
    onDrop,
    onPluck,
    onFetchArray,
    onUnexpectedError,
    onUnique
} from '../../src/query/words';
import {
    stackToString,
} from '../../src/query/util';
import {
    Entity, create as createEntityInstance, isEntity,
    addComponent as addComponentToEntity,
    getEntityId,
    size as entitySize,
    getComponent as getEntityComponent,
} from '../../src/entity';
import { sqlClear } from '../../src/entity_set_sql/sqlite';
import { fetchComponents } from '../../src/entity_set/query';


const Log = createLog('TestIDBQuery');





describe('Query IDB', () => {

    beforeEach( async () => {
        await clearIDB();
    })

    it('fetches entities by id', async () => {
        let query = `[ 102 @e ] select`;
        let [stack, es] = await prep(query, 'todo');

        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('es:', es );
        let [,result] = pop(stack);

        // the return value is an entity
        assert.equal( unpackStackValue(result), 102 );
        // Log.debug('stack:', unpackStackValue(stack.items[0]).map(e => e.bitField.toValues()) );
    });


    it('fetches entities by did', async () => {
        let query = `[ "/component/completed" !bf @e] select`;
        let [stack] = await prep(query, 'todo');

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
        ] select`, 'todo');

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
        ] select`, 'todo');

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
        ] select`, 'todo');
        
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
        ] select`, 'todo');
        
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );
        
        let [,result] = pop(stack);
        let ents = unpackStackValueR(result);
        // Log.debug('stack:', ents );
        
        assert.deepEqual( ents.map(e => getEntityId(e)), [100, 101] );
    });

    it('uses multi conditions', async () => {
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
        ] select !e`

        let [stack,es] = await prep(query, 'chess');

        let [,result] = pop(stack);
        let e:Entity = unpackStackValue(result, SType.Entity);
        assert.equal( entitySize(e), 3);
        assert.equal( getEntityComponent(e, 2).colour, 'white' );

        // Log.debug( e );

        // Log.debug('wrote to', es.uuid );
    }).timeout(10000);

    it('and/or condition', async () => {
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
        ] select 
        // true dlog let
        +
        `;

        let [stack] = await prep(query, 'chess');
        // console.log('\n');
        // Log.debug('stack:', stackToString(stack) );
        let [,result] = pop(stack);
        let es = unpackStackValue(result, SType.EntitySet);

        assert.equal( await es.esSize(es), 4 );
        // Log.debug('stack:', stringify(stack.items,1) );
        // ilog( es );

    }).timeout(10000);

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
        assert.equal( stackToString(stack), '[/component/channel_member, {@e: 14,channel: (%e 3),client: (%e 11)}]' );
        // ilog( es );
    })


});


const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];

async function prep(insts?: string, fixture?: string): Promise<[QueryStack, EntitySetIDB]> {
    let stack = createStack();
    let es: EntitySetIDB;

    stack = addWords(stack, [
        ['+', onAddComponentToEntity, SType.Entity, SType.Component],
        ['+', onAddComponentToEntity, SType.Entity, SType.Array],
        ['+', onAddToEntitySet, SType.EntitySet, SType.Any],
        // pattern match stack args
        ['+', onAddArray, SType.Array, SType.Any],
        // important that this is after more specific case
        ['+', onAdd, SType.Value, SType.Value],
        ['*', onAdd, SType.Value, SType.Value],
        ['%', onAdd, SType.Value, SType.Value],
        ['==', onAdd, SType.Value, SType.Value],
        ['!=', onAdd, SType.Value, SType.Value],
        ['.', onPrint, SType.Any],
        ['..', onPrint],
        ['@', onFetchArray, SType.Array,SType.Value],

        ['[', onArrayOpen],
        ['{', onMapOpen],
        ['}', onUnexpectedError],
        [']', onUnexpectedError],
        ['to_map', onBuildMap],
        ['drop', onDrop, SType.Any],
        ['swap', onSwap, SType.Any, SType.Any],
        ['map', onMap, SType.Array, SType.Array],
        ['pluck', onPluck, SType.Array, SType.Value],
        ['pluck', onPluck, SType.Array, SType.Array],
        ['unique', onUnique, SType.Array],
        ['filter', onFilter, SType.Array, SType.Array],
        ['reduce', onReduce, SType.Array, SType.Value, SType.Array],
        ['define', onDefine, SType.Any, SType.Value],
        ['let', onDefine, SType.Any, SType.Value],
        ['concat', onConcat],
        ['cls', onClear],
        ['dup', onDup, SType.Any],
        ['over', onDup, SType.Any],
        ['select', onSelect, SType.EntitySet, SType.Array],
        ['spread', onArraySpread, SType.Array],
        ['!d', onComponentDef, SType.Map],
        ['!d', onComponentDef, SType.Array],
        ['!d', onComponentDef, SType.Value],
        ['@d', fetchComponentDef, SType.EntitySet],
        ['@d', fetchComponentDef, SType.EntitySet, SType.Value],
        // ['!bf', buildBitfield, SType.Array],
        // ['!bf', buildBitfield, SType.Value],
        ['!es', onEntitySet, SType.Map],
        ['!c', onComponent, SType.Array],
        ['@c', fetchComponents],
        ['!e', onEntity, SType.Any],
        ['assert_type', onAssertType],
    ]);
    if (fixture) {
        es = createEntitySet();
        [stack] = await push(stack, [SType.EntitySet, es]);

        console.time("loadFixture");
        let insts = await loadFixture(fixture);
        console.timeEnd("loadFixture");
        // Log.debug('pushing insts', fixture, insts);
        console.time("pushValues(fixture)");
        [stack] = await pushValues(stack, insts as any, {debug:true});
        console.timeEnd("pushValues(fixture)");
        let esValue = findValue(stack, SType.EntitySet);
        es = esValue ? esValue[1] : undefined;
    }
    if (insts) {
        console.time("run query")
        const words = parse(insts);
        // Log.debug('[parse]', words );
        [stack] = await pushValues(stack, words);
        console.timeEnd("run query")
    }
    return [stack, es];
}

async function loadFixture(name: string) {
    if( process.env.JS_ENV !== 'browser' ){
        const Path = require('path');
        const Fs = require('fs-extra');
        const path = Path.resolve(__dirname, `../fixtures/${name}.insts`);
        const data = await Fs.readFile(path, 'utf8');
        const parsed = parse(data);
        // Log.debug(parsed);
        // Log.debug(chessData);
        // assert.deepEqual(parsed, chessData);
        return parsed;
    } else 
    {
        return (window as any).testData[name];
    }
}

function ilog(...args){
    const util = require('util');
    console.log( util.inspect( ...args, {depth:null} ) );
}