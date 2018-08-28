// import { EntityProcessor } from '../entity_processor';
import { stringify } from './stringify';
import { isCollection, isComponent, isEntity, isEntitySet } from './is';

import { getEntityIDFromID } from './id';

/**
 *
 * @param {*} entity
 * @param {*} indent
 */
export function entityToString(entity, indent = '') {
    if (!entity) {
        return [];
    }
    let res = [];
    let comDefID;

    res.push(`${indent}- ${entity.cid} (${entity.getEntityID()}/${entity.getEntitySetID()}) ${entity.hash(true)}`);

    indent += '  ';

    for (comDefID in entity.components) {
        res.push(componentToString(entity.components[comDefID], indent));
    }
    return res;
}

/**
 *
 * @param {*} component
 * @param {*} indent
 */
export function componentToString(component, indent = '') {
    let componentJSON;

    if (!component) {
        return;
    }

    componentJSON = stringify(component);
    const cCid = component.cid;
    const componentID = component.id || 0;
    const cDefID = component.getDefID();
    const cName = component.name;
    const entityID = getEntityIDFromID(component.getEntityID());
    const componentHash = component.hash(true);

    return `${indent}${cCid} (${componentID}) ${cName}(${cDefID}) e:${entityID} ${componentHash} ${componentJSON}`;
}

/**
 *
 * @param {*} es
 * @param {*} indent
 */
export function entitySetToString(es, indent) {
    let entity;
    let res = [];
    let it;

    it = es.iterator();
    indent || (indent = '');

    res.push(`${indent}- ${es.cid} (${es.id}) ${es.getUUID()}`);
    indent = indent + '  ';

    if (es.entityFilters) {
        es.entityFilters.forEach(ef => res.push(indent + 'ef( ' + ef.toString() + ' )'));
    }

    while ((entity = it.next().value)) {
        res = res.concat(entityToString(entity, indent));
    }

    return res;
}

export function toString(entity, indent = '', join = '\n') {
    let res = [''];

    if (Array.isArray(entity)) {
        entity.forEach(e => (res = res.concat(toString(e, '  ', ' '))));
    } else if (entity._esToString) {
        res = res.concat(entity._esToString(indent)); //  entitySetToString(entity.entitySet, indent));
    } else if (isEntity(entity)) {
        res = res.concat(entityToString(entity, indent));
    } else if (isComponent(entity)) {
        res = res.concat(componentToString(entity, indent));
    } else if (isEntitySet(entity) || entity.type == 'EntitySetReadOnlyView') {
        res = res.concat(entitySetToString(entity, indent));
    } else if (isCollection(entity)) {
        entity.each(item => {
            res = res.concat(toString(item, '  '));
        });
    }
    return res.join(join);
}
