# Changelog
Written with guidance from [Keep a CHANGELOG](http://keepachangelog.com/).
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased][unreleased]
### Changed
- Utils.parseUri now also parses any querystring into an object on .query
- can now obtain a specific property from the schema registry by using a fragment
- entitysets can be created with uuids as an option argument
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

