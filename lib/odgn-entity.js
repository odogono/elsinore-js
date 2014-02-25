
var Elsinore = module.exports = {
    Entity: require('./entity'),
    EntitySet: require('./entity_set'),
    Component: require('./component'),
    ComponentDef: require('./component_def'),
    EntityProcessor: require('./entity_processor'),
    storage: { MemoryStorage:require('./memory_storage') },
    SchemaRegistry: require('./schema_registry'),
    Registry: require('./registry')
};