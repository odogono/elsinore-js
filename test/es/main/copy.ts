import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    bfToValues,
    buildComponents,
    buildEntitySet,
    ChangeSetOp,
    createEntitySet,
    Component,
    Entity,
    EntitySet,
    EntitySetInst,
    getChanges,
    getComponentDefId,
    hashDef,
    isComponentDef,
    isEntity,
    Log,
    OrphanComponent,
} from '../helpers';
import { assertHasComponents } from '../../helpers/assert';

let test = suite('es/mem - component def');

test('transfers components to a foreign es', async () => {
    // create es1 with defs and components
    // create es2 with different defs
    // copy es1 into es2

    const defsA = [
        { uri: '/component/status', properties: ['status'] },
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/channel', properties: ['name'] },
        { uri: '/component/username', properties: ['username'] },
        { uri: '/component/channel_member', properties: ['channel_member'] },
    ];
    const defsB = [
        { uri: '/component/topic', properties: ['topic'] },
        { uri: '/component/channel', properties: ['name', 'isOpen'] },
        { uri: '/component/status', properties: ['status', 'isActive'] },
    ];

    let es1 = createEntitySet();
    let es2 = createEntitySet();

    await defsA.reduce( (p,def) => p.then( () => es1.register(def)), Promise.resolve() );
    await defsB.reduce( (p,def) => p.then( () => es2.register(def)), Promise.resolve() );

    

    let data:any = [ 
        {uri:'/component/status', status:'active'},
        {uri:'/component/topic', topic:'current affairs'},
        {uri:'/component/channel', name:'#current-affairs'},
        {uri:'/component/username', username:'melliott'},
    ];
    let coms = buildComponents(es1, data);
    await es1.add(coms);

    data = [
        {uri:'/component/status', status:'inactive', isActive:false },
        {uri:'/component/topic', topic:'Off Topic'},
        {uri:'/component/channel', name:'#off-topic', isOpen:true },
    ]
    coms = buildComponents(es2, data);
    // Log.debug( coms );
    await es2.add(coms);
    // Log.debug( es2 );

    // Log.debug(es1);

    
    
    await es2.add(es1);
    
    // Log.debug(es2);

    assert.equal( await es2.size(), 2 );
});


test.run();