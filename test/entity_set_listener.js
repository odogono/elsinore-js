import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';


import { AsyncEntitySet } from '../src/entity_set/async';
import { Entity } from '../src/entity';
import { Component } from '../src/component';
import { Registry } from '../src/registry';
import {createLog} from '../src/util/log';

import {
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    printE,
    printIns,
    logEvents,
    entityToString,
} from './common';

const Log = createLog('TestEntitySetListener');

function example({id=_.uniqueId('d'),size=20,width=4,enabled=true,...rest}){
    Log.debug('size',id);
    Log.debug('size',size);
    Log.debug('width',width);
    Log.debug('enabled',enabled);
    Log.debug('rest',rest);
    Log.debug('options',rest);
}

test('yo', async t => {
    example({size:20,height:2.5,name:'smart'});

    t.end();
});

test('expanding', async t => {
    let first = [ 'a', 'apple', 'arse'];
    let second = ['bot', 'bee', ...first];

    Log.debug('aha', second);
})


