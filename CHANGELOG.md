# Changelog
Written with guidance from [Keep a CHANGELOG](http://keepachangelog.com/).
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased][unreleased]

### Added
- Util.toBoolean function

### Changed
- entity.getEntityById has option not to throw an error when entity is not found
- removes jsonpointer dependency
- cleaned up entityset/query

## [4.0.5] - 2016-11-17
### Added
- create components using a schema id or hash

### Changed
- component.getEntityId will return the full entity id (entity+entitySet), unless a flag is passed for just the entity id.


## [4.0.0] - 2016-11-09
### Changed
- Query refactored. Queries are now built using functions.
- copyEntity/copyComponent moved to registry.cloneEntity/registry.cloneComponent
- components are cloned when added to an entityset
- registry,entity,component and other core types are now es6 classes

### Added
- AsyncEntitySet - promise based, in-memory, entityset base class
- Can register Component sub-classes, which also have hooks which are called when added and removed from an entity


## [3.3.0] - 2016-08-16
### Added
- reinstated registry.createEntity and added explicit registry.createEntityWithId

### Changed
- Entity.create removed in favour of 'new Entity()' - entity id can be set from attributes

## [3.2.0] - 2016-08-16
### Changed
- replaced use of backbone module with odgn-backbone-model
- updated npm scripts to build standalone into dist/

## [3.1.0] - 2016-07-18
### Added
- memory EntitySet can now marshall itself to and from JSON using createEntitySet and toJSON

## [3.0.3] - 2016-07-14
### Changed
- entity and component toJSON expanded with a full option

## [3.0.2] - 2016-06-27
### Fixed
- multiple ComponentDef registration was not returning objects properly

## [3.0.0] - 2016-06-17
### Changed
- export ComponentDef in index.js

## [3.0.0] - 2016-06-17
### Added
- component def class added

### Changed
- references to component/schema have been changed to def throughout, eg. component.getSchemaId() became component.getDefId()


## [2.0.1] - 2016-06-05
### Fixed 
- entity set registration

## [2.0.0] - 2016-06-05
### Changed
- a new, simpler, component registry has been introduced to replace the existing JSON schema based on.


## [1.1.0] - 2016-04-13
### Changed
- registry.createComponent can take a callback parameter which is an alternative to throwing errors 

## [1.0.0] - 2016-03-30
### Added
- (Entity)Dispatch. A utility for directing incoming entities to their interested processors

### Changed
- altered key for component id from 'id' to '@c'
- altered key for entity id from '_e' to '@e'
- altered key for entityset id from '_es' to '@es'
- altered key for schema id from '_s' to '@s'

### Fixed
- memory entity sets were assigning their ids to incoming entities, which is not allowed.

## [0.11.0] - 2015-10-26
### Added
- entitySet.removeByQuery removes entities identified by a query

### Changed
- component ids are accessed/mutated via getId/setId
- Query.all() without arguments functions the same as Query.Root()

### Fixed
- registry now passing options in registerComponent


## [0.10.0] - 2015-10-12
### Added
- entitysets can be created with uuids as an option argument
- registry.cloneComponent becomes 'util/copy'.copyComponent

### Changed
- Utils.parseUri now also parses any querystring into an object on .query
- can now obtain a specific property from the schema registry by using a fragment
- adding an entityset to the registry with a pre-existing uuid throws an error

## [0.9.0] - 2015-10-12
### Changed
- components no longer emit change events when their entity id is altered

## [0.8.0] - 2015-10-12
### Added
- copyEntity and copyComponent util functions added

## [0.7.1] - 2015-10-08
### Fixed
- schema registry events were not being forwarded correctly


## [0.7.0] - 2015-10-01
### Changed
- Query.selectById now accepts a second argument indicating whether it should select entities from the root entityset. it defaults to false to follow current behaviour
- Query.selectById can omit the first argument, in which case it will use the value from the last query operation

