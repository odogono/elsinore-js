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

// let LevelEntitySet = require('../../lib/entity_set_level');
export const LU = require('../../lib/entity_set_level/utils');

export const LevelEntitySet = require('../../lib/entity_set_level');


export function createEntitySet( registry, options ){
    let entitySet;
    let path;
    options = options || {};
    // let open = (options.open === undefined) ? true : options.open;
    let clearExisting = options.clear === undefined ? true : options.clear;
    options.leveldb = { path: Common.pathVarFile( (options.path || 'test/lvl/entity.ldb'), clearExisting ) };
    
    options.leveldb.db = require('memdown');
    // printIns( options.leveldb.db, 1);
    // options.leveldb = {db: require('memdown'), active:true};
    
    return (registry ? Promise.resolve(registry) : Common.initialiseRegistry( options ))
        .then( registry => registry.createEntitySet( LevelEntitySet, options ) )
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