import _  from 'underscore';

import EventsAsync from './events.async';
// import {Events} from 'odgn-backbone-model';
import {createLog} from './log';
import {stringify} from './index';
import {toString as entityToString} from './to_string';

const Log = createLog('JSONExporter');



export class JSONExporter {
    constructor(options={}){
        Object.assign(this, EventsAsync);
    }

    attachEntitySet( entitySet, options={} ){
        // emit an initial event which will identify the current entityset
        this.trigger('es', {'@cmd':'es', uuid:entitySet.getUUID(), id:entitySet.id });

        this._releaseRegisteredComponents(entitySet);

        this._triggerExistingComponents(entitySet);

        this.listenTo(entitySet, 'entity:add', entities => {
            _.each( entities, e => {
                let components = e.getComponents();
                _.each( components, com => this.trigger('es:com', com.toJSON() ));
                this.trigger('es:e', {'@cmd':'entity'});
            });
        });

        this.listenTo(entitySet, 'component:add', components => {
            // _.each( components, com => this.trigger('es:add', com) );
        })

        // this.listenTo(entitySet, 'all', (name,...evtArgs) => {
        //     Log.debug('BLAH', name);
        //     this.trigger('es:com', ...evtArgs );
        // });
        
    }

    /**
     * 
     */
    _releaseRegisteredComponents(entitySet){
        const schemas = entitySet.getRegistry().getComponentDefs();

        schemas.forEach( schema => {
            let payload = {
                '@cmd':'register',
                ...schema.toJSON()
            }
            this.trigger('es:schema', payload );
        });
    }

    /**
     * https://github.com/Level/levelup#createReadStream
     */
    _triggerExistingComponents(entitySet, completeCb){
        let currentEntityId = -1;
        const cdefMap = entitySet.getSchemaRegistry().getComponentDefUris();

        entitySet.createReadStream()
            .on('data', (component) => {
                if( currentEntityId === -1 ){
                    currentEntityId = component.getEntityId();
                } else if( currentEntityId !== component.getEntityId() ){
                    this.trigger('es:e', {'@cmd':'entity'});
                    currentEntityId = component.getEntityId();
                }
                const payload = {
                    ...component.toJSON({cdefMap})
                };
                this.trigger('es:com', payload);
            })
            // .on('error', (err) => {
            //     // console.log('Oh my!', err)
            // })
            // .on('close', () => {
            //     // console.log('Stream closed')
            // })
            .on('end', () => {
                // flush final entity
                if( currentEntityId !== -1 ){
                    this.trigger('es:e', {'@cmd':'entity'});
                }
                // this.trigger('es:stream:end');
                if( completeCb ){
                    completeCb();
                }
            });
    }
}

function componentToJSON(component,entitySet,options={}){
    
}


JSONExporter.create = function(options={}){
    let result = new JSONExporter(options);
    return result;
}