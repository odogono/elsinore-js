import test from 'tape';

import { Component } from '../src/component';
import { isComponent } from '../src/util/is';


test('is a component', t => {
    let c = new Component();
    t.equals(c.type, 'Component');
    t.equals(Component.prototype.type, 'Component');
    t.ok(isComponent(c));
    t.end();
});

test('hash depends on attributes', t => {
    let c = new Component({ name: 'douglas' });
    let co = new Component({ name: 'ben' });
    let ca = new Component({ name: 'douglas' });

    t.notEqual(c.hash(), co.hash());
    t.equal(c.hash(), ca.hash());

    t.end();
});

test('apply copies non-identifying attributes', t => {
    const src = new Component({ name: 'charles', age: 15, height: 186, id: 421, '@e': 1000 });
    const dst = new Component({ name: 'peter', age: 32, '@i': 422, id: 1001, '@e': null });

    src.apply(dst);

    t.deepEqual(src.toJSON(), { '@e': 1000, '@s': 0, age: 32, height: 186, name: 'peter' });

    t.end();
});

test('clone', t => {
    const src = new Component({ name: 'charles', age: 15, height: 186, id: 421, '@e': 1000 });
    const dst = src.clone();

    t.deepEqual(src.toJSON(), dst.toJSON());

    t.equals(src.id, dst.id);
    t.equals(src.entityId, dst.entityId);

    let src2 = new Component({ x: 0, y: 0, z: 0, '@s': 2, '@e': 1001 });
    let dst2 = src2.clone();

    t.deepEqual(src.toJSON(), dst.toJSON());
    t.deepEqual(src2.toJSON(), dst2.toJSON());

    t.equals(src2.get('y'), 0);

    dst2.set({ y: 10 });

    t.equals(src2.get('y'), 0);

    t.end();
});

test('clone subclass', t => {
    class SubComponent extends Component {
        test() {
            return true;
        }
    }

    let com = new SubComponent({ colour: 'magenta' });
    let clone = com.clone();

    t.ok(clone.test());
    t.equals(clone.get('colour'), 'magenta');

    t.end();
});

test('emits an event when attributes are changed', t => {
    let component = new Component({ name: 'clara' });

    t.plan(2);

    component.on('component:update', (...evt) => t.ok(true));

    component.set({ age: 23 });

    component.set({ age: 29 });

    component.set({ age: 29 });

    t.end();
});

test('the component hash changes when attributes are changed', t => {
    let component = new Component({ name: 'ella' });
    let value = component._hash;

    component.set({ name: 'della' });
    t.notEqual(value, component._hash);

    component.set({ name: 'ella' });
    t.equal(value, component._hash);

    t.end();
});

test('comparing components', t => {
    let a = new Component({ name: 'dora', age: 34 });
    let b = new Component({ age: 34, name: 'dora' });

    t.ok(a.compare(b));

    t.end();
});
