import '../src/query/attr';
import '../src/query/equals';

import { Builder, Query } from '../src/query/index';
import { DslContext, QueryBuilder } from '../src/query/dsl';

import { EntitySet } from '../src/entity_set/index';
import File from 'pull-file';
import Fs from 'fs';
import Pull from 'pull-stream';
import PullMap from 'pull-stream/throughs/map';
import PullUtf8 from 'pull-utf8-decoder';
import { QueryOp } from '../src/types';
import { Registry } from '../src/registry/index';
import { toString as entityToString } from '../src/util/to_string';
import { isEntity } from '../src/util/is';
import parseEJSON from 'odgn-json';
import { parseJSON } from '../src/util/parse_json';

describe('Query', () => {
    it.only('should create an AST simple', () => {
        let stmt = (Q: QueryBuilder) =>
            Q.all('/component/status').where(Q.attr('status').equals('active'));

        expect(toRPN(stmt, { debug: true })).toEqual([
            ['VL', '/component/status'],
            ['AT', 'status'],
            ['VL', 'active'],
            '==',
            'AL'
        ]);

        expect(toAST(stmt)).toEqual([
            [
                'AL',
                ['VL', '/component/status'],
                ['==', ['AT', 'status'], ['VL', 'active']]
            ]
        ]);
    });

    it('should create an AST', () => {
        let stmt = (Q: QueryBuilder) =>
            Q.all('/component/name').where(
                Q.attr('name').equals('alex'),
                Q.attr('status').greaterThan(1)
            );

        expect(toRPN(stmt)).toEqual([
            ['VL', '/component/name'],
            ['AT', 'name'],
            ['VL', 'alex'],
            '==',
            ['AT', 'status'],
            ['VL', 1],
            '>',
            '&&',
            'AL'
        ]);

        expect(toAST(stmt)).toEqual([
            ['VL', '/component/name'],
            [
                'AL',
                '&&',
                ['==', ['AT', 'name'], ['VL', 'alex']],
                ['>', ['AT', 'status'], ['VL', 1]]
            ]
        ]);

        expect(toAST(Q => Q.all('/component/name'))).toEqual([
            ['AL', ['VL', '/component/name']]
        ]);

        expect(toRPN(Q => Q.all('/component/name'))).toEqual([
            ['VL', '/component/name'],
            'AL'
        ]);

        expect(toRPN(Q => Q.attr('client'))).toEqual([['AT', 'client']]);
    });

    it('should execute equals', () => {
        let stmt = Q => Q.value(8).equals(8);
        expect(toAST(stmt)).toEqual([['==', ['VL', 8], ['VL', 8]]]);

        expect(toRPN(stmt)).toEqual([['VL', 8], ['VL', 8], '==']);

        expect(Query.fromAST([QueryOp.Equals, 8, 8]).execute()).toEqual(true);

        expect(Query.build(stmt).execute()).toEqual(true);

        stmt = Q => Q.value(8).equals([1, 3, 5, 8]);
        expect(toAST(stmt)).toEqual([['==', ['VL', 8], ['VL', [1, 3, 5, 8]]]]);
        expect(Query.build(stmt).execute()).toEqual(true);

        // test('QueryOp.Equals', t => {
        //     const q = new Query([QueryOp.Equals, 8, 8]);
        //     t.equal(q.execute(), true);

        //     const q2 = new Query([QueryOp.Equals, 8, [QueryOp.Value, [1, 3, 5, 8]]]);
        //     t.equal(q.execute(), true);

        //     t.end();
        // });
    });

    test('accepting an entity', async () => {
        const registry = await initialiseRegistry();

        const entity = registry.createEntity([
            { '@c': '/component/channel', name: 'test' },
            { '@c': '/component/topic', topic: 'Javascript' }
        ]);

        let query = Query.build(Q => Q.all('/component/channel'));
        let result = query.execute(entity);

        expect(isEntity(result)).toBe(true);
    });

    test.skip('conditional all', async () => {
        const [registry, es] = await loadChess();

        // console.log( entityToString(es) );

        console.log(entityToString(es.at(0)));

        expect(true).toBe(true);
    });
});

async function initialiseRegistry(): Promise<Registry> {
    let registry = new Registry();
    let path = './test-old/fixtures/components.json';
    let data = Fs.readFileSync(path, 'utf8');
    let componentData = parseJSON(data);
    await registry.registerComponent(componentData);
    return registry;
}

async function loadChess(): Promise<[Registry, EntitySet]> {
    const registry = new Registry();
    let path = './test-old/fixtures/chess.ldjson';
    const entitySet = registry.createEntitySet();

    // console.log('[loadChess]', entitySet);

    // stream items from the ldjson file
    return new Promise((resolve, reject) => {
        Pull(
            File(path),
            PullUtf8(),
            parseEJSON(),
            PullMap(json => [json, {}]),

            // convert json into [item,options] tuple
            // Stringify.lines(),
            // PullTo.sink(process.stdout, err => {
            //     if(err) throw err;
            //     t.end();
            // })
            entitySet.sink({ debug: false }, err => {
                return err ? reject(err) : resolve(entitySet);

                // Log.debug('[sink]', entityToString(receivingES));
                // t.equals(receivingES.size(), 3);
                // t.end();
            })
        );
    }).then(entitySet => {
        return [registry, entitySet] as [Registry, EntitySet];
    });
}

function toAST(stmt: Builder) {
    let builder = new QueryBuilder();
    let context = stmt(builder);
    return context.toArray(true);
}

function toRPN(stmt: Builder, { debug } = { debug: false }) {
    let builder = new QueryBuilder();
    if (debug) {
        console.log('[toRPN]');
    }
    let context = stmt(builder);
    return context.toArray();
}
