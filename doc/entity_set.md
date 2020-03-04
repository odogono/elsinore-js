# EntitySet


- adding a component to an entityset

- adding an entity to an entityset

- what was added in terms of entities and components?



- registry.createEntitySet
    + instance is created using specified class (default to MemoryES)
    + internal/external id is assigned
    + if MemoryES
        * registry adds to list of ES
        * registry event 'entityset:add'
        * return
    + call ES.open
        * initialisation of data structs. ES reads existing id
        * existing ComponentDefs loaded and registered with the registry
    + registry notifies ES of existing ComponentDefs
        * each ComponentDef in schemaRegistry
            * call ES.registerComponentDef
    + registry adds to list of ES
    + registry event 'entityset:add'

- registry.removeEntitySet
    + if MemoryES
        * removes from internal list of ES
        * registry event 'removeEntitySet'
        * return
    + call ES.close
    + remove from internal list of ES
    + registry event 'entityset:remove'
