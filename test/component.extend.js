import _ from 'underscore';
import test from 'tape';

import {
    Entity,
    EntityFilter,
    EntitySet,
    Registry,
    Query,
    initialiseRegistry,
    loadEntities,
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    requireLib,
    createLog
} from './common';
import { isComponent } from '../src/util/is';
import { Component } from '../src/component';
import { ComponentRegistry } from '../src/schema';

const Log = createLog('TestComponentExtend', false);

const COMPONENT_DEFINITIONS = [
    { uri: '/component/name', properties: { name: '' } },
    { uri: '/component/position', properties: { x: 0, y: 0 } }
];

test('registering a custom component type', t => {
    class TestComponent extends Component {
        type() {
            return 'TestComponent';
        }

        preinitialize(attrs, options) {
            // console.log('TestComponent preinit', attrs, options);
        }

        verify() {
            return true;
        }
    }

    const componentRegistry = ComponentRegistry.create();
    componentRegistry.register(COMPONENT_DEFINITIONS);

    Log.debug( TestComponent.prototype.isComponent );
    // t.ok( isComponent(TestComponent) );

    // register the type first
    componentRegistry.register(TestComponent);

    componentRegistry.register({
        uri: '/component/example',
        type: 'TestComponent',
        properties: { name: '' }
    });

    let component = componentRegistry.createComponent('/component/example');

    t.ok(component.isTestComponent);
    t.ok(component.verify());

    let name = componentRegistry.createComponent('/component/name');

    t.ok(name.isComponent);

    t.end();
});

test('attempting to create an unregistered type', t => {
    const componentRegistry = ComponentRegistry.create();

    try {
        componentRegistry.register({
            uri: '/component/example',
            type: 'TestComponent',
            properties: { name: '' }
        });
    } catch (err) {
        t.equals(err.message, 'could not find type TestComponent for def /component/example');
    }

    t.end();
});

test('the custom component is initialised when registered', async t => {
    try {
        const registry = await createRegistry();

        t.plan(1);

        class TestComponent extends Component {
            type() {
                return 'TestComponent';
            }

            preinitialize(attrs, options) {
                t.ok(options.registry, 'the registry is passed as an option');
            }
        }

        registry.registerComponent(TestComponent);

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

test('the custom component can supply properties', t => {
    const componentRegistry = ComponentRegistry.create();
    // logEvents( componentRegistry );
    class TestComponent extends Component {
        constructor(attrs, options) {
            super(attrs, options);
            this.type = 'TestComponent';
            this.properties = { maximum: 10 };
        }
        // type(){ return 'TestComponent'; }
        // properties(){
        //     return { maximum:10 };
        // }
    }

    componentRegistry.register(TestComponent);

    // note that the merging of properties happens at the point of
    // registration
    componentRegistry.register({
        uri: '/component/example',
        type: 'TestComponent',
        properties: { name: 'tbd' }
    });

    const component = componentRegistry.createComponent('/component/example');

    t.equals(component.get('maximum'), 10);
    t.equals(component.get('name'), 'tbd');

    t.end();
});

test('the registered component class can also include a uri', t => {
    createRegistry()
        .then(registry => {
            class TestComponent extends Component {
                uri() {
                    return '/component/test';
                }
                type() {
                    return 'TestComponent';
                }
                properties() {
                    return { testValue: 'unfulfilled' };
                }
            }

            registry.registerComponent(TestComponent);

            const component = registry.createComponent('/component/test');

            t.ok(component.isTestComponent);
            t.equals(component.getDefUri(), '/component/test');
            t.equals(component.get('testValue'), 'unfulfilled');
        })
        .then(() => t.end())
        .catch(err => console.error('test error', err, err.stack));
});

test('passing options to the custom component', t => {
    const componentRegistry = ComponentRegistry.create();

    class TestComponent extends Component {
        constructor(attrs, options) {
            super(attrs, options);
            this.set({ msg: options.msg });
        }
        type() {
            return 'TestComponent';
        }
    }

    componentRegistry.register(TestComponent);

    // note that the merging of properties happens at the point of
    // registration
    componentRegistry.register({
        uri: '/component/example',
        type: 'TestComponent',
        properties: { name: 'tbd' },
        options: { msg: 'welcome' }
    });

    let component = componentRegistry.createComponent('/component/example');

    t.equals(component.get('name'), 'tbd');
    t.equals(component.get('msg'), 'welcome');

    t.end();
});

/**
 * Component is added to entity
 * the component adds a new function to the entity so that it will
 *
 */
test('will be notified when the entity is added to an entityset', async t => {
    try {
        const registry = await createRegistry();

        // t.plan(1);

        let calledOnAdded = false;
        let calledOnRemoved = false;

        class TestComponent extends Component {
            uri() {
                return '/component/test';
            }
            type() {
                return 'TestComponent';
            }

            properties() {
                return { name: 'unknown' };
            }

            onAdded(es) {
                calledOnAdded = true;
                this._entity.addChild = function() {
                    // console.log('adding the child to me,', this.id, 'es', this.collection.getUUID() );
                };
            }

            onRemoved(es) {
                calledOnRemoved = true;
            }
        }

        registry.registerComponent(TestComponent);

        let es = registry.createEntitySet();
        let es2 = registry.createEntitySet();

        let e = registry.createComponent('/component/test');

        // Log.debug('ok yo', e.cid, typeof e.onAdded );

        es.addComponent(e);

        const entity = es.at(0);

        entity.removeComponent(entity.Test);

        t.ok(calledOnAdded, 'onAdded was called');
        t.ok(calledOnRemoved, 'onRemoved was called');

        t.end();
    } catch (err) {
        Log.error(err.stack);
    }
});

function createRegistry() {
    const registry = new Registry();
    return registry.registerComponent(COMPONENT_DEFINITIONS).then(() => registry);
}
