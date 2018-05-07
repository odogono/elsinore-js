// import { EntityProcessor } from '../entity_processor';
import { stringify } from './stringify';
import { isCollection, isComponent, isEntity, isEntitySet } from './is';

import { getEntityIdFromId } from './id';

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
    let comDefId;

    res.push(`${indent}- ${entity.cid} (${entity.getEntityId()}/${entity.getEntitySetId()}) ${entity.hash(true)}`);

    indent += '  ';

    for (comDefId in entity.components) {
        res.push(componentToString(entity.components[comDefId], indent));
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
    const componentId = component.id || 0;
    const cDefId = component.getDefId();
    const cName = component.name;
    const entityId = getEntityIdFromId(component.getEntityId());
    const componentHash = component.hash(true);

    return `${indent}${cCid} (${componentId}) ${cName}(${cDefId}) e:${entityId} ${componentHash} ${componentJSON}`;
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
