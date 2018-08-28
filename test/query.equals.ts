import _ from 'underscore';
import Sinon from 'sinon';
import test from 'tape';

import {createLog} from '../src/util/log';

import {
    Component, Entity, EntityFilter, Query,
    initialiseRegistry, 
    loadEntities, 
    loadComponents,
    loadFixtureJSON,
    logEvents,
    entityToString,
} from './common';

const Log = createLog('TestQueryWhere');


test('equals compares multiple attributes', async t => {
    try{
    const [registry,entitySet] = await initialiseEntitySet();

    const entity = registry.createEntity( [
        {'@c':'/component/channel_member', username:'aveenendaal'},
        {'@c':'/component/status', username:'aveenendaal', status:'active'}
        ]);
    
    const query = new Query( Q => Q.attr('username').equals('aveenendaal') );
    const result = query.execute( entity, {debug:false} );

    t.ok( result, 'the entity contains the attribute');

    Log.debug( result, entityToString(result) );

    t.end();
    }catch(err){ Log.error(err.stack) }
});




async function initialiseEntitySet( entityDataName = 'query.entities' ){
    const registry = await initialiseRegistry(false);
    const entitySet = loadEntities( registry, entityDataName );
    return [registry,entitySet];
}
