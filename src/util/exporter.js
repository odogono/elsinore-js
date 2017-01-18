import _  from 'underscore';

import EventsAsync from './events.async';
// import {Events} from 'odgn-backbone-model';
import {createLog} from './log';
import {stringify} from './index';
import {toString as entityToString} from './to_string';
import {readProperty} from './index';

const Log = createLog('JSONExporter');




export class JSONExporter {
    constructor(options={}){
        Object.assign(this, EventsAsync);
    }


    /**
     * anonymous - components will be emitted without an id or entity id (default:false)
     */
    attachEntitySet( entitySet, options={} ){
        const triggerDefs = readProperty(options,'triggerDefs',true);
        const triggerExisting = readProperty(options,'triggerExisting',true);
        const anonymous = readProperty(options,'anonymous',false);
        const useDefUris = readProperty(options,'useDefUris',false);

        // emit an initial event which will identify the current entityset
        this.trigger('es', {'@cmd':'es', uuid:entitySet.getUUID(), id:entitySet.id });

        if( triggerDefs ){
            this._triggerComponentDefs(entitySet);
        }

        if( triggerExisting ){
            this._triggerExistingComponents(entitySet, options);
        }

        this.listenTo(entitySet, 'entity:add', entities => {
            const cdefMap = useDefUris ? entitySet.getSchemaRegistry().getComponentDefUris() : null;
            _.each( entities, e => {
                let components = e.getComponents();
                _.each( components, com => this.trigger('es:com', this.componentToJSON(com,cdefMap,anonymous) ));
                this.trigger('es:e', {'@cmd':'entity'});
            });
        });

        this.listenTo(entitySet, 'component:add', components => {
            // _.each( components, com => this.trigger('es:add', com) );
        })
    }

    /**
     * 
     */
    _triggerComponentDefs(entitySet){
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
     * 
     * useDefUris - components will be emitted with their full uri (default: false)
     * anonymous - components will be emitted without an id or entity id (default:false)
     * 
     */
    _triggerExistingComponents(entitySet, options={}){
        const useDefUris = readProperty(options,'useDefUris',false);
        const anonymous = readProperty(options,'anonymous',false);

        let currentEntityId = -1;
        const cdefMap = useDefUris ? entitySet.getSchemaRegistry().getComponentDefUris() : null;

        entitySet.createReadStream()
            .on('data', (component) => {
                if( currentEntityId === -1 ){
                    currentEntityId = component.getEntityId();
                } else if( currentEntityId !== component.getEntityId() ){
                    if( anonymous ){
                        this.trigger('es:e', {'@cmd':'entity'});
                    }
                    currentEntityId = component.getEntityId();
                }
                
                const payload = {
                    ...this.componentToJSON(component,cdefMap,anonymous)
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
                if( anonymous && currentEntityId !== -1 ){
                    this.trigger('es:e', {'@cmd':'entity'});
                }
            });
    }

    /**
     * Converts a component to JSON representation
     * 
     * @param component
     * @param cdefMap
     * @param {boolean} anonymous
     * @param options
     */
    componentToJSON(component,cdefMap,anonymous,options={}){
        const json = component.toJSON({cdefMap});
        if( anonymous ){
            delete json['@e'];
            delete json['@i'];
        }
        return json;
    }
}




JSONExporter.create = function(options={}){
    let result = new JSONExporter(options);
    return result;
}