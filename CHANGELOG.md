# Changelog
Written with guidance from [Keep a CHANGELOG](http://keepachangelog.com/).
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased][unreleased]


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

