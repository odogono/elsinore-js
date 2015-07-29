'use strict';

// let Promise = require('bluebird');
let _ = require('underscore');
let test = require('tape');

export const Common = require('../common');
// let Common = require('../common');
let PromiseQ = require('promise-queue');

let Es = require('event-stream');
let Sinon = require('sinon');

export const Elsinore = require('../../lib');

let EntityFilter = Elsinore.EntityFilter;
let EntitySet = Elsinore.EntitySet;
let Entity = Elsinore.Entity;
let Query = Elsinore.Query;
let Registry = Elsinore.Registry;
let Utils = Elsinore.Utils;


export const LevelEntitySet = require('../../lib/entity_set_level');
export const LU = require('../../lib/entity_set_level/utils');




export function createEntitySet( registry, options ){
    let entitySet;
    let path;
    // let registry;
    options = options || {};
    // let open = (options.open === undefined) ? true : options.open;
    let clearExisting = options.clear === undefined ? true : options.clear;
    let loadEntities = options.loadEntities === undefined ? false : options.loadEntities;
    let logEvents = options.logEvents === undefined ? false : options.logEvents;
    options.leveldb = { path: Common.pathVarFile( (options.path || 'test/lvl/entity.ldb'), clearExisting ) };
    
    options.leveldb.db = require('memdown');
    // printIns( options.leveldb.db, 1);
    // options.leveldb = {db: require('memdown'), active:true};

    // 
    
    return (registry ? Promise.resolve(registry) : Common.initialiseRegistry( options ))
        .then( reg => { registry = reg; return registry.createEntitySet(LevelEntitySet, options) })
        .then( es => {
            if( logEvents ){
                Common.logEvents( es );
            }

            if( loadEntities ){
                let entitySet = Common.loadEntities( registry, (loadEntities||'query.entities') );
                // printE( entitySet );
                return es.addEntity( entitySet )
                    .then( () => es )
            }
            return es;
        });

        // .then( entitySet => {
        //     // if( open ){ return entitySet.open(options); }
        //     return entitySet;
        // })
        // .then( entitySet => {
        //     // NOTE: MemDOWN does not appear to clear itself between uses
        //     if( open && clearExisting ){
        //         return entitySet.clear();
        //     }
        //     return entitySet;
        // })
}


export function printKeys( entitySet, key, options ){
    if( _.isObject(key) ){
        options = key;
        key = null;
    }
    options = options || {};
    if( key ){
        options.gte = key + LU.KEY_START,
        options.lte = key + LU.KEY_LAST
    }
    return LU.printKeys( entitySet._db, entitySet._pQ, options )
        .then( () => entitySet );
}

export function destroyEntitySet( entitySet, clear ){
    let registry = entitySet.getRegistry();
    
    return Promise.resolve(entitySet)
        .then( () => {
            if( clear ){
                return entitySet.clear()
            }
            return entitySet;
        })
        .then( () =>  registry.removeEntitySet(entitySet) )
        .then( () => entitySet )
        .catch( err => { log.debug('error: ' + err ); log.debug( err.stack );} )
}