Elsinore.js
===========

**A Javascript Entity Component System**

[![Build Status](https://secure.travis-ci.org/odogono/elsinorejs.png)](http://travis-ci.org/odogono/elsinorejs)

[![NPM](https://nodei.co/npm/elsinorejs.png?stars&downloads&downloadRank)](https://nodei.co/npm/elsinorejs/) [![NPM](https://nodei.co/npm-dl/elsinorejs.png?months=6&height=3)](https://nodei.co/npm/elsinorejs/)

<a name="intro"></a>
Introduction
------------


<a name="basic"></a>
Basic Usage
-----------


<a name="concepts"></a>
Concepts
-----------



<a name="api"></a>
## API

### Component

### Entity

### EntitySet

### Query

### Registry

### Schema


- An Entity is essentially an ID. 

- A Component is a structured collection of data. It is defined by a Schema.

- A Component belongs to a single Entity.

- In effect, an Entity is a container for Components.

- A Query is used to select a subset of Entities from an EntitySet.

- When an Entity is added to an EntitySet, if it did not originate from that EntitySet, a new ID will be given to it.Some types of EntitySet do not exhibit this behaviour.





### Entity

Entities are containers for Components. By themselves, they are little more than an ID, but they manifest in Elsinore as objects with a number of utility functions for managing their components.

### Component

A container for data. Components are defined by a Schema.


### EntitySet

A container for Entities.


### EntityFilter

A means of creating a subset of Entities by specifying what Components a given Entity should or shouldn't have.


### Registry

The registry manages EntitySets, Components and Entities.






Components are a structure for data. They are identified by a uri, and are defined using a schema. 

Entities live inside EntitySets. 

An EntitySet is usually an in-memory structure, but can also be backed by different storage engines such as the file system or redis or IndexedDB on the browser.

An EntityFilter is used to determine whether an Entity is acceptable based on the Components it has or hasn't.

EntityFilters can be used in combination with EntitySets to create a subset.

Processors execute code against EntitySets.




## EntitySets

    var entity = Entity.create();


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



