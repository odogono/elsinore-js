Changelog
=========

http://keepachangelog.com/


## 2015-10-01 [0.7.0]

Changed
- Query.selectById now accepts a second argument indicating whether it should select entities from the root entityset. it defaults to false to follow current behaviour
- Query.selectById can omit the first argument, in which case it will use the value from the last query operation

