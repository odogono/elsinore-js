import _ from 'underscore';
import test from 'tape';

import {
    Registry,
    entityToString,
    logEvents,
    createLog,
} from './common';
import AsyncEntitySet from '../src/entity_set/async';

import {readProperty,isPromise} from '../src/util';
import {JSONLoader} from '../src/util/loader';
import {JSONExporter} from '../src/util/exporter';

// import Pushable from 'pull-pushable';
import Pull from 'pull-stream';


const Log = createLog('TestPullStream');


test.only('entity sink', async t => {
    try {
        const {registry,entitySet} = await initialise({loadEntities:false,instanceClass:AsyncEntitySet});
        

        const values = Pull.values([
            {'@c':'/position', x:2, y:-2},
            [{'@c':'/name', 'name': 'outlier'}, {'@c':'/position', x:100, y:0}],
            [{'@c':'/name', name:'todd'},{'@c':'/position', x:5, y:6}],
            {'@c':'/name', name:'peter'},
            // {'msg':'i dont belong here'},
            // {'@c':'/position', x:2, y:-2},
        ]);

        const sink = entitySet.createPullStreamSink({}, (err) => {
            Log.debug(`[completeCb]`, err );
            Log.debug(`[completeCb]`, entityToString(entitySet) );
        });

        Pull( values, throughLoader(registry), sink );
        // sink( throughLoader(registry)(values) );

        t.end();

    }catch(err){ Log.error(err.stack); }
});


function throughLoader(registry){
    // a sink function: accept a source
    return function (read) {

        // but return another source!
        return function (abort, outSourceCb) {
            // read from the in-stream
            read(abort, function (err, data) {
                // if the stream has ended, pass that on.
                if(err){ return outSourceCb(err); }

                data = registry.createEntity(data);
                
                outSourceCb(null, data );
            });
        }
    }
}


test('pull stream', async t => {
    try{
        const {registry,entitySet} = await initialise();

        entitySet.on('entity:add', (entities) => {
            Log.debug(`[global] entity:add`);
        });

        const ps = createESStream( entitySet, (err) => {
            Log.debug(`entityset stream closed`, err);
        } );
        // const stream = entitySet.createPullStream();

        Pull(ps, Pull.drain( (item,...args) => {
            // Log.debug(`[drain] received`, item, args );
            Log.debug(`[drain]`, item.toJSON());
        }));

        _.delay( () => {
            entitySet.addEntity([
                { '@c':'/name', 'name': 'donald'},
                { '@c':'/ttl', expires_at:2018 },
            ]);
            
            _.delay( () => {
                entitySet.addEntity([
                    { '@c':'/name', 'name': 'barry'},
                    { '@c':'/ttl', expires_at:2019 },
                ]);
                ps(true);
            }, 500 );
            
        }, 500);
        

        Log.debug(`finished?`);
        // pslog()( stream );
        
        t.end();
    } catch(err) {
        Log.error(err.stack);
    }
})


/**
 * attach the es pullstream (of existing components) to the result stream
 * attach events from the es so that new components continue to be output.
 * 
 */
function createESStream( entitySet, onClose ){
    // create a buffer for data
    // that have been pushed
    // but not yet pulled.
    let buffer = [];
    let abort, cb;

    // fill the buffer with the entitySets existing components
    // buffer = exportEntitySetComponents(entitySet);
    const esPullStream = entitySet.createPullStreamSource();
    let esPullStreamFinished = false;

    function read(_abort, _cb) {
        if (_abort) {
            Log.debug(`[read] abort called`);
            entitySet.off('entity:add', read.onEntityAdd, this );
            abort = _abort
            // if there is already a cb waiting, abort it.
            if (cb){ callback(abort); }
        }
        cb = _cb
        drain()
    }

    read.onEntityAdd = (entities) => {
        Log.debug(`[read.onEntityAdd]`);
        _.each( entities, e => {
            let components = e.getComponents();
            _.each( components, com => _.defer( () => read.push(com) ));
            // _.each( components, com => this.trigger('es:com', this.componentToJSON(com,cdefMap,anonymous) ));
            // this.trigger('es:e', {'@cmd':'entity'});
        });
    };

    let ended;
    read.end = (end) => {
        ended = ended || end || true
        // attempt to drain
        drain();
    };

    read.push = (data) => {
        if (ended){ return; }
        // if sink already waiting,
        // we can call back directly.
        if (cb) {
            callback(abort, data);
            return;
        }

        // otherwise push data and
        // attempt to drain
        buffer.push(data);
        drain();
    };

    // listen to entities being added
    entitySet.on('entity:add', read.onEntityAdd, read );

    return read;

    // `drain` calls back to (if any) waiting
    // sink with abort, end, or next data.
    function drain () {
        if (!cb){ return; }

        if (abort){ 
            return callback(abort); 
        }

        // if the entitysets pull stream has not yet finished,
        // then continue to return from there
        if( !esPullStreamFinished ){
            esPullStream(null, (esEnded,data) => {
                if( esEnded ){ 
                    Log.debug(`[drain] esPullStream ended`, esEnded,data );
                    esPullStreamFinished = true; 
                    return;
                }
                return callback(null,data);
            });
            return;
        }

        if (!buffer.length && ended){ 
            return callback(ended); 
        }
        if (buffer.length){ 
            return callback(null, buffer.shift()); 
        }
    }

    // `callback` calls back to waiting sink,
    // and removes references to sink cb.
    function callback (err, val) {
        let _cb = cb;
        // if error and pushable passed onClose, call it
        // the first time this stream ends or errors.
        if (err && onClose) {
            let c = onClose;
            onClose = null;
            c(err === true ? null : err)
        }
        cb = null;
        _cb(err, val);
    }
}


// function exportEntitySetComponents(entitySet,options={}){
//     const useDefUris = readProperty(options,'useDefUris',false);
//     const anonymous = readProperty(options,'anonymous',false);
//     let currentEntityId = -1;
//     const cdefMap = useDefUris ? entitySet.getSchemaRegistry().getComponentDefUris() : null;

//     const stream = entitySet.createPullStreamSource();
    
// }



async function initialise(options={}){
    const {loadEntities} = options;
    const registry = Registry.create();
    let entitySet = registry.createEntitySet(options);
    const loader = JSONLoader.create();

    if( isPromise(entitySet) ){
        entitySet = await Promise.resolve(entitySet);
    }

    Log.debug(`[initialise] created es`, entityToString(entitySet));

    await loader.load( commandsB, entitySet );

    if( loadEntities ){
        await loader.load( commandsA, entitySet );
    }
    
    return {registry,entitySet};
}


const commandsA = [
    { '@c':'/connection', 'addr': '192.3.0.1'},
    { '@c':'/ttl', expires_at:-300 },
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.2'},
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.3'},
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.4'},
    { '@c':'/ttl', expires_at:2000, 'comment':'b' },
    { '@cmd':"entity" },
    { '@c':'/connection', 'addr': '192.3.0.5'},
    { '@cmd':"entity" },
];

const commandsB = [
    { '@cmd':'register', 'uri':'/connection', properties:{addr:{type:'string'}} },
    { '@cmd':'register', 'uri':'/ttl', properties:{expires_at:{type:'number'}} },
    { '@cmd':'register', 'uri':'/dead'},
    { '@cmd':'register', 'uri':'/position', properties:{x:{type:'number'},y:{type:'number'},z:{type:'number'}}},
    { '@cmd':'register', 'uri':'/name', properties:{name:{type:'string'}}},
];
