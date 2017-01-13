import _ from 'underscore';

import Fs from 'fs';
import Es from 'event-stream';
import Path from 'path';
import Util from 'util';

import Sh from 'shelljs';

const rootDir = Path.join( Path.dirname(__filename), '../../' );
const fixtureDir = Path.join( rootDir, 'test', 'fixtures' );
const varDir = Path.join( rootDir, 'var' );

const ElsinoreDir = Path.join(rootDir, 'src')

import {stringify} from '../../src/util';

export {
    isInteger,
    printIns,
    toPascalCase,
    parseUri,
    getEntityIdFromId,
    getEntitySetIdFromId,
    stringify,
    setEntityIdFromId} from '../../src/util';

import {createLog} from '../../src/util/log';
export {createLog} from '../../src/util/log';
export {toString as entityToString} from '../../src/util/to_string';

import Component from '../../src/component';
export {Component as Component};

import * as EntityFilter from '../../src/entity_filter';
export {EntityFilter as EntityFilter};

import EntityProcessor from '../../src/entity_processor';
export {EntityProcessor as EntityProcessor};

import EntitySet from '../../src/entity_set';
export {EntitySet as EntitySet};

import Entity from '../../src/entity';
export {Entity as Entity};

import Query from '../../src/query/full';
export {Query as Query};

import Registry from '../../src/registry/processor';
export {Registry as Registry};

import SchemaRegistry from '../../src/schema';
export {SchemaRegistry as SchemaRegistry};

import Dispatch from '../../src/dispatch';
export {Dispatch as Dispatch};

const Log = createLog('Test');


export function pathVar( path, clear ){
    path = Path.join( varDir, path );
    if( clear ){ Sh.rm('-rf', path ); }
    Sh.mkdir('-p', path );
    return path;
}

export function pathVarFile( path, clear ){
    path = Path.join( varDir, path );
    if( clear ){ 
        // log.debug('clearing ' + path );
        Sh.rm('-rf', path ); 
    }
    Sh.mkdir('-p', Path.dirname(path) );
    return path;
}

// compile a map of schema id(uri) to schema
export function loadComponents(options={}){
    let data = loadFixtureJSON( 'components.json' );
    if( options.returnAsMap ){
        return _.reduce( data, 
                            function(memo, entry){
                                memo[ entry.uri ] = entry;
                                return memo;
                            }, {});
    }
    return data;
}

/**
*   Returns an entityset with the given entities
*/
export function loadEntities( registry, fixtureName, entitySet, options ){
    let data;
    let lines;
    let result;

    fixtureName = fixtureName || 'entity_set.entities.json';
    registry = registry || initialiseRegistry( options );
    result = registry.createEntitySet( _.extend( {instanceClass:entitySet}, options) );

    if( _.isString(fixtureName) ){
        if( fixtureName.indexOf('.json') === -1 ){
            fixtureName = fixtureName + '.json';
        }
        data = loadFixture( fixtureName );
        data = JSON.parse( data );
    }
    else if( _.isObject(fixtureName) ){
        data = fixtureName;
    } else {
        throw new Error('invalid fixture name specified');
    }

    _.each( data, line => {
        let com = registry.createComponent( line );
        result.addComponent( com );
        return com;
    });

    return result;
}

/**
*
*/
export async function initialiseRegistry( doLogEvents ){
    let componentData;
    let registry = new Registry();
    let options, load;

    if( _.isObject(doLogEvents) ){
        options = doLogEvents;
        doLogEvents = options.doLogEvents;
    }
    if( doLogEvents ){
        // log.debug('logging events');
        logEvents( registry );
    }

    options = (options || {});
    load = options.loadComponents === void 0 ? true : options.loadComponents;

    if( load ){
        componentData = loadComponents();
        // log.debug('loaded components ', componentData);// + JSON.stringify(options) );
        // printIns( componentData );
        await registry.registerComponent(componentData, options);
    }

    return registry;
}


export function createFixtureReadStream( fixturePath ){
    let path = Path.join( fixtureDir, fixturePath );
    return Fs.createReadStream( path, { encoding: 'utf-8' })
        .pipe(Es.split())
        .pipe(Es.parse());
}

export function loadFixture( fixturePath ){
    let path = Path.join( fixtureDir, fixturePath );
    // console.log('loadFixture', path);
    let data = Fs.readFileSync( path, 'utf8');
    return data;
}

export function loadFixtureJSON( fixturePath ){
    try {
        let data = loadFixture( fixturePath );
        data = JSON.parse( data );
        return data;
    } catch( e ){
        log.debug('error loading fixture JSON: ' + e );
        return null;
    }
}

export function logEvents(obj, prefix='evt'){
    obj.on('all', function(evt){
        Log.debug(prefix + ' ' + stringify( _.toArray(arguments) ) );
    });
}



const toStringPath = Path.join(ElsinoreDir, 'util/to_string');

export function printE(e, prefix=''){
    Util.log( prefix, entityToString(e) );
}

// global.log = {
//     debug: console.log,
//     error: console.log
// };

export function requireLib( path ){
    return require( Path.join(ElsinoreDir,path) );
}