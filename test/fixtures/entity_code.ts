exports.schema = {
    entity:{
        "id":"http://entity/code",
        "properties": {
            "code_id": {"type":"integer", "required":true },
            "code_group_id": {"type":"integer", "required":true },
            "name": {"type":"string", "required":true },
            "label": {"type":"string", "required":false }
        }
    },
    pg:{
        "id":"http://entity/code",
        "properties": {
            "code_id": {"type":"integer", "required":true },
            "code_group_id": {"type":"integer", "required":true },
            "name": {"type":"string", "required":true },
            "label": {"type":"string", "required":false }
        }
    }
};

"CREATE tbl_code 
(
    id                      SERIAL PRIMARY KEY,
    code_id                 INTEGER,
    code_group_id           INTEGER,
    name                    VARCHAR,
    label                   VARCHAR,
    created_at              TIMESTAMP NOT NULL DEFAULT (NOW() at time zone 'UTC'),
    updated_at              TIMESTAMP NOT NULL DEFAULT (NOW() at time zone 'UTC')
)"