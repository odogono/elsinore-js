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


const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];


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
        let data;
        if( name === 'todo' ){
            return todoData;
        } else if( name === 'chess' ){
            return chessData;
        } else if( name === 'irc' ){
            return ircData;
        }
        // import data from `../fixtures/${name}.json`;
        // return parse(data);
    }
}

function ilog(...args){
    const util = require('util');
    console.log( util.inspect( ...args, {depth:null} ) );
}

const todoData = ["%es","assert_type","[","/component/title","[","text","]","]","!d","+","[","/component/completed","[","{","name","isComplete","type","boolean","default",false,"}","]","]","!d","+","[","/component/priority","[","{","name","priority","type","integer","default",0,"}","]","]","!d","+","[","/component/title","{","text","get out of bed","}","]","!c","[","/component/completed","{","isComplete",true,"}","]","!c","[","/component/priority","{","priority",10,"}","]","!c","concat",100,"!e","swap","+","[","/component/title","{","text","phone up friend","}","]","!c","[","/component/completed","{","isComplete",true,"}","]","!c","concat",101,"!e","swap","+","[","/component/title","{","text","turn on the news","}","]","!c","[","/component/completed","{","isComplete",false,"}","]","!c","concat",102,"!e","swap","+","[","/component/title","{","text","drink some tea","}","]","!c","concat",103,"!e","swap","+","[","/component/title","{","text","do some shopping","}","]","!c","[","/component/priority","{","priority",-5,"}","]","!c","concat",104,"!e","swap","+","concat","+"];
const chessData = ["%es","assert_type","[","/component/position","[","{","name","file","type","string","}","{","name","rank","type","integer","}","]","]","!d","+","[","/component/colour","[","{","name","colour","type","string","enum","[","white","black","]","}","]","]","!d","+","[","/component/piece/king","]","!d","+","[","/component/piece/queen","]","!d","+","[","/component/piece/rook","]","!d","+","[","/component/piece/bishop","]","!d","+","[","/component/piece/knight","]","!d","+","[","/component/piece/pawn","]","!d","+","[","/component/appearance","[","{","name","type","type","string","enum","[","king","queen","rook","bishop","knight","pawn","]","}","]","]","!d","+","[","/component/piece/rook","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","a","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/knight","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","b","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/bishop","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","c","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/queen","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","d","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/king","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","e","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/bishop","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","f","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/knight","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","g","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/rook","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","h","rank",1,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","a","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","b","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","c","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","d","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","e","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","f","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","g","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","white","}","]","!c","[","/component/position","{","file","h","rank",2,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/rook","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","a","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/knight","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","b","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/bishop","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","c","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/queen","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","d","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/king","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","e","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/bishop","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","f","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/knight","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","g","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/rook","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","h","rank",8,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","a","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","b","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","c","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","d","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","e","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","f","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","g","rank",7,"}","]","!c","concat",0,"!e","swap","+","[","/component/piece/pawn","]","!c","[","/component/colour","{","colour","black","}","]","!c","[","/component/position","{","file","h","rank",7,"}","]","!c","concat",0,"!e","swap","+","concat",true,"trace","let","+"];
const ircData = ["%es","assert_type","[","/component/nickname","[","{","name","nickname","}","]","]","!d","+","[","/component/username","[","username","]","]","!d","+","[","/component/name","[","{","name","name","type","string","minLength",3,"maxLength",64,"}","]","]","!d","+","[","/component/status","[","status","]","]","!d","+","[","/component/channel","[","name","]","]","!d","+","[","/component/channel_member","[","{","name","channel","type","integer","format","entity","}","{","name","client","type","integer","format","entity","}","]","]","!d","+","[","/component/topic","[","topic","]","]","!d","+","/component/mode/invisible","!d","+","/component/mode/invite_only","!d","+","/component/mode/channel_op","!d","+","/component/mode/moderated","!d","+","/component/mode/private","!d","+","[","/component/mode/limit","[","{","name","limit","type","integer","}","]","]","!d","+","[","/component/channel","{","@e",1,"name","ecs","}","]","!c","[","/component/topic","{","@e",1,"topic","Entity Component Systems","}","]","!c","[","/component/mode/private","{","@e",1,"}","]","!c","[","/component/status","{","@e",1,"status","active","}","]","!c","[","/component/channel","{","@e",2,"name","chat","}","]","!c","[","/component/mode/limit","{","@e",2,"limit",10,"}","]","!c","[","/component/mode/invisible","{","@e",2,"}","]","!c","[","/component/status","{","@e",2,"status","active","}","]","!c","[","/component/channel","{","@e",3,"name","mr-rap","}","]","!c","[","/component/mode/invite_only","{","@e",3,"}","]","!c","[","/component/topic","{","@e",3,"topic","Male Rappers","}","]","!c","[","/component/status","{","@e",3,"status","inactive","}","]","!c","[","/component/channel","{","@e",4,"name","ms-rap","}","]","!c","[","/component/mode/moderated","{","@e",4,"}","]","!c","[","/component/topic","{","@e",4,"topic","Female Rappers","}","]","!c","[","/component/status","{","@e",4,"status","active","}","]","!c","[","/component/username","{","@e",5,"username","kfareed","}","]","!c","[","/component/nickname","{","@e",5,"nickname","qtip","}","]","!c","[","/component/name","{","@e",5,"name","Kamaal Ibn John Fareed","}","]","!c","[","/component/status","{","@e",5,"status","active","}","]","!c","[","/component/username","{","@e",6,"username","mdiamond","}","]","!c","[","/component/nickname","{","@e",6,"nickname","miked","}","]","!c","[","/component/name","{","@e",6,"name","Michael Louis Diamond","}","]","!c","[","/component/status","{","@e",6,"status","active","}","]","!c","[","/component/username","{","@e",7,"username","kelam","}","]","!c","[","/component/nickname","{","@e",7,"nickname","guru","}","]","!c","[","/component/name","{","@e",7,"name","Keith Edward Elam","}","]","!c","[","/component/mode/invisible","{","@e",7,"}","]","!c","[","/component/username","{","@e",8,"username","melliott","}","]","!c","[","/component/nickname","{","@e",8,"nickname","missy","}","]","!c","[","/component/name","{","@e",8,"name","Melissa Arnette Elliott","}","]","!c","[","/component/username","{","@e",9,"username","rshante","}","]","!c","[","/component/nickname","{","@e",9,"nickname","roxanne","}","]","!c","[","/component/name","{","@e",9,"name","Lolita Shanté Gooden","}","]","!c","[","/component/username","{","@e",10,"username","kthornton","}","]","!c","[","/component/nickname","{","@e",10,"nickname","koolkeith","}","]","!c","[","/component/name","{","@e",10,"name","Keith Matthew Thornton","}","]","!c","[","/component/username","{","@e",11,"username","ggrice","}","]","!c","[","/component/nickname","{","@e",11,"nickname","gza","}","]","!c","[","/component/name","{","@e",11,"name","Gary Grice","}","]","!c","[","/component/status","{","@e",11,"status","active","}","]","!c","[","/component/username","{","@e",12,"username","lhill","}","]","!c","[","/component/nickname","{","@e",12,"nickname","lauryn","}","]","!c","[","/component/name","{","@e",12,"name","Lauryn Noelle Hill","}","]","!c","[","/component/status","{","@e",12,"status","active","}","]","!c","[","/component/username","{","@e",13,"username","nwilson","}","]","!c","[","/component/nickname","{","@e",13,"nickname","koolgrap","}","]","!c","[","/component/name","{","@e",13,"name","Nathaniel Thomas Wilson","}","]","!c","[","/component/status","{","@e",13,"status","active","}","]","!c","concat","+","[","/component/channel_member","{","@e",15,"channel",3,"client",5,"username","kfareed","cname","mr-rap","}","]","!c","[","/component/channel_member","{","@e",16,"channel",4,"client",8,"username","melliott","cname","ms-rap","}","]","!c","[","/component/mode/invisible","{","@e",16,"}","]","!c","[","/component/channel_member","{","@e",17,"channel",3,"client",6,"username","mdiamond","cname","mr-rap","}","]","!c","[","/component/channel_member","{","@e",18,"channel",3,"client",7,"username","kelam","cname","mr-rap","}","]","!c","[","/component/mode/invisible","{","@e",18,"}","]","!c","[","/component/channel_member","{","@e",19,"channel",3,"client",10,"username","kthornton","cname","mr-rap","}","]","!c","[","/component/mode/channel_op","{","@e",19,"}","]","!c","[","/component/channel_member","{","@e",20,"channel",3,"client",11,"username","ggrice","cname","mr-rap","}","]","!c","[","/component/channel_member","{","@e",20,"channel",4,"client",9,"username","rshante","cname","ms-rap","}","]","!c","[","/component/mode/channel_op","{","@e",21,"}","]","!c","[","/component/channel_member","{","@e",21,"channel",4,"client",12,"username","lhill","cname","ms-rap","}","]","!c","[","/component/channel_member","{","@e",22,"channel",4,"client",13,"username","koolgrap","cname","mr-rap","}","]","!c","[","/component/channel_member","{","@e",23,"channel",2,"client",13,"username","mdiamond","cname","chat","}","]","!c","[","/component/mode/channel_op","{","@e",23,"}","]","!c","[","/component/channel_member","{","@e",24,"channel",2,"client",5,"username","kfareed","cname","chat","}","]","!c","[","/component/channel_member","{","@e",25,"channel",2,"client",10,"username","kthornton","cname","chat","}","]","!c","[","/component/channel_member","{","@e",26,"channel",2,"client",13,"username","gza","cname","chat","}","]","!c","concat","+"];
