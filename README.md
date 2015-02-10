
A Javascript Entity Component system.





```javascript
    registry.createEntity({"_e":1, "_s":"/component/position", "x":10, "y":-10}).done( function(entity){ });
```
will return an entity with an id of 1, or will return the existing entity with the new component



A Registry instance is required to manage entities and components:

    Registry.create().done( function(newRegistry){ });

returns a promise for a new entity instance:

    registry.createEntity().done( function(newEntity){ });

to assign data to an entity, a component should be created by first registering it:

```javascript
    var componentSchema = {
        "id": '/component/position'
        "properties":{
            "x":{ "type":"number",  },
            "y":{ "type":"number" }
        }
    };

    registry.registerComponent(componentSchema).done( function(componentDef){ });
```

the component can then be added to the entity using its id:

```javascript
    registry.addComponent( '/component/position', entity ).done( function(componentInstance){ });
```

or

```javascript
    entity.addComponent( '/component/position' ).done( function(componentInstance){ });
```

and retrieved:

```javascript
    registry.getComponent( '/component/position', entity ).done( function(componentInstance){ });
```
or
```javascript
    entity.getComponent( '/component/position' ).done( function(componentInstance){ });
```

or removed:

```javascript
    registry.removeComponent( '/component/position', entity ).done( function(entity){ });
```

Entities can also be created with components already attached:

```javascript
    registry.createEntity( ['position','velocity'] ).done( function(entity){ });
```

Which is the same as:

```javascript
    registry.createEntity()
    registry.addComponent('position', entity)
    registry.addComponent('velocity', entity)
```

and then referenced:

```javascript
    entity.Position.get('x');
    entity.Velocity.get('y');
```

EntitySets are collections of entities.

```javascript
    registry.createEntitySet().done( function(entitySet){ });
```

which can be iterated through

```javascript
    entitySet.forEach( function(entity){ });
```




```javascript
{
    "id":"/component/child/example",
    "properties":{
        "entity_id":{ "type":"integer", "format":"entity_id" }
    }
}

    parent = registry.createEntity({id:254}).done();
```

add component to child:

```javascript
    child = registry.createEntity().done();
    child.addComponent( '/component/child/example', {entity_id:254} ).done();
```

parent retrieves children:

```javascript
    entity.getEntities( '/component/child/example' ).done( function(entities){} );
    registry.getEntities( {schemaId:'/component/child/example',entity_id:254} ).done( function(entities){} );
```

the argument to getChildEntities is a component matcher. The parents id is added to the matcher


### Entity Schemas

schemas define what properties a given component has, what types those properties are and what defaults they have if any.

schemas are identified primarily by a schema id, which takes the form of a uri path - eg, '/component/position'

schemas can change, and so therefore are versioned using a hashcode. the hashcode is derived from the properties of the schema. 

Components reference the hashcode, not the id.

?should the hashcode contain a version number and a date?


### Entity Set

An EntitySet is like a recordset for a db query. And in fact Elsinore makes it straightforward to allow
custom EntitySets to directly query the storage to which they are attached.

An in-memory container for a set of entities and their associated components.

Processors operate on the entities contained within an EntitySet.

Components can be added and removed from an ES. Their entities are added at the same time, if they dont
already exist. 

ES may have paging controls, which sets a limit on the number of entities contained.

ES emit events for entities and components being added and removed and changed.

The default behaviour for an ES is to allow all components to be added. The ES has a ComponentDef bitfield
which controls which components get added. There is also a function which controls whether a component
is added which can be overriden.

An ES can be reset and cleared.

Linking an ES from the client side to the server side. An adapter would sit inbetween which would take
the events and translate into marshaling and sending to the other side.

The criteria for how entities are included in the set are based on:

    - which components an entity should have

    - which components an entity should not have

    - which components should be included in the set



