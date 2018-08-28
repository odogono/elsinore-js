import { Base } from '../base';
import { createLog } from './log';
import { stringify } from './stringify';
import { toString as entityToString } from './to_string';
import { readProperty } from './read_property';

const Log = createLog('JSONExporter');

import {
    COMMAND,
    ENTITY_ADD,
    ENTITY_ID,
    COMPONENT_ID,
    ENTITY_SET_COMPONENT,
    ENTITY_SET_ENTITY,
    ENTITY_SET_SCHEMA
} from '../constants';

export function JSONExporter(options = {}) {}

Object.assign(JSONExporter.prototype, Base.prototype, {
    /**
     * anonymous - components will be emitted without an id or entity id (default:false)
     */
    attachEntitySet(entitySet, options = {}) {
        const triggerDefs = readProperty(options, 'triggerDefs', true);
        const triggerExisting = readProperty(options, 'triggerExisting', true);
        const anonymous = readProperty(options, 'anonymous', false);
        const useDefUris = readProperty(options, 'useDefUris', false);

        // emit an initial event which will identify the current entityset
        this.trigger('es', { [COMMAND]: 'es', uuid: entitySet.getUUID(), id: entitySet.id });

        if (triggerDefs) {
            this._triggerComponentDefs(entitySet);
        }

        if (triggerExisting) {
            this._triggerExistingComponents(entitySet, options);
        }

        this.listenTo(entitySet, ENTITY_ADD, entities => {
            const cdefMap = useDefUris ? entitySet.getComponentRegistry().getComponentDefUris() : null;
            entities.forEach(e => {
                let components = e.getComponents();
                components.forEach(com =>
                    this.trigger(ENTITY_SET_COMPONENT, this.componentToJSON(com, cdefMap, anonymous))
                );
                this.trigger(ENTITY_SET_ENTITY, { [COMMAND]: 'entity' });
            });
        });

        // this.listenTo(entitySet, 'component:add', components => {
        //     // components.forEach( com => this.trigger('es:add', com) );
        // })
    },

    /**
     *
     */
    _triggerComponentDefs(entitySet) {
        const schemas = entitySet.getRegistry().getComponentDefs();

        schemas.forEach(schema => {
            let payload = {
                [COMMAND]: 'register',
                ...schema.toJSON()
            };
            this.trigger(ENTITY_SET_SCHEMA, payload);
        });
    },

    /**
     * https://github.com/Level/levelup#createReadStream
     *
     * useDefUris - components will be emitted with their full uri (default: false)
     * anonymous - components will be emitted without an id or entity id (default:false)
     *
     */
    _triggerExistingComponents(entitySet, options = {}) {
        const useDefUris = readProperty(options, 'useDefUris', false);
        const anonymous = readProperty(options, 'anonymous', false);

        let currentEntityID = -1;
        const cdefMap = useDefUris ? entitySet.getComponentRegistry().getComponentDefUris() : null;

        const stream = entitySet.createPullStream();

        // stream( null, (end,component) => {
        //     if( end == true ){

        //         return;
        //     }
        // })

        entitySet
            .createReadStream()
            .on('data', component => {
                if (currentEntityID === -1) {
                    currentEntityID = component.getEntityID();
                } else if (currentEntityID !== component.getEntityID()) {
                    if (anonymous) {
                        this.trigger(ENTITY_SET_ENTITY, { [COMMAND]: 'entity' });
                    }
                    currentEntityID = component.getEntityID();
                }

                const payload = {
                    ...this.componentToJSON(component, cdefMap, anonymous)
                };
                this.trigger(ENTITY_SET_COMPONENT, payload);
            })
            // .on('error', (err) => {
            //     // console.log('Oh my!', err)
            // })
            // .on('close', () => {
            //     // console.log('Stream closed')
            // })
            .on('end', () => {
                // flush final entity
                if (anonymous && currentEntityID !== -1) {
                    this.trigger(ENTITY_SET_ENTITY, { [COMMAND]: 'entity' });
                }
            });
    },

    /**
     * Converts a component to JSON representation
     *
     * @param component
     * @param cdefMap
     * @param {boolean} anonymous
     * @param options
     */
    componentToJSON(component, cdefMap, anonymous, options = {}) {
        const json = component.toJSON({ cdefMap });
        if (anonymous) {
            delete json[ENTITY_ID];
            delete json[COMPONENT_ID];
        }
        return json;
    }
});

JSONExporter.create = function(options = {}) {
    return new JSONExporter(options);
};
