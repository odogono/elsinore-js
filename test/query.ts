import '../src/query/attr';
import '../src/query/equals';

import { Builder, Query } from '../src/query/index';
import { DslContext, QueryBuilder } from '../src/query/dsl';

import Fs from 'fs';
import { QueryOp } from '../src/types';
import { Registry } from '../src/registry/index';
import { isEntity } from '../src/util/is';
import { parseJSON } from '../src/util/parse_json';

describe('Query', () => {
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
});

async function initialiseRegistry(): Promise<Registry> {
    let registry = new Registry();
    let path = './test-old/fixtures/components.json';
    let data = Fs.readFileSync(path, 'utf8');
    let componentData = parseJSON(data);
    await registry.registerComponent(componentData);
    return registry;
}

function toAST(stmt: Builder) {
    let builder = new QueryBuilder();
    let context = stmt(builder);
    return context.toArray(true);
}

function toRPN(stmt: Builder) {
    let builder = new QueryBuilder();
    let context = stmt(builder);
    return context.toArray();
}
