import { suite } from 'uvu';
import assert from 'uvu/assert';

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
import { stackToString } from '../../src/query/util';


const Log = createLog('TestQuery');

const parse = (data) => tokenizeString(data, { returnValues: true });
const sv = (v): StackValue => [SType.Value, v];
const createEntitySet = (options?) => new EntitySetMem(undefined, options);






















async function buildEntitySet(stack: QueryStack, options?): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet(options);

    const defs = [
        { uri: "/component/title", properties: ["text"] },
        { uri: "/component/completed", properties: [{ "name": "isComplete", "type": "boolean", "default": false }] },
        { uri: "/component/priority", properties: [{ "name": "priority", "type": "integer", "default": 0 }] },
    ];

    await defs.reduce((p, def) => p.then(() => es.register(def)), Promise.resolve());

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

async function prepES(insts?: string, fixture?: string, options: EntitySetOptions = {}): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet();
    let values: StackValue[];

    if (fixture) {
        values = await loadFixture(fixture);
    }

    // if( insts === undefined ){
    //     return [undefined,es];
    // }

    let stack = await es.query(insts, { values });
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
        // assert.equal(parsed, chessData);
        return parsed;
    } else {
        return (window as any).testData[name];
    }
}


function ilog(...args) {
    if (process.env.JS_ENV !== 'browser') {
        const util = require('util');
        console.log(util.inspect(...args, { depth: null }));
    }
}