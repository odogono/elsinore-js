export const COMPONENT_ID = '@i';
export const COMPONENT_URI = '@c';
export const COMPONENT_DEF_ID = '@s';
export const ENTITY_ID = '@e';
export const ENTITY_SET_ID = '@es';


export const COMPONENT_ADD = 'component:add';
export const COMPONENT_UPDATE = 'component:update';
export const COMPONENT_REMOVE = 'component:remove';
export const COMPONENT_CREATE = 'component:create';
export const COMPONENT_TYPE_ADD = 'type:add';

export const ENTITY_ADD = 'entity:add';
export const ENTITY_UPDATE = 'entity:update';
export const ENTITY_REMOVE = 'entity:remove';
export const ENTITY_EVENT = 'entity:event';

export const ENTITY_SET_ADD = 'entityset:add';

export const VIEW_CREATE = 'view:create';

export const COMPONENT_DEFINITION_ADD = 'def:add';
export const COMPONENT_DEFINITION_REMOVE = 'def:rem';

export const ENTITY_SET_COMPONENT = 'es:com';
export const ENTITY_SET_ENTITY = 'es:e';
export const ENTITY_SET_SCHEMA = 'es:schema';

export const COMMAND = '@cmd';


export const CMD_ENTITY_ADD = 0;
export const CMD_ENTITY_REMOVE = 1;
export const CMD_ENTITY_UPDATE = 2;
export const CMD_COMPONENT_ADD = 3;
export const CMD_COMPONENT_REMOVE = 4;
export const CMD_COMPONENT_UPDATE = 5;

// export const OP_ENTITY_NEW = 0;

// the entity id is valid, but the entity does not yet exist
export const OP_CREATE_FROM_EXISTING_ID = 1;
// a new entity is being created
export const OP_CREATE_NEW = 2;
// an existing entity is being updated
export const OP_UPDATE_EXISTING = 3;