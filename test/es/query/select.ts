import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    AsyncInstResult,
    bfToValues,
    buildEntitySet,
    buildStackEntitySet,
    createEntitySet,
    Entity,
    getEntityId,
    ilog,
    isEntity,
    loadFixture,
    parse,
    prep,
    prepES,
    QueryStack,
    StackValue,
    SType,
    sv,
} from '../helpers';


let test = suite('es/query/mem - Select');


test('fetches entities by id', async () => {
    let query = `[ 102 @e ] select`;
    let [stack] = await prepES(query, 'todo');

    // ilog(stack.items);
    let result = stack.popValue();

    // the return value is an entity
    assert.equal(result, 102);
});

test('fetches entities by did', async () => {
    let query = `[ "/component/completed" !bf @e] select`;
    let [stack] = await prepES(query, 'todo');

    // the result will be a list value of entities
    let result = stack.popValue();

    assert.equal(
        result.map(e => getEntityId(e)),
        [100, 101, 102]);

    assert.equal(
        result.map(e => bfToValues(e.bitField)),
        [[1, 2, 3, 4], [1, 2, 4], [1, 2, 4]]);
});

test('fetches all the entities', async () => {
    let query = `[ all !bf @e ] select`;
    let [stack] = await prepES(query, 'todo');
    let result = stack.popValue();

    assert.equal(result.map(e => e.id), [100, 101, 102, 103, 104]);
})

test('fetches all the entities ids', async () => {
    let query = `[ all !bf @eid ] select`;
    let [stack] = await prepES(query, 'todo');
    let result = stack.popValue();

    assert.equal( result, [100, 101, 102, 103, 104] );
})


test('fetches component attributes', async () => {
    let [stack] = await prepES(`[ 
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');

    let result = stack.popValue();
    assert.equal(result, [
        'get out of bed',
        'phone up friend',
        'turn on the news',
        'drink some tea',
        'do some shopping'
    ])
});

test('fetches entity component attribute', async () => {
    let [stack] = await prepES(`[ 
                103 @e 
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');

    // ilog(stack.items);
    let result = stack.popValue();
    // ilog( result );
    assert.equal(result, 'drink some tea');
})

test('fetches matching component attribute', async () => {
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

    let coms = stack.popValue();
    assert.equal(coms[0].text, "do some shopping");
});

test('fetches entities matching component attribute', async () => {
    let [stack] = await prepES(`[ 
                // fetches values for text from all the entities in the es
                /component/completed#/isComplete !ca
                true
                // equals in this context means match, rather than equality
                // its result will be components
                ==
                @e
            ] select`, 'todo');

    let ents = stack.popValue();

    assert.equal(ents.map(e => getEntityId(e)), [100, 101]);
});

test('fetches matching attribute with regex', async () => {
    let [stack] = await prepES(`[ 
                /component/title#/text !ca ~r/some/ ==
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');

    let result = stack.popValue();
    assert.equal(result, [
        'drink some tea',
        'do some shopping'
    ])
});

test('uses regex for minimum length', async () => {
    let [stack] = await prepES(`[ 
                /component/meta#/meta/author !ca ~r/^.{2,}$/ ==
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');

    let result = stack.popValue();
    assert.equal(result, [
        'get out of bed',
        'drink some tea'
    ])
});

test('fetches by comparing a date', async () => {
    let [stack] = await prepES(`[ 
                // /component/meta#/createdAt !ca ~d/2020-05-23T10:00:00.000Z/ >=
                /component/meta#/createdAt !ca ~d/2020-05-23T12:00:00.000Z/ <=
                // and
                /component/title !bf
                @c
                /text pluck
            ] select`, 'todo');

    let result = stack.popValue();
    assert.equal(result, [
        'get out of bed',
        'phone up friend',
        'turn on the news',
    ])
});



test('uses multi conditions', async () => {
    let query = `[
            /component/position#/file !ca a ==
            /component/position#/rank !ca 2 ==
            and
            all
            @c
            ] select !e`

    let [stack] = await prepES(query, 'chess');

    let e: Entity = stack.popValue();

    assert.equal(e.size, 3);
    assert.equal(e.Colour.colour, 'white');
});

test('and/or condition', async () => {
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

    assert.equal(await es.size(), 4);
});

test('super select', async () => {
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

    assert.equal(stack.popValue(),
        '["/component/channel_member", {"@e": 14,"channel": 3,"client": 11}]');
})

test('multi fn query', async () => {
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
    assert.equal(nicknames, ['missy', 'lauryn', 'koolgrap']);
});




test('selects a JSON attribute', async () => {
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
    const result = stack.popValue();
    ilog( result );

    assert.equal(result, 'action');
});

test.run();