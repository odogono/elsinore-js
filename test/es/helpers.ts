import { suite } from 'uvu';
import assert from 'uvu/assert';

import { createLog } from '../../src/util/log';

import { 
    Entity
} from '../../src/entity';

export type buildDefFn = (url: string, ...args: any[]) => void;
export type buildComponentFn = (url: string, props:object) => void;
export type buildInstFn = (...args: any[]) => void;
export type buildEntityFn = () => void;
export type buildValueFn = (registry: EntitySet) => void;
export interface BuildQueryParams {
    def:buildDefFn, 
    component: buildComponentFn,
    entity:buildEntityFn,
    inst:buildInstFn,
    value:buildValueFn
}
export type BuildQueryFn = (BuildQueryParams) => void;

import { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';
import { EntitySet, EntitySetOptions } from '../../src/entity_set';
export { isEntitySet } from '../../src/entity_set';

import { QueryStack } from '../../src/query/stack';
import { tokenizeString } from '../../src/query/tokenizer';
import { StackValue, SType } from '../../src/query/types';
import { createStdLibStack } from '../../src/query';
import { QueryableEntitySetMem } from '../../src/entity_set_mem/query';
import { QueryableEntitySet } from '../../src/entity_set/queryable';

export const Log = createLog('TestEntitySet');

export { isComponent } from '../../src/component';
export const parse = (data) => tokenizeString(data, { returnValues: true });
export const sv = (v): StackValue => [SType.Value, v];


export { EntitySetMem as EntitySetInst } from '../../src/entity_set_mem';
export { getChanges, ChangeSetOp } from '../../src/change_set';
export { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';

export { toValues as bfToValues } from '@odgn/utils/bitfield';
export { Entity, isEntity, getEntityId } from '../../src/entity';
export { QueryStack } from '../../src/query/stack';
export {
    SType,
    StackValue,
    AsyncInstResult,
    StackError,
} from '../../src/query/types';
export { isComponentDef, hash as hashDef, getDefId, Type } from '../../src/component_def';

export { printAll, printEntity } from '../../src/util/print';

export function beforeEach(){}


export const createEntitySet = (options?) => new QueryableEntitySetMem(undefined, options);



export function buildComponents( es:EntitySet, data:any[] ):Component[] {
    return data.map( props => {
        let url = '';
        // let props = dd;
        if( props['@d'] !== undefined ){
            url = props['@d'];
            delete props['@d'];
        } else {
            url = props.url;
            delete props.url;
        }

        // let {url, ...props} = dd;
        // if( dd['@d'] )
        // const url = dd['@d'] ?? dd['url'];
        const def = es.getByUrl(url);
        // console.log('build with props', props);
        return es.createComponent(def,props);
    })
}

export async function buildEntitySet(options?:EntitySetOptions): Promise<[QueryableEntitySetMem, Function]> {
    let es = createEntitySet(options);

    const defs = [
        { url: '/component/channel', properties: ['name'] },
        { url: '/component/status', properties: ['status'] },
        { url: '/component/topic', properties: ['topic'] },
        { url: '/component/username', properties: ['username'] },
        { url: '/component/channel_member', properties: ['channel_member'] },
    ]

    for( const def of defs ){
        await es.register(def);
    }

    

    const buildEntity = (es: EntitySet, buildFn: BuildQueryFn, eid: number = 0) => {
        let e = new Entity(eid);
        const component = (url: string, props: object) => {
            let def = es.getByUrl(url);
            let com = es.createComponent(def, props);
            es.addComponentToEntity(e, com);
        };

        buildFn({ component });
        return e;
    }

    return [es, buildEntity];
}

export async function buildStackEntitySet(stack: QueryStack, options?): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet(options);

    const defs = [
        { url: "/component/title", properties: ["text"] },
        { url: "/component/completed", properties: [{ "name": "isComplete", "type": "boolean", "default": false }] },
        { url: "/component/priority", properties: [{ "name": "priority", "type": "integer", "default": 0 }] },
    ];

    for( const def of defs ){
        await es.register(def);
    }
    
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


export async function prepES(insts?: string, fixture?: string, options: EntitySetOptions = {}): Promise<[QueryStack, QueryableEntitySet]> {
    let es = createEntitySet(options);
    let values: StackValue[];

    if (fixture) {
        values = await loadFixture(fixture);
    }

    // if( insts === undefined ){
    //     return [undefined,es];
    // }

    if( insts !== undefined ){
        let stack = await es.query(insts, { values });
        return [stack, es];
    }
    
    let stack = await es.query(undefined, {values});
    return [stack,es];
}

/**
 * 
 * @param es 
 * @param fixture 
 */
export async function loadFixtureIntoES( es:QueryableEntitySet, fixture:string ){
    if( es === undefined ){
        es = createEntitySet();
    }
    let data = await loadFixture(fixture, false);
    let stmt = es.prepare(data);
    await stmt.run();

    return es;
}


export async function loadFixture(name: string, doParse:boolean = true) {
    if (process.env.JS_ENV !== 'browser') {
        const Path = require('path');
        const Fs = require('fs-extra');
        const path = Path.resolve(__dirname, `../fixtures/${name}.insts`);
        const data = await Fs.readFile(path, 'utf8');
        if( !doParse ){
            return data;
        }
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