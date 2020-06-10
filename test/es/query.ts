import { assert } from 'chai';
import Path from 'path';
import Fs from 'fs-extra';
import { createLog } from '../../src/util/log';
import { tokenizeString } from '../../src/query/tokenizer';
import {
    QueryStack,
} from '../../src/query/stack';
import {
    SType,
    StackValue,
    AsyncInstResult,
    StackError,
} from '../../src/query/types';

import {
    toValues as bfToValues
} from '../../src/util/bitfield';

import { createStdLibStack } from '../../src/query';

import {
    stackToString, unpackStackValueR, unpackStackValue,
} from '../../src/query/util';
import { create as createComponentDef, isComponentDef } from '../../src/component_def';

import { isString } from '../../src/util/is';
import {
    isEntity,
    getEntityId,
    Entity
} from '../../src/entity';
import { isComponent, Component, isComponentList } from '../../src/component';
import { esToInsts } from '../util/stack';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { fetchComponents, buildBitfield } from '../../src/entity_set/query';
import { onPluck } from '../../src/query/words/pluck';
import { onDefine } from '../../src/query/words/define';
import { isEntitySet, EntitySetMem, EntitySet } from '../../src/entity_set';


const Log = createLog('TestQuery');

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];
const createEntitySet = (options?) => new EntitySetMem(options);



describe('Query (Mem)', () => {


    it('executes an async word', async () => {
        let stack = new QueryStack();
        let data = parse('100 doubleit');
        // Log.debug('ok', stack.pop);
        const onDoubleIt = async (stack: QueryStack, v: StackValue): AsyncInstResult => {
            v = stack.pop();
            let result = sv(v[1] * 2);
            return Promise.resolve([result]);
        }

        stack = stack.addWords([['doubleit', onDoubleIt]]);

        // let values;
        await stack.pushValues(data);

        assert.deepEqual(stack.items[0], sv(200));
    })

    it('swaps the top two elements of the stack', async () => {
        let [stack] = await prep(`1 2 3 4 swap`);

        assert.deepEqual(stack.items, [sv(1), sv(2), sv(4), sv(3)]);
    })

    describe('Reference Words', () => {
        
        it('references an earlier word', async () => {
            let [stack] = await prep(`planet world hello $1`);
            assert.equal( stack.toString(), '"planet" "hello" "world"');
        });
        
        it('works within a list', async () => {
            let [stack] = await prep(`planet world [ hello $0 ]`);
            assert.equal(stack.toString(), '"planet" "world" ["hello"]');
        });
        
        it('references above a list', async () => {
            let [stack] = await prep(`planet [ world [ hello ^^$0 ]]`);
            assert.equal(stack.toString(), '["world", ["hello", "planet"]]');

            // [stack] = await prep(`planet world [ hello ^$1 ]`);
            // assert.equal(stack.toString(), 'world [hello, planet]');
        });
        
        it('not evaluated the first time', async () => {
            // the * char means that the ref will not be evaled until spread is called
            let [stack] = await prep(`planet world [ hello *$1 ] spread`);
            assert.equal(stack.toString(), '"planet" "hello" "world"');
        });
        
        it('accesses words in parent', async () => {
            let [stack] = await prep(`
            active status let
            [ status is ^status ]
            `);
            assert.equal(stack.toString(), '["status", "is", "active"]');
        })
    })

    describe('Defining words', () => {
        it('defines a word', async () => {
            let [stack] = await prep(`1974 year define year`);

            assert.deepEqual(stack.items, [[SType.Value, 1974]]);
            // Log.debug('stack:', stackToString(stack));
        });

        it('defines a word that is a function', async () => {
            let [stack] = await prep(`cls [100, +] plus1k define`);

            let data = parse(` 13 plus1k`);

            await stack.pushValues(data);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), 113);
        });

        it('pushes values with define', async () => {
            let [stack] = await prep(`[ 2 3 + ] fn define fn`);
            assert.equal(stack.toString(), '5');
        })
        it('pushes single value with let', async () => {
            let [stack] = await prep(`[ 2 3 + ] fn let fn`);
            assert.equal(stack.toString(), '[2, 3, +]');
        })
    })

    describe('Maps and Lists', () => {


        it('builds lists', async () => {
            let [stack] = await prep(`[ hello, world ]`);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), ['hello', 'world']);
        });

        it('adds to an list', async () => {
            let [stack] = await prep(`[] hello +`);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), ['hello']);
        })

        it('push', async () => {
            let [stack] = await prep(`[] hello push`);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), ['hello']);
        });

        it('pop', async () => {
            let [stack] = await prep(`[ hello world ] pop`);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), 'world');
        });

        it('pop empty', async () => {
            try {
                await prep(`[] pop`);
            } catch (err) {
                assert.instanceOf(err, StackError);
                assert.equal(err.message, 'stack underflow: ()' );
            }
        })

        it('builds maps', async () => {
            let [stack] = await prep(`{ name: alex, age: 45, isActive }`);

            // stack = addWord(stack, ']', onArrayClose );
            // Log.debug('stack', stringify(stack.items,1) );
            let result = stack.pop();

            assert.deepEqual(result,
                [SType.Map, {
                    name: [SType.Value, 'alex'],
                    age: [SType.Value, 45],
                    isActive: [SType.Value, undefined],
                }]);
        });

        it('builds a map from an array', async () => {
            let [stack] = await prep(`[ name alex age 45 ] to_map`);

            let result = stack.pop();
            let map = unpackStackValueR(result, SType.Map);
            assert.deepEqual(map, { name: 'alex', age: 45 });
        })

        it('handles an invalid array', async () => {
            // let [stack] = ;
            try {
                await prep(`[ 1st 2nd 3rd { name: 4th ]`)
            } catch (err) {
                assert.instanceOf(err, StackError);
                // Log.debug('umm', assert.instanceOf(err, StackError));
            }

            // assert.rejects(stack);
            // assert.throws( , Error, `unexpected word ']': ("name" "4th")`);
            // ilog(stack.items);
        })

        it('references words outside of array', async () => {
            let [stack] = await prep(`
            1977 1974
            [ 1900 ^$0 ^$0 2018 ]
            `);
            // ilog(stack.items);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), [1900, 1974, 1977, 2018]);
        })

    });




    it('creates a ComponentDef', async () => {
        let [stack] = await prep(`[ /component/title, [text] ] !d`);

        // Log.debug( stack );
        
        let result = stack.pop();
        
        // Log.debug( result );

        assert.ok(isComponentDef(unpackStackValueR(result)));
    })

    describe('EntitySet', () => {

        it('creates an EntitySet', async () => {
            let [stack] = await prep(`{} !es`);

            let result = stack.pop();
            assert.ok(isEntitySet(unpackStackValueR(result)));
        })

        it('adds a def to an EntitySet', async () => {
            let [stack] = await prep(`{} !es /component/text !d +`);

            let result = stack.pop();
            assert.ok(isEntitySet(unpackStackValueR(result)));
        })

        it('creates a component', async () => {
            let query = `[ /component/title { text:introduction } ] !c`;
            let [stack] = await prep(`{} !es`);

            let result = stack.pop();
            // Log.debug('stack', stack.items );
            let es = unpackStackValueR(result);
            let def;
            def = await es.register({ uri: "/component/title", properties: ["text"] });
            await stack.push([SType.EntitySet, es]);

            await stack.pushValues(parse(query));
            // Log.debug('stack', stringify(stack.items,1) );

            assert.ok(isComponent(stack.items[1][1]));
        });

        it('adds a component', async () => {

            let [stack] = await prep(`{} !es 
        [/component/completed [{name: isComplete, type:boolean default:false}]] !d
        + 
        [ /component/completed {isComplete: true} ] !c +
        `);

            // Log.debug('stack:', stackToString(stack) );

            let es: EntitySetMem;
            [, es] = stack.find(SType.EntitySet);

            // Log.debug('es:', es );

            assert.equal(await es.size(), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            let com = await es.getComponent(cid);

            assert.equal(com.isComplete, true);
        });

        it('adds components', async () => {
            let [stack] = await prep(`
        // setup
        {} !es
        [ "/component/title", ["text"] ] !d
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

            let result = stack.pop();
            let es = unpackStackValueR(result);
            assert.ok(isEntitySet(es));

            // Log.debug('es:', es );
            assert.equal(await es.size(), 2);
        });


        it('duplicates an entityset', async () => {
            let [stack] = await prep(`
            {} !es 
            [ "/component/title", ["text"] ] !d +
            [ /component/title {text:first} ] !c +
            dup`);

            // ilog(stack.items);
            let result = stack.pop();
            let es = unpackStackValueR(result);
            assert.ok(isEntitySet(es));
            assert.equal(await es.size(), 1);

            result = stack.pop();
            es = unpackStackValueR(result);
            assert.ok(isEntitySet(es));
            assert.equal(await es.size(), 1);
        });

        it('retrieves component defs', async () => {
            let [stack] = await prep(`
            @d // get defs - doesnt pop the es
            swap drop // lose the es
            // {} !es // new es
            // swap // move defs to top
            // true dlog define
            // + // add defs to es
            `, 'todo');

            // ilog(stack.words);
            let defs = stack.pop();
            // ilog( unpackStackValueR(defs) );
            assert.deepEqual(unpackStackValueR(defs), [
                ['/component/title', [{ name: 'text' }]],
                ['/component/completed',
                    [{ name: 'isComplete', type: 'boolean', default: false }]],
                ['/component/priority',
                    [{ name: 'priority', type: 'integer', default: 0 }]]
            ])
        })

    });



    it('creates an entity', async () => {
        let [stack] = await prep(`100 !e`);
        let result = stack.pop();
        assert.ok(isEntity(unpackStackValueR(result)));
    });

    it('adds a component to an entity', async () => {
        let query = `
            []
            [ "/component/title", { "text":"get out of bed"} ] !c +
            [ "/component/completed", {"isComplete":true}] !c +
            [ "/component/priority", {"priority":10}] !c +
            0 !e swap +
        `;
        let [stack] = await prep();
        [stack] = await buildEntitySet(stack);
        await stack.pushValues(parse(query));
        // Log.debug( stack );

        let result = stack.pop();
        let e = unpackStackValueR(result);

        assert.ok(isEntity(e));
        assert.lengthOf(e.components, 3);
    });

    it('loads from file', async () => {
        // let insts = await loadFixture('todo');
        let insts = await loadFixture('chess');
        // Log.debug(insts);
        let [stack] = await prep();


        let es = createEntitySet();

        await stack.push([SType.EntitySet, es]);

        await stack.pushValues(insts);


        es = unpackStackValueR(stack.items[0]);

        // Log.debug('es', es);
        assert.equal(await es.size(), 32);

        // get entity 102
        // insts = parse(`102 @e`);
        // Log.debug('stack', insts);
        // [stack] = await pushValues(stack, insts);

        // Log.debug('es', unpackStackValueR(stack.items[1]));
    });

    describe('Map', () => {


        it('maps values', async () => {
            let [stack] = await prep(`[1 2 3 4] [10 *] map`);

            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), [10, 20, 30, 40]);
        })

        it('plucks values', async () => {
            let [stack] = await prep(`
            {text: hello} text pluck
            `);

            // ilog(stack.items);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), ['hello']);
        });

        it('plucks value from multiple maps', async () => {
            let [stack] = await prep(`[
                {text: hello} {text: world}
            ] text pluck`);

            // ilog(stack.items);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), ['hello', 'world']);
        });

        it('plucks multiple values', async () => {
            let [stack] = await prep(`[
                {@e: 3, text: hello, priority: 2}
                {@e: 4, text: world, priority: -1, status: active}
            ] [@e, text, status] pluck`);

            // ilog(stack.items);
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), [
                { '@e': 3, text: 'hello' },
                { '@e': 4, text: 'world', status: 'active' }
            ]);
        });

        it('reduces values', async () => {
            let [stack] = await prep(`[1 2 3 4] 0 [+] reduce`);
            let result = stack.pop();
            assert.equal(unpackStackValueR(result), 10);
        })

        it('filters values', async () => {
            // applies an is-even filter
            let [stack] = await prep(`[1 2 3 4] [ 2 swap % 0 == ] filter`);
            // Log.debug('stack:', stackToString(stack) );
            let result = stack.pop();
            assert.deepEqual(unpackStackValueR(result), [2, 4]);
        })

    })

    describe('Select', () => {

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
        });

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

            // ilog(stack.items);

            let result = stack.pop();
            let ents = unpackStackValueR(result);
            
            assert.deepEqual(ents.map(e => getEntityId(e)), [100, 101]);
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

            // Log.debug( stackToString(stack) );
            // ilog(stack.items);
            // let result = stack.popValue();
            // Log.debug( result );
            assert.equal( stack.popValue(), 
                '["/component/channel_member", {"@e": 14,"channel": 3,"client": 11}]');
            // ilog( es );
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
            
            let result:any[] = unpackStackValue( stack.pop(), SType.List);
            let nicknames = result.map(v => v[1].nickname).filter(Boolean);
            assert.includeMembers(nicknames, ['koolgrap', 'lauryn', 'missy']);
        })

    });

});



async function buildEntitySet(stack:QueryStack, options?): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet(options);

    const defs = [
        { uri: "/component/title", properties: ["text"] },
        { uri: "/component/completed", properties: [{ "name": "isComplete", "type": "boolean", "default": false }] },
        { uri: "/component/priority", properties: [{ "name": "priority", "type": "integer", "default": 0 }] },
    ];

    await defs.reduce( (p,def) => p.then( () => es.register(def)), Promise.resolve() );

    await stack.push([SType.EntitySet, es]);

    return [stack, es];
}



async function prep(insts?: string, fixture?: string): Promise<[QueryStack, EntitySet]> {
    
    let es: EntitySet;
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
    if (process.env.JS_ENV !== 'browser') {
        const Path = require('path');
        const Fs = require('fs-extra');
        const path = Path.resolve(__dirname, `../fixtures/${name}.insts`);
        const data = await Fs.readFile(path, 'utf8');
        const parsed = parse(data);
        // Log.debug(parsed);
        // Log.debug(chessData);
        // assert.deepEqual(parsed, chessData);
        return parsed;
    } else {
        return (window as any).testData[name];
    }
}


function ilog(...args) {
    if( process.env.JS_ENV !== 'browser' ){
        const util = require('util');
        console.log(util.inspect(...args, { depth: null }));
    }
}