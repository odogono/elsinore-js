if( process.env.JS_ENV !== 'browser' ){
    require('fake-indexeddb/auto');
    console.log('using fake idb');
}
import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenizeString } from '../../src/query/tokenizer';

import {
    EntitySetIDB,
    clearIDB,
} from '../../src/entity_set_idb';

import { 
    SType, 
    StackValue
} from '../../src/query/types';

import {
    QueryStack,
} from '../../src/query/stack';

import { createStdLibStack } from '../../src/query';
import {
    stackToString, unpackStackValue, unpackStackValueR,
} from '../../src/query/util';
import {
    toValues as bfToValues,
} from '../../src/util/bitfield';
import {
    Entity,
    getEntityId
} from '../../src/entity';
import { fetchComponents } from '../../src/entity_set/query';
import { onPluck } from '../../src/query/words/pluck';
import { onDefine } from '../../src/query/words/define';


const Log = createLog('TestIDBQuery');

const createEntitySet = (options?) => new EntitySetIDB(options);



describe('Query (IDB)', () => {

    beforeEach( async () => {
        await clearIDB();
    })

    it('fetches entities by id', async () => {
        let query = `[ 102 @e ] select`;
        let [stack] = await prep(query, 'todo');

        // ilog(stack.items);
        let result = stack.pop();

        // the return value is an entity
        assert.equal(unpackStackValueR(result), 102);
    });


    it('fetches entities by did', async () => {
        let query = `[ "/component/completed" !bf @e] select`;
        let [stack] = await prep(query, 'todo');
        
        // the result will be a list value of entities
        let result = stack.pop();
        
        assert.deepEqual( 
            unpackStackValueR(result).map(e => getEntityId(e)), 
            [ 100, 101, 102 ] );

        assert.deepEqual( 
            unpackStackValueR(result).map(e => bfToValues(e.bitField) ), 
            [ [ 1, 2, 3 ], [ 1, 2 ], [ 1, 2 ] ] );
    });

    it('fetches component attributes', async () => {
        let [stack] = await prep(`[ 
            /component/title !bf
            @c
            text pluck
        ] select`, 'todo');

        let result = stack.pop();
        assert.deepEqual(unpackStackValueR(result), [
            'get out of bed',
            'phone up friend',
            'turn on the news',
            'drink some tea',
            'do some shopping'
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
        let result = stack.pop();
        assert.equal(unpackStackValueR(result), 'drink some tea');
    });

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
        ] select
        `, 'todo');

        // ilog(stack.items);
        // Log.debug('stack:', stackToString(stack) );
        // Log.debug('stack:', stringify(stack.items,1) );

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
        
        assert.deepEqual( ents.map(e => getEntityId(e)), [100, 101] );
    });

    it('uses multi conditions', async () => {
        // get pawn where colour = black and file = a
        let query = `[
        /component/position file !ca a ==
        /component/position rank !ca 2 ==
        and
        all
        @c
        ] select !e`

        let [stack] = await prep(query, 'chess');

        let e:Entity = stack.popValue();

        assert.equal( e.size, 3);
        assert.equal( e.Colour.colour, 'white' );

    });

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
        +
        `;

        let [stack] = await prep(query, 'chess');
        
        let es = stack.popValue();
        // let es = unpackStackValue(result, SType.EntitySet);

        // Log.debug('es', es);
        assert.equal( await es.size(), 4 );
        // Log.debug('stack:', stringify(stack.items,1) );
        // ilog( es );

    });

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
        [ "/component/channel_member" { "@e":14, channel: ^^$0, client: ^^$0 } ]

        to_str
        `, 'irc');

        assert.equal( stack.popValue(), 
            '["/component/channel_member", {"@e": 14,"channel": 3,"client": 11}]');
    })

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

        // Log.debug( stackToString(stack) );
        let result;
        result = stack.pop();
        result = unpackStackValue(result,SType.List);
        let nicknames = result.map( v => v[1].nickname ).filter(Boolean);
        assert.includeMembers(nicknames, ['koolgrap', 'lauryn', 'missy']);
    })


});


const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];

async function prep(insts?: string, fixture?: string): Promise<[QueryStack, EntitySetIDB]> {
    
    let es: EntitySetIDB;
    let stack = createStdLibStack();

    if (fixture) {
        es = createEntitySet();
        await stack.push([SType.EntitySet, es]);

        let todoInsts = await loadFixture(fixture);
        await stack.pushValues(todoInsts);

        let esValue = stack.find(SType.EntitySet);
        es = esValue ? esValue[1] : undefined;
    }
    if (insts) {
        const words = parse(insts);
        // Log.debug('[parse]', words );
        await stack.pushValues(words);
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
    if( process.env.JS_ENV !== 'browser' ){
        const util = require('util');
        console.log( util.inspect( ...args, {depth:null} ) );
    }
}