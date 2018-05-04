import { ALL, ANY, SOME, NONE, INCLUDE, EXCLUDE } from '../entity_filter';
export { ALL, ANY, SOME, NONE, INCLUDE, EXCLUDE } from '../entity_filter';

// export const ALL = 0; // entities must have all the specified components
// export const ANY = 1; // entities must have one or any of the specified components
// export const SOME = 2; // entities must have at least one of the specified component
// export const NONE = 3; // entities should not have any of the specified components
// export const INCLUDE = 4; // the filter will only include specified components
// export const EXCLUDE = 5; // the filter will exclude specified components
export const ROOT = 'RT'; // select the root entity set
export const EQUALS = '=='; // ==
export const NOT_EQUAL = '!='; // !=
export const LESS_THAN = '<'; // <
export const LESS_THAN_OR_EQUAL = '<=';
export const GREATER_THAN = '>'; // >
export const GREATER_THAN_OR_EQUAL = '>=';
export const AND = 13;
export const OR = 14;
export const NOT = 15;
export const VALUE = 'VL'; // a value
// export const FILTER = 17;
// export const ADD_ENTITIES = 18;
// export const ATTR = 19;
// export const PLUCK = 20;
// export const ALIAS = 21;
// export const DEBUG = 22;
// export const PRINT = 23;
// export const WITHOUT = 25;
// export const NOOP = 26;
export const LEFT_PAREN = 27;
export const RIGHT_PAREN = 28;
// export const MEMBER_OF = 29;
export const ENTITY_FILTER = 30;
// export const ALIAS_GET = 31;
// export const PIPE = 32;
// export const SELECT_BY_ID = 33;
export const ALL_FILTER = 'FA';
export const NONE_FILTER = 'FN';
export const FILTER_FUNC = 'FF';
export const ANY_FILTER = 'FY';
export const INCLUDE_FILTER = 'FI';
// });

