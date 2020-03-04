
ECS suited for loop driven games - systems are processed every loop.

Does ECS suit the event driven nature of web apps? - web apps becoming more like game servers - realtime comms

 



Persistence - how are the components of an entity retrieved from the seperate tables?

Within memory, there is an array of entity ids which each have an array of component ids

Perhaps entities aren't - why do you need to?

To retrieve active games, you search for Game components. Related units will also have a
game component. 
Game (component_id) (entity_id)
    Team (game_component_id) (component_id) (entity_id)
        Unit (team_component_id) (game_component_id) (component_id) (entity_id)

- A brute force approach is to query all component tables with the entity_id


## Entities

- entities have a unique id

- they are containers for components


## Components

- components may belong to a single entity

create a standard Backbone.Model with attributes.

add the command queue component to it, and set an execute time.

execute the command queue system, and it will be executed


## Systems

- systems process lists of components

- systems are provided with the results of a Query


- Q: How to retrieve a domain of entities


Game Entity

- Game Details
- Status

Team Entity

- Game Member
- Player / AIPlayer

Unit Entity

- Position
- Team Member




POI Entity Components

- Content Set member
- Status (active,inactive,logically_deleted)
- Location
- Timestamps (created_at, created_by, etc)
- Categories
- Availability Weights
- Icon Image (type,md5,name,path,format)
- Detail Image (subclass of icon?)


Image Entity
- POI Component


### serialisation of components

group components together for an entity? 'freeze' components onto an entity so that they become a
composite.

