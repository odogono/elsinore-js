import { assert } from 'chai';

import {
    ComponentDef,
    createProperty,
    propertyToObject,
    toObject as componentDefToObject,
    create as createComponentDef,
    getDefId
} from '../src/component_def';
import { Component, getComponentDefId } from '../src/component';
import { createLog } from '../src/util/log';
import { toPascalCase } from '../src/util/to';
import util from 'util';

const Log = createLog('TestComponentDef');

describe('ComponentDef', () => {


    it('should create a property', () => {
        const data = { name: 'status', default: 'active', age: 13 };
        let prop = createProperty(data);

        assert.deepEqual(data, propertyToObject(prop));
    });

    it('should create', () => {
        let def = createComponentDef(2, "/component/status", ["status", "updated_at"]);

        // Log.debug('def', def);
        // Log.debug('def', componentDefToObject(def));

        assert.deepEqual(componentDefToObject(def),
            {
                '@d': 2, 
                name: 'Status',
                uri: '/component/status',
                properties: [
                    { name: 'status' }, { name: 'updated_at' }
                ]
            });
    });

    it('should create from an id/obj form', () => {
        const data = { uri: '/component/piece/knight', properties:[ 'rank', 'file' ] };
        let def = createComponentDef(19, data);

        // Log.debug('def', def);
        // Log.debug('def', componentDefToObject(def));

        assert.deepEqual( componentDefToObject(def), {
            '@d': 19,
            name: 'Knight',
            uri: '/component/piece/knight',
            properties: [ { name: 'rank' }, { name: 'file' } ]
        });
    });

    it('should create from an instance', () => {
        const data = { uri: '/component/piece/knight', properties:[ 'rank', 'file' ] };
        let def = createComponentDef(data);

        def = createComponentDef( 22, def );


        assert.equal( getDefId(def), 22 );
        Log.debug('def', def);
    })
});