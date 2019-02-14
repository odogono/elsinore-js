import { Component } from './component';

export type EntityID = number;
export type EntitySetID = number;
export type ComponentID = number;
export type ComponentDefID = number;

export type EntityCommand = [ Command, EntityID, Component, object ];


export interface EntityCommandBuffer {
    [entityID: string]: EntityCommand[]
};


export const COMPONENT_ID = '@i';
export const COMPONENT_URI = '@c';
export const COMPONENT_DEF_ID = '@s';
export const ENTITY_ID = '@e';
export const ENTITY_SET_ID = '@es';


export const enum EntityEvent {
    ComponentAdd = 'component:add',
    ComponentUpdate = 'component:update',
    ComponentRemove = 'component:remove',
    ComponentCreate = 'component:create',
    ComponentTypeAdd = 'type:add',
    ComponentDefAdd = 'def:add',
    ComponentDefRemove = 'def:remove',

    EntityAdd = 'entity:add',
    EntityUpdate = 'entity:update',
    EntityRemove = 'entity:remove',
    EntityEvent = 'entity:event',

    EntitySetAdd = 'entityset:add',

    ViewCreate = 'view:create'
};

// export const COMPONENT_ADD = 'component:add';
// export const COMPONENT_UPDATE = 'component:update';
// export const COMPONENT_REMOVE = 'component:remove';
// export const COMPONENT_CREATE = 'component:create';
// export const COMPONENT_TYPE_ADD = 'type:add';

// export const ENTITY_ADD = 'entity:add';
// export const ENTITY_UPDATE = 'entity:update';
// export const ENTITY_REMOVE = 'entity:remove';
// export const ENTITY_EVENT = 'entity:event';

// export const ENTITY_SET_ADD = 'entityset:add';

export const COMPONENT_DEFINITION_ADD = 'def:add';
export const COMPONENT_DEFINITION_REMOVE = 'def:rem';

export const ENTITY_SET_COMPONENT = 'es:com';
export const ENTITY_SET_ENTITY = 'es:e';
export const ENTITY_SET_SCHEMA = 'es:schema';


// export const OP_ENTITY_NEW = 0;

// the entity id is valid, but the entity does not yet exist
export const OP_CREATE_FROM_EXISTING_ID = 1;
// a new entity is being created
export const OP_CREATE_NEW = 2;
// an existing entity is being updated
export const OP_UPDATE_EXISTING = 3;

export const enum State {
    Closed = 0,
    Opening = 1,
    Open = 2,
    Failed = 3
};

// export const STATE_CLOSED = 0;
// export const STATE_OPENING = 1;
// export const STATE_OPEN = 2;
// export const STATE_FAILED = 3;

// JSONLoader commands

export const LCMD_COMMAND = '@cmd';
export const LCMD_UNKNOWN = '@unk';
export const LCMD_ADD_ENTITY = 'entity';
export const LCMD_REGISTER_COMPONENT = 'register';
export const LCMD_REMOVE_ENTITY = 'rme';
export const LCMD_REMOVE_COMPONENT = 'rmc';
export const LCMD_END_OF_EXISTING = 'eoe';


export const enum Command {
    EntityAdd = 0,
    EntityRemove = 1,
    EntityUpdate = 2,
    ComponentAdd = 3,
    ComponentRemove = 4,
    ComponentUpdate = 5
};



// export { ALL, ANY, SOME, NONE, INCLUDE, EXCLUDE } from '../entity_filter';
// import { EntityFilterType } from './entity_filter';
export { EntityFilterType } from './entity_filter';

// export const ALL = 0; // entities must have all the specified components
// export const ANY = 1; // entities must have one or any of the specified components
// export const SOME = 2; // entities must have at least one of the specified component
// export const NONE = 3; // entities should not have any of the specified components
// export const INCLUDE = 4; // the filter will only include specified components
// export const EXCLUDE = 5; // the filter will exclude specified components
// export const ROOT = 'RT'; // select the root entity set
// export const EQUALS = '=='; // ==
// export const NOT_EQUAL = '!='; // !=
// export const LESS_THAN = '<'; // <
// export const LESS_THAN_OR_EQUAL = '<=';
// export const GREATER_THAN = '>'; // >
// export const GREATER_THAN_OR_EQUAL = '>=';
// export const AND = 13;
// export const OR = 14;
// export const NOT = 15;
// export const VALUE = 'VL'; // a value
// export const FILTER = 17;
// export const ADD_ENTITIES = 18;
// export const ATTR = 19;
// export const PLUCK = 20;
// export const ALIAS = 21;
// export const DEBUG = 22;
// export const PRINT = 23;
// export const WITHOUT = 25;
// export const NOOP = 26;
// export const LEFT_PAREN = 27;
// export const RIGHT_PAREN = 28;
// export const MEMBER_OF = 29;
// export const ENTITY_FILTER = 30;
// export const ALIAS_GET = 31;
// export const PIPE = 32;
// export const SELECT_BY_ID = 33;


// export const ALL_FILTER = 'FA';
// export const NONE_FILTER = 'FN';
// export const FILTER_FUNC = 'FF';
// export const ANY_FILTER = 'FY';
// export const INCLUDE_FILTER = 'FI';
// });


export const enum QueryOp {
    Root = 'RT',
    Equals = '==',
    NotEqual = '!=',
    LessThan = '<',
    LessThanOrEqual = '<=',
    GreaterThan = '>',
    GreaterThanOrEqual = '>=',
    And = '&&',
    Or = '||',
    Not = '!!',
    Value = 'VL',
    LeftParen = '(',
    RightParen = ')',
    EntityFilter = 'EF',
    AllFilter = 'FA',
    NoneFilter = 'FN',
};


// type QueryOp = EntityFilterType | BaseQueryOp;