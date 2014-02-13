
var Elsinore = module.exports = {
    Entity: require('./entity'),
    EntitySet: require('./entity_set'),
    Component: require('./component'),
    ComponentDef: require('./component_def'),
    EntitySystem: require('./entity_system'),
    storage: { MemoryStorage:require('./memory_storage') },
    Schema: require('./schema'),
    Registry: require('./registry')
};