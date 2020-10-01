import { suite } from 'uvu';
import assert from 'uvu/assert';

import { createLog } from '../../src/util/log';

import { 
    Entity, isEntity
} from '../../src/entity';

import { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';
import { isComponentDef, hash as hashDef, getDefId, Type } from '../../src/component_def';
import { BuildQueryFn } from '../../src/query/build';
// import { EntitySetMem, EntitySet } from '../../src/entity_set/types';
import { EntitySet, EntitySetMem, EntitySetOptions } from '../../src/entity_set';

import { QueryStack } from '../../src/query/stack';
import { tokenizeString } from '../../src/query/tokenizer';
import { StackValue, SType } from '../../src/query/types';
import { createStdLibStack } from '../../src/query';

export const Log = createLog('TestEntitySet');

// const createEntitySet = () => new EntitySetMem();

export { isComponent } from '../../src/component';
export const parse = (data) => tokenizeString(data, { returnValues: true });
export const sv = (v): StackValue => [SType.Value, v];
export const createEntitySet = (options?) => new EntitySetMem(undefined, options);

export { EntitySet, EntitySetMem as EntitySetInst, isEntitySet } from '../../src/entity_set';
export { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
export { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';

export { toValues as bfToValues } from '../../src/util/bitfield';
export { Entity, isEntity, getEntityId } from '../../src/entity';
export { QueryStack } from '../../src/query/stack';
export {
    SType,
    StackValue,
    AsyncInstResult,
    StackError,
} from '../../src/query/types';
export { isComponentDef, hash as hashDef, getDefId, Type } from '../../src/component_def';


export function buildComponents( es:EntitySet, data:any[] ):Component[] {
    return data.map( dd => {
        const {uri, ...props} = dd;
        const def = es.getByUri(uri);
        // console.log('build with props', props);
        return es.createComponent(def,props);
    })
}

export async function buildEntitySet(options?): Promise<[EntitySetMem, Function]> {
    let es = new EntitySetMem(options);

    const defs = [
        { uri: '/component/channel', properties: ['name'] },
        { uri: '/component/status', properties: ['status'] },
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/username', properties: ['username'] },
        { uri: '/component/channel_member', properties: ['channel_member'] },
    ]

    await defs.reduce( (p,def) => p.then( () => es.register(def)), Promise.resolve() );


    const buildEntity = (es: EntitySet, buildFn: BuildQueryFn, eid: number = 0) => {
        let e = new Entity(eid);
        const component = (uri: string, props: object) => {
            let def = es.getByUri(uri);
            let com = es.createComponent(def, props);
            es.addComponentToEntity(e, com, getDefId(def));
        };

        buildFn({ component });
        return e;
    }

    return [es, buildEntity];
}

export async function buildStackEntitySet(stack: QueryStack, options?): Promise<[QueryStack, EntitySet]> {
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


export async function prep(insts?: string): Promise<[QueryStack, EntitySet]> {
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


export async function prepES(insts?: string, fixture?: string, options: EntitySetOptions = {}): Promise<[QueryStack, EntitySet]> {
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


export async function loadFixture(name: string) {
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


export function ilog(...args) {
    if (process.env.JS_ENV !== 'browser') {
        const util = require('util');
        console.log(util.inspect(...args, { depth: null }));
    }
}


// https://stackoverflow.com/a/29581862
function _getCallerFile() {
    var originalFunc = Error.prepareStackTrace;

    var callerfile;
    try {
        var err = new Error();
        var currentfile;

        Error.prepareStackTrace = function (err, stack) { return stack; };

        // let stack:string[] = err.stack as any;
        let entry = (err.stack as any).shift();
        // console.log('eNtRy', entry.getFunctionName());
        currentfile = entry.getFileName();

        while (err.stack.length) {
            entry = (err.stack as any).shift();
            // console.log('eNtRy', entry.getFunctionName());
            callerfile = entry.getFileName();

            if(currentfile !== callerfile) break;
        }
    } catch (e) {}

    Error.prepareStackTrace = originalFunc; 

    return callerfile;
}