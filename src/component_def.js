import Base from './base';

import stringify from './util/stringify';

import hash from './util/hash';
import { isObject } from './util/is';
import componentNameFromUri from './util/name_from_uri';

import { createLog } from './util/log';

const Log = createLog('ComponentDef', false);

export default function ComponentDef(attrs = {}, options) {
    // console.log('[ComponentDef]', 'creating with', attrs );
    this.id = attrs.id;
    this.properties = attrs.properties;
    this.attrs = createAttrsFromProperties(this.properties);
    this.uri = attrs.uri;
    this.name = attrs.name || componentNameFromUri(this.uri);
    this.componentType = attrs.type || attrs.componentType;
    this.options = attrs.options || options;
}

Object.assign(ComponentDef.prototype, Base.prototype, {
    // export default class ComponentDef extends Base {
    // constructor(attrs, options) {
    //     attrs.attrs = createAttrsFromProperties(attrs.properties);

    //     if (!attrs.name) {
    //         attrs.name = componentNameFromUri(attrs.uri);
    //     }

    //     super(attrs, options);
    // }

    getUri() {
        return this.uri;
    },

    getName() {
        return this.name;
    },

    getType() {
        return this.componentType;
    },

    getAttrs() {
        return this.attrs;
    },

    getProperties() {
        return this.properties;
    },

    toJSON(...args) {
        let result = { id: this.id, name: this.name, uri: this.uri }; //  //Model.prototype.toJSON.apply(this, args);
        if( this.properties !== undefined ){
            result.properties = this.properties;
        }
        // delete result.attrs;
        return result;
    },

    hash(asString = true) {
        let result;
        result = hash(stringify(this.getProperties()) + ':' + this.getName(), asString);
        return result;
    }
});

ComponentDef.prototype.type = 'ComponentDef';
ComponentDef.prototype.isComponentDef = true;

/**
 *
 * @param {*} props
 */
function createAttrsFromProperties(props) {
    let name, property, value;
    let result = {};
    if (!props) {
        return result;
    }

    for (name in props) {
        value = props[name];
        property = value;
        if (isObject(value)) {
            if (value.default !== void 0) {
                value = property.default;
            } else if (value.type !== void 0) {
                switch (value.type) {
                    case 'integer':
                        value = 0;
                        break;
                    case 'string':
                        value = '';
                        break;
                    case 'boolean':
                        value = false;
                        break;
                    default:
                        value = null;
                        break;
                }
            }
        }
        result[name] = value;
    }

    return result;
}
