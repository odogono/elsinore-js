import { assert } from 'chai';
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
import { isComponentDef } from '../../src/component_def';

import {
    isEntity,
    getEntityId,
    Entity
} from '../../src/entity';
import { isComponent } from '../../src/component';
import { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
import { isEntitySet, EntitySetMem, EntitySet, EntitySetOptions } from '../../src/entity_set';


const Log = createLog('TestQuery');

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];
const createEntitySet = (options?) => new EntitySetMem(undefined, options);



describe('Query (Mem)', () => {


    it('executes an async word', async () => {
        let stack = new QueryStack();
        let data = parse('100 doubleit');
        // Log.debug('ok', stack.pop);
        const onDoubleIt = async (stack: QueryStack, v: StackValue): AsyncInstResult => {
            v = stack.pop();
            let result = sv(v[1] * 2);
            return Promise.resolve(result);
        }

        stack = stack.addWords([['doubleit', onDoubleIt]]);

        // let values;
        await stack.pushValues(data);

        assert.deepEqual(stack.items[0], sv(200));
    })

    it('swaps the top two elements of the stack', async () => {
        let [stack] = await prep(`1 2 3 4 swap`);

        assert.equal( stack.popValue(), 3 );
        assert.equal( stack.popValue(), 4 );
        assert.equal( stack.popValue(), 2 );
        assert.equal( stack.popValue(), 1 );
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
        it('a defined word evaluates', async () => {
            let [stack] = await prep(`[ 2 3 + ] fn define fn`);
            assert.equal(stack.popValue(), '5');
        });

        it('a let word pushes', async () => {
            let [stack] = await prep(`[ 2 3 + ] fn let fn`);
            assert.deepEqual(stack.popValue(), [2, 3, '+']);
        });
    })

    describe('Maps and Lists', () => {


        it('builds lists', async () => {
            let [stack] = await prep(`[ hello, world ]`);
            let result = stack.popValue();
            assert.deepEqual(result, ['hello', 'world']);
        });

        it('adds to an list', async () => {
            let [stack] = await prep(`[] hello +`);
            let result = stack.popValue();
            assert.deepEqual(result, ['hello']);
        })

        it('push', async () => {
            let [stack] = await prep(`[] hello push`);
            let result = stack.popValue();
            assert.deepEqual(result, ['hello']);
        });

        it('pop', async () => {
            let [stack] = await prep(`[ hello world ] pop`);
            let result = stack.popValue();
            assert.deepEqual(result, 'world');
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

            let result = stack.popValue();
            assert.deepEqual(result, { name: 'alex', age: 45 });
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
            let result = stack.popValue();
            assert.deepEqual(result, [1900, 1974, 1977, 2018]);
        })

    });


    describe('Map/Reduce/Filter', () => {
        it('maps values', async () => {
            let [stack] = await prep(`[1 2 3 4] [10 *] map`);

            let result = stack.popValue();
            assert.deepEqual(result, [10, 20, 30, 40]);
        })

        it('reduces values', async () => {
            let [stack] = await prep(`[1 2 3 4] 0 [+] reduce`);
            let result = stack.popValue();
            assert.equal(result, 10);
        })

        it('filters values', async () => {
            // applies an is-even filter
            let [stack] = await prep(`[1 2 3 4] [ 2 swap % 0 == ] filter`);
            // Log.debug('stack:', stackToString(stack) );
            let result = stack.popValue();
            assert.deepEqual(result, [2, 4]);
        })
    });

    describe('Pluck', () => {
        it('plucks values', async () => {
            let [stack] = await prep(`
            {text: hello} /text pluck
            `);

            // ilog(stack.items);
            let result = stack.popValue();
            assert.deepEqual(result, ['hello']);
        });

        it('plucks value from multiple maps', async () => {
            let [stack] = await prep(`[
                {text: hello} {text: world}
            ] /text pluck`);

            // ilog(stack.items);
            let result = stack.popValue();
            assert.deepEqual(result, ['hello', 'world']);
        });

        it('plucks multiple values', async () => {
            let [stack] = await prep(`[
                {@e: 3, text: hello, priority: 2}
                {@e: 4, text: world, priority: -1, status: active}
            ] [/@e, /text, /status] pluck`);

            // ilog(stack.items);
            let result = stack.popValue();
            assert.deepEqual(result, [
                { '@e': 3, text: 'hello' },
                { '@e': 4, text: 'world', status: 'active' }
            ]);
        });
    });

    describe('Regex', () => {
        it('matches', async () => {
            let [stack] = await prep(`
            "foo is bar" ~r/foo/ ==
            `);

            let result = stack.popValue();
            assert.equal( result, true );
        });

    });


    it('creates a ComponentDef', async () => {
        let [stack] = await prep(`[ /component/title, [text] ] !d`);

        // Log.debug( stack );
        
        let result = stack.popValue();
        
        // Log.debug( result );

        assert.ok(isComponentDef(result));
    })

    describe('EntitySet', () => {

        // it('creates an EntitySet', async () => {
        //     let [stack] = await prep(`{} !es`);

        //     let result = stack.popValue();
        //     assert.ok(isEntitySet(result));
        // })

        it('adds a def to an EntitySet', async () => {
            let es = createEntitySet();
            
            let stack = await es.query(`/component/text !d +`);
            // let [stack] = await prep(`{} !es /component/text !d +`);

            let result = stack.popValue();
            assert.ok(isEntitySet(result));
        });


        it('creates a component', async () => {
            let es = createEntitySet();
            await es.register({ uri: "/component/title", properties: ["text"] });
            let stack = await es.query(`[ /component/title { text:introduction } ] !c`);
            
            let result = stack.popValue();
            assert.ok(isComponent(result));
        });

        it('adds a component', async () => {
            let es = createEntitySet();
            let stack = await es.query(`
        [/component/completed [{name: isComplete, type:boolean default:false}]] !d
        + 
        [ /component/completed {isComplete: true} ] !c +
        `);

            assert.equal(await es.size(), 1);

            const cid = getChanges(es.comChanges, ChangeSetOp.Add)[0];

            let com = await es.getComponent(cid);

            assert.equal(com.isComplete, true);
        });

        it('adds components', async () => {
            let es = createEntitySet();
            let stack = await es.query(`
        // setup
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

            assert.equal(await es.size(), 2);
        });


        it('duplicates an entityset', async () => {
            let es = createEntitySet();
            let stack = await es.query(`
            [ "/component/title", ["text"] ] !d +
            [ /component/title {text:first} ] !c +
            dup`);

            // ilog(stack.items);

            let es1 = stack.popValue();
            assert.ok( isEntitySet( es1 ) );
            assert.equal(await es1.size(), 1);

            let es2 = stack.popValue();
            assert.ok( isEntitySet( es2 ) );
            assert.equal(await es2.size(), 1);
        });

        it('retrieves component defs', async () => {
            let [stack] = await prepES(`
            @d // get defs - doesnt pop the es
            swap drop // lose the es
            `, 'todo');

            // ilog(stack.words);
            let defs = stack.popValue();
            assert.deepEqual(defs, [
                ['/component/title', [{ name: 'text' }]],
                ['/component/completed',
                    [{ name: 'isComplete', type: 'boolean', default: false }]],
                ['/component/priority',
                    [{ name: 'priority', type: 'integer', default: 0 }]],
                ['/component/meta',
                    [{ name: 'meta', type: 'json', default: {} }]]
            ])
        })

    });



    it('creates an entity', async () => {
        let [stack] = await prep(`100 !e`);
        let result = stack.popValue();
        assert.ok(isEntity((result)));
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

        let e = stack.popValue();
        
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

        es = stack.popValue();

        assert.equal(await es.size(), 32);
    });


    describe('Select', () => {

        it('fetches entities by id', async () => {
            let query = `[ 102 @e ] select`;
            let [stack] = await prepES(query, 'todo');

            // ilog(stack.items);
            let result = stack.popValue();

            // the return value is an entity
            assert.equal(result, 102);
        });

        it('fetches entities by did', async () => {
            let query = `[ "/component/completed" !bf @e] select`;
            let [stack] = await prepES(query, 'todo');
            
            // the result will be a list value of entities
            let result = stack.popValue(0,true);
    
            assert.deepEqual( 
                result.map(e => getEntityId(e)), 
                [ 100, 101, 102 ] );
    
            assert.deepEqual( 
                result.map(e => bfToValues(e.bitField) ), 
                [ [ 1, 2, 3, 4 ], [ 1, 2 ], [ 1, 2 ] ] );
        });


        it('fetches component attributes', async () => {
            let [stack] = await prepES(`[ 
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');
    
            let result = stack.popValue(0,true);
            assert.deepEqual(result, [
                'get out of bed',
                'phone up friend',
                'turn on the news',
                'drink some tea',
                'do some shopping'
            ])
        });

        it('fetches entity component attribute', async () => {
            let [stack] = await prepES(`[ 
                103 @e 
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');

            // ilog(stack.items);
            let result = stack.popValue(0,true);
            assert.equal(result, 'drink some tea');
        })

        it('fetches matching component attribute', async () => {
            let [stack] = await prepES(`[ 
                // fetches values for text from all the entities in the es
                /component/title#/text !ca
                "do some shopping"
                // equals in this context means match, rather than equality
                // its result will be components
                ==
                /component/title !bf
                @c
            ] select
            `, 'todo');

            let coms = stack.popValue(0,true);
            assert.equal(coms[0].text, "do some shopping");
        });

        it('fetches entities matching component attribute', async () => {
            let [stack] = await prepES(`[ 
                // fetches values for text from all the entities in the es
                /component/completed#/isComplete !ca
                true
                // equals in this context means match, rather than equality
                // its result will be components
                ==
                @e
            ] select`, 'todo');

            let ents = stack.popValue(0,true);
            
            assert.deepEqual(ents.map(e => getEntityId(e)), [100, 101]);
        });

        it('uses multi conditions', async () => {
            let query = `[
            /component/position#/file !ca a ==
            /component/position#/rank !ca 2 ==
            and
            all
            @c
            ] select !e`
    
            let [stack] = await prepES(query, 'chess');

            let e:Entity = stack.popValue();

            assert.equal( e.size, 3);
            assert.equal( e.Colour.colour, 'white' );
        });

        it('and/or condition', async () => {
            let query = `
            // create an es with the defs
            dup @d {} !es swap + swap
            [
                /component/position#/file !ca a ==
                /component/position#/file !ca f ==
                or
                /component/colour#/colour !ca white ==
                and
                @c
            ] select
            +
            `;
    
            let [stack] = await prepES(query, 'chess');
            
            let es = stack.popValue();
    
            assert.equal( await es.size(), 4 );
        });

        it('super select', async () => {
            let [stack, es] = await prepES(`
            // define a variable holding the es so we don't have to
            // keep swapping things aroung
            es let

            [
                uid let
                ^es [ /component/username#/username !ca  *^uid == ] select
                0 @
            ] selectUserId define
            
            [
                ch_name let
                // adding * to a ^ stops it from being eval'd the 1st time, but not the 2nd
                ^es [ /component/channel#/name !ca *^ch_name == ] select
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
            let [stack, es] = await prepES(`
            es let
            [
                client_id let
                ^es [
                    /component/channel_member#/client !ca *^client_id ==
                    /component/channel_member !bf
                    @c
                ] select

                // pick the channel attributes
                /channel pluck 
            ] selectChannelsFromMember define

            [
                channel_ids let
                ^es [
                    /component/channel_member#/channel !ca *^channel_ids ==
                    /component/channel_member !bf
                    @c
                ] select

                // select client attr, and make sure there are no duplicates
                /client pluck unique 
                
                // make sure this list of clients doesnt include the client_id
                [ ^client_id != ] filter

            ] selectChannelMemberComs define

            [
                eids let
                ^es [ *^eids [/component/nickname] !bf @c ] select
            ] selectNicknames define

            [
                // 1. select channel ids which 'client_id' belongs to
                selectChannelsFromMember

                // 2. select channel members which belong to channel_ids
                selectChannelMemberComs
             
                // 3. using the channel_member client ids select the entities
                selectNicknames

            ] selectChannelMembersByClientId define

            // selects the nicknames of other entities who share
            // the same channel as 9 (roxanne)
            9 selectChannelMembersByClientId

            `, 'irc');

            let result = stack.popValue();
            let nicknames = result.map(v => v.nickname);
            assert.includeMembers(nicknames, ['koolgrap', 'lauryn', 'missy']);
        });


        describe('Component Attribute', () => {

            it('selects a JSON attribute', async () => {
                let [stack] = await prepES(`
                [
                    // where( attr('/component/meta#/meta/author').equals('av') )
                    /component/meta#/meta/author !ca av ==
                    /component/meta !bf
                    @c
                    /meta/tags/1 pluck
                ] select
                `, 'todo');

                // console.log( stack.items );
                // ilog( stack.items );
                assert.equal( stack.popValue(), 'action' );

            });

            // setting a ca? 
            // /com/example#/meta/isEnabled true !ca
            // getting a ca?
            // /com/example#/meta/isEnabled !ca
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



async function prep(insts?: string): Promise<[QueryStack, EntitySet]> {    
    let es = createEntitySet();

    let stack = createStdLibStack();
    
    if (insts) {
        const words = parse(insts);
        // Log.debug('[parse]', words );
        await stack.pushValues(words);
    }

    // let stack = await es.query(insts, {values} );
    return [stack, es];
}

async function prepES(insts?: string, fixture?: string, options:EntitySetOptions = {}): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet();
    let values:StackValue[];

    if (fixture) {
        values = await loadFixture(fixture);
    }
    
    let stack = await es.query(insts, {values} );
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