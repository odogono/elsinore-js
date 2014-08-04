
var Elsinore = module.exports = {
    BitField: require('./bit_field'),
    Entity: require('./entity'),
    EntityFilter: require('./entity_filter'),
    EntitySet: require('./entity_set'),
    Component: require('./component'),
    ComponentDef: require('./component_def'),
    ComponentPool: require('./component_pool'),
    EntityProcessor: require('./entity_processor'),
    storage: { MemoryStorage:require('./memory_storage') },
    SchemaRegistry: require('./schema_registry'),
    Registry: require('./registry'),
    Utils: require('./utils')
};