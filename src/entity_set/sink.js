import Entity from '../entity';
import Component from '../component';
// import readProperty from '../util/read_property';
import { JSONLoader } from '../util/loader';
import { toString as entityToString } from '../util/to_string';
// import stringify from '../util/stringify';
import { createLog } from '../util/log';

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
 * @param {*} completeCb 
 */
export default function sink(entitySet, options = {}, completeCb) {
    let result = [];
    const loader = JSONLoader.create();
    let context = { entitySet, registry: entitySet.getRegistry() };
    const { source, did } = options;

    return function(read) {
        read(null, function next(end, data) {
            // console.log('[stringSink]', end, data);

            if (end === true) {
                result = [].concat.apply([], result);
                return completeCb ? completeCb(result.length === 1 ? result[0] : result) : null;
            }
            if (end) {
                throw end;
            }

            try {
                let p;

                if (Component.isComponent(data)) {
                    p = entitySet.addComponent(data);
                } else if (Entity.isEntity(data)) {
                    p = entitySet.addEntity(data);
                } else {
                    p = loader._processCommand(context, data, options);
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
