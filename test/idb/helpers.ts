if (process.env.JS_ENV !== 'browser') {
    require('fake-indexeddb/auto');
}

import {
    Entity, isEntity,
} from '../../src/entity';
import { EntitySetSQL } from '../../src/entity_set_sql';

import { EntitySet, EntitySetOptions, isEntitySet } from '../../src/entity_set';
export { EntitySet, isEntitySet } from '../../src/entity_set';
export { EntitySetIDB as EntitySetInst } from '../../src/entity_set_idb';

import { QueryStack } from '../../src/query/stack';
import { tokenizeString } from '../../src/query/tokenizer';
import { StackValue, SType } from '../../src/query/types';
import { createStdLibStack } from '../../src/query';

import { BuildQueryFn } from '../../src/query/build';
import {
    toObject as defToObject,
    hash as hashDef,
    isComponentDef,
    ComponentDef,
    getDefId,
} from '../../src/component_def';
import { createLog } from '../../src/util/log';

export { isComponent } from '../../src/component';
export const parse = (data) => tokenizeString(data, { returnValues: true });
export const sv = (v): StackValue => [SType.Value, v];

export { getChanges, ChangeSetOp } from '../../src/entity_set/change_set';
export { fromComponentId, getComponentDefId, Component, OrphanComponent } from '../../src/component';
export const Log = createLog('TestEntitySetSQL');

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

export { printAll, printEntity } from '../../src/util/print';

import { loadFixture } from '../es/helpers';
import { EntitySetIDB, clearIDB } from '../../src/entity_set_idb';
export { buildComponents, loadFixture } from '../es/helpers';




export const createEntitySet = (options?) => new EntitySetIDB();


export async function beforeEach(){
    await clearIDB();
}

export async function buildEntitySet(): Promise<[EntitySet, Function]> {
    let es = createEntitySet();

    const defs = [
        { uri: '/component/channel', properties: ['name'] },
        { uri: '/component/status', properties: ['status'] },
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/username', properties: ['username'] },
        { uri: '/component/channel_member', properties: [ {name:'channel', type:'integer'} ] },
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


export async function prepES(insts?: string, fixture?: string, options: EntitySetOptions = {}): Promise<[QueryStack, EntitySet]> {
    let es = createEntitySet();
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

/**
 * 
 * @param es 
 * @param fixture 
 */
export async function loadFixtureIntoES( es:EntitySet, fixture:string ){
    if( es === undefined ){
        es = createEntitySet();
    }
    let data = await loadFixture(fixture, false);
    let stmt = es.prepare(data);
    await stmt.run();

    return es;
}
