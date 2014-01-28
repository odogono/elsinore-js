
var Elsinore = module.exports = {
    storage: { MemoryStorage:require('./memory_storage') },
    Schema: require('./schema'),
    Registry: require('./registry'),
    Entity: require('./entity'),
    EntitySet: require('./entity_set'),
    Component: require('./component'),
    EntitySystem: require('./entity_system')
};