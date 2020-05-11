import { assert } from 'chai';

import {
    ComponentDef,
    createProperty,
    propertyToObject,
    toObject as componentDefToObject,
    create as createComponentDef,
    hash as hashComponentDef,
    toObject as defToObject,
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

        // /def @d, uri, name
        // /property/status status
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

    it('should create from uri/prop array', () => {
        const data = [ '/component/completed', [{name:'isComplete', type:'boolean', default:false}] ];
        let def = createComponentDef(undefined, ...data);

        assert.deepEqual( componentDefToObject(def), {
            '@d': undefined,
            name: 'Completed',
            uri: '/component/completed',
            properties: [ { name: 'isComplete', type:'boolean', default:false } ]
        });
    })

    it('should create from an instance', () => {
        const data = { uri: '/component/piece/knight', properties:[ 'rank', 'file' ] };
        let def = createComponentDef(data);

        def = createComponentDef( 22, def );


        assert.equal( getDefId(def), 22 );
        
    });

    it('hash should return identical values', () => {
        const data = { uri: '/component/piece/knight', properties:[ 'rank', 'file' ] };
        let def = createComponentDef(data);
        let hashA = hashComponentDef(def);

        def = createComponentDef( 22, def );
        let hashB = hashComponentDef(def);

        assert.equal( hashA, hashB );

        assert.equal(
            hashComponentDef(createComponentDef( 22, data )),
            hashComponentDef(createComponentDef( 24, data ))
        )
    })
});