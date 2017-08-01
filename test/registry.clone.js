import _ from 'underscore';
import test from 'tape';
import { createLog, Entity, printE, initialiseRegistry } from './common';
import { cloneEntity, cloneComponent } from '../src/util/clone';

const Log = createLog('TestClone');

test('copies a blank entity', t => {
    return initialiseRegistry()
        .then(registry => {
            const src = registry.createEntity([
                { '@c': '/component/position', x: 2, y: -2 },
                { '@c': '/component/name', name: 'alpha' }
            ]);

            const dst = cloneEntity(src, null, { full: true });

            // change src to prove dst is independent
            src.Position.set({ x: 15 });
            t.equals(dst.Position.get('x'), 2);
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

test('will retain dst components missing from the src by default', t => {
    return initialiseRegistry()
        .then(registry => {
            const src = registry.createEntity([{ '@c': '/component/position', x: 2, y: -2 }]);
            const dst = registry.createEntity([{ '@c': '/component/name', name: 'alpha' }]);
            const copy = cloneEntity(src, dst);

            t.equals(copy.Position.get('y'), -2);
            t.equals(copy.Name.get('name'), 'alpha');
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

test('will remove components missing from the src', async t => {
    try {
        const registry = await initialiseRegistry();

        const src = registry.createEntity([{ '@c': '/component/position', x: 2, y: -2 }]);
        const dst = registry.createEntity([{ '@c': '/component/name', name: 'alpha' }]);
        const copy = cloneEntity(src, dst, { delete: true });

        t.equals(copy.Position.get('y'), -2);
        t.ok(!copy.Name, 'the name component should be missing from the dst');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('returns false if nothing changed', t => {
    return initialiseRegistry()
        .then(registry => {
            const src = registry.createEntity([
                { '@c': '/component/position', x: 2, y: -2 },
                { '@c': '/component/name', name: 'alpha' }
            ]);

            const dst = registry.createEntity([
                { '@c': '/component/position', x: 2, y: -2 },
                { '@c': '/component/name', name: 'alpha' }
            ]);

            const [copy, hasChanged] = cloneEntity(src, dst, { returnChanged: true });

            t.notOk(hasChanged, 'the src and dst entity were the same');
            t.equals(copy.Name.get('name'), 'alpha');
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

test('returning whether anything was changed on the dst entity', t => {
    return initialiseRegistry()
        .then(registry => {
            const src = registry.createEntity([
                { '@c': '/component/position', x: 2, y: -2 },
                { '@c': '/component/name', name: 'alpha' }
            ]);

            const dst = registry.createEntity([
                { '@c': '/component/position', x: 2, y: -2 },
                { '@c': '/component/name', name: 'beta' }
            ]);

            const [copy, hasChanged] = cloneEntity(src, dst, { returnChanged: true });

            t.ok(hasChanged, 'the src and dst entity were different');
            t.equals(copy.Name.get('name'), 'alpha');
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

test('a missing dst component counts as a change', t => {
    return initialiseRegistry()
        .then(registry => {
            const src = registry.createEntity([{ '@c': '/component/position', x: 2, y: -2 }]);

            const dst = registry.createEntity([
                { '@c': '/component/position', x: 2, y: -2 },
                { '@c': '/component/name', name: 'alpha' }
            ]);

            const [copy, hasChanged] = cloneEntity(src, dst, { delete: true, returnChanged: true });
            t.ok(hasChanged, 'the src and dst entity were different');
            // t.equals( copy.Name.get('name'), 'alpha' );
        })
        .then(() => t.end())
        .catch(err => log.error('test error: %s', err.stack));
});

test('cloning a component', async t => {
    try {
        const registry = await initialiseRegistry();
        const component = registry.createComponent({
            '@e': 12,
            '@c': '/component/channel_member',
            channel: 1,
            client: 5
        });

        const cloned = cloneComponent(component);

        t.equals(component.getEntityId(), cloned.getEntityId());
        t.equals(component.name, cloned.name);
        t.equals(component.hash(), cloned.hash());
        t.deepEqual(component.attributes, cloned.attributes);

        t.end();
    } catch (err) {
        Log.error('test error: %s', err.stack);
    }
});

test('cloning an entity', async t => {
    try {
        const registry = await initialiseRegistry();

        const entity = registry.createEntityWithId(23, 16);
        const clone = cloneEntity(entity);

        t.equals(entity.getEntityId(), clone.getEntityId());
        t.equals(entity.getEntitySetId(), clone.getEntitySetId());
        t.equals(clone.getRegistry(), registry);
        t.notEqual(entity.cid, clone.cid);
        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});
