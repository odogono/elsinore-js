import Entity from '../entity';
import Component from '../component';
import {cloneComponent, cloneEntity } from '../util/clone';
// import readProperty from '../util/read_property';
import { JSONLoader } from '../util/loader';
import { toString as entityToString } from '../util/to_string';
import stringify from '../util/stringify';
import { createLog } from '../util/log';
import {COMMAND} from '../constants';

const Log = createLog('EntitySetSink');

/**
 * pull-stream sink - takes incoming components and adds to the entity set
 */

/**
 * A pull-stream sink which interprets incoming objects into
 * commands that affect the given entitySet
 * 
 * @param {*} entitySet 
 * @param {*} options 
 * @param {Function} completeCb 
 */
export function PullStreamSink(entitySet, options = {}, completeCb) {
    let result = [];
    const loader = JSONLoader.create();
    let context = { entitySet, registry: entitySet.getRegistry() };
    const { source, did } = options;

    let addEntityOptions = {};
    if( source ){
        addEntityOptions.oid = source.cid;
    }

    return function(read) {
        read(null, function next(end, data) {
            // console.log('[stringSink]', end, stringify(data));

            if (end === true) {
                result = [].concat.apply([], result);
                return completeCb ? completeCb(result.length === 1 ? result[0] : result) : null;
            }
            if (end) {
                throw end;
            }

            try {
                let p;
                let [item,itemOptions] = data; 

                // check whether the incoming data has an OriginID and whether
                // that OID matches the entitySet to which we are connected. 
                // if they do match, then disregard the event, as it originally came
                // from the entitySet - an echo!
                if( itemOptions.oid == entitySet.cid ){
                    // Log.debug('🐸 [sink][Entity]', `looks like origin ${itemOptions.oid} is same as target ${entitySet.cid}`);
                    return read(null, next);
                }

                if (Component.isComponent(item)) {
                    
                    p = entitySet.addComponent( item );

                } else if (Entity.isEntity(item)) {
                    
                    // Log.debug('🦊 [sink][Entity]', source.cid,'>',entitySet.cid, itemOptions, item.getComponents().map(c=>[c.id,c.cid]));
                    
                    p = entitySet.addEntity(item, addEntityOptions ); // '🐰'

                    // Log.debug('🐵 [sink][Entity]',p);

                    // let added = entitySet.getUpdatedEntities();
                    // if( added ) Log.debug('🐷 [sink][Entity]', added.cid, added.getComponents().map(c=>c.cid) );
                    // if( added ) Log.debug('🐷 [sink][Entity]', data == added, data.msg, added.msg );
                } else {
                    // Log.debug('[sink][_processCommand]', entitySet.cid, item);
                    if( item[COMMAND] == 'rmc' ){
                        // Log.debug('[sink][_processCommand]', entitySet._components);
                    }
                    p = loader._processCommand(context, item, options);
                }
                if (p instanceof Promise) {
                    p.then(() => read(null, next));
                } else {
                    read(null, next);
                }
            } catch (err) {
                Log.error('[read] error', err);
                read(null, next);
            }
        });
    };
}
