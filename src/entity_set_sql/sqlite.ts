import BetterSqlite3 from 'better-sqlite3';
import { createLog } from '../util/log';
import { EntitySetSQL, ComponentDefSQL } from '.';
import {
    ComponentDef,
    Type as ComponentDefT,
    create as createComponentDef,
    toObject as defToObject,
    hash as defHash,
    hashStr as defHashStr,
    getDefId
} from '../component_def';
import {
    Entity,
    create as createEntityInstance,
    getEntityId,
    setEntityId,
    EntityId
} from '../entity';
import { BitField } from 'odgn-bitfield';
import { Component, toComponentId } from '../component';
import { SType } from '../query/stack';
import { isBoolean } from '../util/is';

const Log = createLog('Sqlite');


const SCHEMA_VERSION = 1;

export interface SqlRef {
    db: BetterSqlite3.Database;
    isMemory: boolean;
    begin?: any;
    commit?: any;
    rollback?: any;
}


export interface OpenOptions {
    isMemory?: boolean;
    clearDb?: boolean;
    verbose?: any;
}

export function sqlClear(name: string): Promise<boolean> {
    const db = new BetterSqlite3(name, { verbose: undefined });

    // Log.debug('[sqlClear]', db);

    const stmt = db.prepare(`SELECT * FROM sqlite_master WHERE type='table';`);
    const rows = stmt.all();

    for (const row of rows) {
        if (row.name === 'sqlite_sequence') {
            continue;
        }
        db.exec(`drop table ${row.name}`);
    }

    return Promise.resolve(true);
}

export function sqlOpen(name: string, options: OpenOptions): SqlRef {
    const isMemory = options.isMemory ?? true;
    const { verbose } = options;
    const db = new BetterSqlite3(name, { memory: isMemory, verbose });

    db.pragma('journal_mode = WAL');

    let begin = db.prepare('BEGIN');
    let commit = db.prepare('COMMIT');
    let rollback = db.prepare('ROLLBACK');

    let ref: SqlRef = {
        db, isMemory, begin, commit, rollback
    };

    // Log.debug('[sqlOpen]', ref );

    initialiseSchema(ref, options);

    // ref = sqlClose(ref);

    return ref;
}

export function sqlClose(ref: SqlRef): SqlRef {
    const { db } = ref;
    if (db === undefined || db.open !== true) {
        return ref;
    }
    db.close();
    return { ...ref, db: undefined };
}

export function sqlIsOpen(ref: SqlRef): boolean {
    return ref !== undefined && ref.db !== undefined && ref.db.open;
}

export function sqlCount(ref: SqlRef): number {
    const { db } = ref;
    let stmt = db.prepare('SELECT COUNT(id) as count FROM tbl_entity');
    let row = stmt.get()
    return row === undefined ? 0 : row.count;
}

// Higher order function - returns a function that always runs in a transaction
function asTransaction(ref: SqlRef, func) {
    const { db, begin, commit, rollback } = ref;
    return function (...args) {
        begin.run();
        try {
            func(...args);
            commit.run();
        } finally {
            if (db.inTransaction) rollback.run();
        }
    };
}


/**
 * Creates a new entityset record if it doesn't exist, and returns
 * details about it
 *
 * @param {*} entitySet
 * @param {*} options
 */
export function registerEntitySet(ref: SqlRef, es: EntitySetSQL, options = {}) {
    const { db } = ref;
    Log.debug('[registerEntitySet]', es.uuid);
    // let db = openDB(options);

    // try and retrieve details of the entityset by its uuid
    let stmt = db.prepare(STMT_ENTITY_SET_SELECT_BY_UUID);
    let row = stmt.get(es.uuid);

    if (row === undefined) {
        // insert
        stmt = db.prepare(STMT_ENTITY_SET_INSERT);
        stmt.run(es.uuid, es, Status.Active);
    } else {
        Log.debug('[registerEntitySet]', 'found existing', row);
        // entitySet.id = row.entity_set_id;
    }

    return true;
}


export function sqlInsertDef(ref: SqlRef, def: ComponentDef): ComponentDefSQL {
    const { db } = ref;
    const hash = defHash(def);
    const schema = defToObject(def, false);
    let stmt = db.prepare('INSERT INTO tbl_component_def (uri,hash,schema) VALUES (?,?,?)');

    stmt.run(def.uri, hash, JSON.stringify(schema));
    let did = sqlLastId(ref);

    let [tblName, sql] = defToStmt(def);
    // Log.debug('[sqlInsertDef]', sql);
    db.exec(sql);
    // let out = stmt.all(sql);


    let sdef = createComponentDef(did, schema) as ComponentDefSQL;
    sdef.tblName = tblName;
    sdef.hash = hash;

    return sdef;
}

export function sqlUpdateEntity(ref: SqlRef, e: Entity): Entity {
    const { db } = ref;
    let eid = getEntityId(e);
    let update = true;

    if (eid === 0) {
        eid = getLastEntityId(ref);
        eid = eid === undefined ? 1 : eid + 1;
        update = false;
    }

    let bf = e.bitField !== undefined ? e.bitField.toValues() : [];

    // Log.debug('[sqlUpdateEntity]', eid, update );

    // asTransaction( ref, () => {
    if (!update) {
        let stmt = db.prepare('INSERT INTO tbl_entity DEFAULT VALUES;');
        stmt.run();
        eid = sqlLastId(ref);
        // Log.debug('[sqlUpdateEntity]', 'err?', eid );
    } else {
        let stmt = db.prepare('INSERT INTO tbl_entity(id) VALUES (?)');
        stmt.run(eid);
        // throw 'stop';
    }

    if (bf.length > 0) {
        // Log.debug('[sqlUpdateEntity]',`inserting into tbl_entity_component ${eid}`);
        // let stmt = db.prepare('INSERT INTO tbl_entity_component(eid,did,created_at,updated_at) VALUES (?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)');
        // bf.forEach( did => {
        //     stmt.run(eid, did);
        // })
    }
    // });

    return setEntityId(e, eid);
}

export function sqlRetrieveEntity(ref: SqlRef, eid: number): Entity {
    const { db } = ref;

    // let stmt = db.prepare('SELECT did FROM tbl_entity_component WHERE eid = ?');
    let stmt = db.prepare('SELECT id FROM tbl_entity WHERE id = ?');

    let rows = stmt.all(eid);

    if (rows.length === 0) {
        return undefined;
    }

    // Log.debug('[sqlRetrieveEntity]', rows );
    stmt = db.prepare('SELECT did FROM tbl_entity_component WHERE eid = ?');
    rows = stmt.all(eid);

    let dids = rows.map(r => r.did);
    const bf = new BitField(dids);

    return createEntityInstance(eid, bf);
}

export function sqlUpdateComponent(ref: SqlRef, com: Component, def: ComponentDefSQL): Component {
    const { db } = ref;
    let { '@e': eid, '@d': did } = com;
    const { tblName } = def;

    // add to tbl_component
    let stmt = db.prepare(`SELECT id FROM ${tblName} WHERE eid = ? LIMIT 1`);
    const row = stmt.get(eid);
    const exists = row !== undefined;

    let names = def.properties.map(p => `${p.name}`);

    // Log.debug('[sqlUpdateComponent]', com);

    if (exists) {
        const { id } = row;
        const set = defToSetStmt(def);
        let vals = names.map(name => com[name]);
        const sql = `UPDATE ${tblName} ${set} WHERE id = ?`;
        stmt = db.prepare(sql);
        // Log.debug('[sqlUpdateComponent]', eid, did, sql );
        stmt.run([...vals, id]);
    }
    else {

        let cols = ['eid'];
        // cols = def.properties.reduce( (cols,p) => [...cols,p.name], cols );
        let colString = [...cols, ...names].map(c => `'${c}'`).join(',');
        let vals:any[] = [eid];
        vals = [...vals, ...names.map(name => valueToSQL( com[name] ))];
        let valString = vals.map(v => '?').join(',');
        // Log.debug('[sqlUpdateComponent]',`INSERT INTO ${tblName} (${colString}) VALUES (${valString});`, vals, com);
        stmt = db.prepare(`INSERT INTO ${tblName} (${colString}) VALUES (${valString});`)
        stmt.run(vals);
        const cid = sqlLastId(ref);

        // Log.debug('[sqlUpdateComponent]',`inserting into tbl_entity_component ${eid} ${did} ${cid}`);
        stmt = db.prepare('INSERT INTO tbl_entity_component (eid,did,cid,created_at,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)');
        stmt.run(eid, did, cid);
    }

    return com;
}

function valueToSQL(value){
    if( isBoolean(value) ){
        return value+'';
    }
    // if( value === undefined ){
    //     Log.debug('[valueToSQL]', 'dammit', attr, value, component );
    // }
    return value;
}

/**
 * 
 * @param ref 
 * @param eid 
 * @param def 
 */
export function sqlDeleteComponent(ref: SqlRef, eid: EntityId, def: ComponentDefSQL): Entity {
    const { db } = ref;
    const { tblName } = def;

    let stmt = db.prepare(`DELETE FROM ${tblName} WHERE eid = ?`);
    stmt.run(eid);

    stmt = db.prepare('DELETE FROM tbl_entity_component WHERE eid = ? AND did = ?');
    stmt.run(eid, getDefId(def));

    return sqlRetrieveEntity(ref, eid);
}

export function sqlDeleteEntity(ref: SqlRef, eid: EntityId) {
    const { db } = ref;

    let stmt = db.prepare(`DELETE FROM tbl_entity WHERE id = ?`);
    stmt.run(eid);

    stmt = db.prepare(`DELETE FROM tbl_entity_component WHERE eid = ?`);
    stmt.run(eid);

    return true;
}

function defToSetStmt(def: ComponentDefSQL) {
    let parts = def.properties.map(prop => {
        return `'${prop.name}' = ?`;
    })
    return parts.length > 0 ? `SET ${parts.join(',')}` : '';
}

export function sqlComponentExists(ref: SqlRef, eid: number, did: number): boolean {
    const { db } = ref;
    let stmt = db.prepare('SELECT cid FROM tbl_entity_component WHERE eid = ? AND did = ? LIMIT 1');
    let row = stmt.get(eid, did);
    return row !== undefined;
}

export function sqlRetrieveComponent(ref: SqlRef, eid: number, def: ComponentDefSQL): Component {
    const { db } = ref;
    const { tblName } = def;
    const did = def[ComponentDefT];

    let stmt = db.prepare(`SELECT * FROM ${tblName} WHERE eid = ? LIMIT 1`);
    let row = stmt.get(eid);

    if (row === undefined) {
        return undefined;
    }

    let { created_at: ca, updated_at: ua, id: id, eid: ee, ...rest } = row;

    let com = { '@e': eid, '@d': did, ...rest };

    return com;
}

export function sqlRetrieveComponents(ref:SqlRef, eids:EntityId[], defs:ComponentDefSQL[]): Component[] {
    const { db } = ref;
    // let tblName, did;
    let result = [];

    for(let ii=0;ii<defs.length;ii++ ){
        let def = defs[ii];
        let rows;
        if( eids === undefined ){
            let stmt = db.prepare(`SELECT * FROM ${def.tblName} ORDER BY eid`);
            rows = stmt.all();
        } else {
            const params = buildInParamString(eids);
            let stmt = db.prepare(`SELECT * FROM ${def.tblName} WHERE eid IN (${params}) ORDER BY eid`);
            // Log.debug('[sqlRetrieveComponents]', eids, params);
            rows = stmt.all( ...eids );
        }
        // let rows = stmt.all(eids);

        for( let rr=0;rr<rows.length;rr++ ){
            let { created_at: ca, updated_at: ua, id: id, eid: ee, ...rest } = rows[rr];
            result.push( { '@e': ee, '@d': def[ComponentDefT], ...rest } );
        }
    }
    
    return result;
}

function buildInParamString(params:any[]):string {
    return '?,'.repeat(params.length).slice(0, -1);;
}
export function sqlRetrieveEntityComponents(ref: SqlRef, eid: number, defs: ComponentDefSQL[]): Component[] {
    return defs.map(def => sqlRetrieveComponent(ref, eid, def));
}

export function sqlLastId(ref: SqlRef): number {
    let stmt = ref.db.prepare('SELECT last_insert_rowid() AS id');
    let { id } = stmt.get();
    return id;
}

export function sqlGetEntities(ref: SqlRef): number[] {
    let stmt = ref.db.prepare('SELECT id FROM tbl_entity');
    let rows = stmt.all();
    if (rows.length === 0) {
        return [];
    }

    return rows.map(r => r.did);
}

export function getLastEntityId(ref: SqlRef): number {
    let stmt = ref.db.prepare('SELECT id FROM tbl_entity ORDER BY id DESC LIMIT 1');
    let row = stmt.get();
    return row !== undefined ? row.id : 0;
}

export function sqlRetrieveDefs(ref: SqlRef): ComponentDef[] {
    const { db } = ref;
    let stmt = db.prepare('SELECT * FROM tbl_component_def');
    let rows = stmt.all();

    return rows.map(row => {
        let { id, schema } = row;
        return createComponentDef(id, JSON.parse(schema));
    })
}

export function sqlRetrieveDefByUri(ref: SqlRef, uri: string): ComponentDef {
    const { db } = ref;

    let stmt = db.prepare('SELECT * FROM tbl_component_def WHERE uri = ? LIMIT 1');
    let row = stmt.get(uri);

    if (row === undefined) {
        return undefined;
    }

    let { id, schema } = row;
    return createComponentDef(id, JSON.parse(schema));
}

export function sqlRetrieveDefByHash(ref: SqlRef, id: number): ComponentDef {
    const { db } = ref;

    let stmt = db.prepare('SELECT * FROM tbl_component_def WHERE hash = ? LIMIT 1');
    let row = stmt.get(id);

    if (row === undefined) {
        return undefined;
    }

    let { id: did, schema } = row;

    return createComponentDef(did, JSON.parse(schema));;
}

export function sqlRetrieveEntities(ref:SqlRef):Entity[]{
    const { db } = ref;
    let stmt = db.prepare(`SELECT eid,did FROM tbl_entity_component ORDER BY eid;`);
    let rows = stmt.all();
    let result = rows.reduce((result, { eid, did }) => {
        let e = result[eid];
        if (e === undefined) {
            e = createEntityInstance(eid);
        }
        e.bitField.set(did);
        return { ...result, [eid]: e };
    }, {});
    return Object.values(result);
}

export function sqlRetrieveEntityByDefId(ref: SqlRef, did: number[]): Entity[] {
    const { db } = ref;
    let stmt = db.prepare(`
    SELECT 
        eid,did 
    FROM 
        tbl_entity_component 
    WHERE 
        eid IN (
            SELECT 
                eid 
            FROM 
                tbl_entity_component 
            WHERE 
                did IN (?)
        ) 
    ORDER BY 
        eid;
    `);
    let rows = stmt.all(did);

    let result = rows.reduce((result, { eid, did }) => {
        let e = result[eid];
        if (e === undefined) {
            e = createEntityInstance(eid);
        }
        e.bitField.set(did);
        return { ...result, [eid]: e };
    }, {});

    return Object.values(result);
}

// export function sqlRetrieveComponentValue(ref: SqlRef, def: ComponentDef, attr: string, value:any, eids: EntityId[] = [], returnComs:boolean = false) {
//     const { db } = ref;
//     const tblName = defToTbl(def);
//     const did = getDefId(def);

//     let whereClauses = [];
//     let params = [];

//     if( value !== undefined ){
//         whereClauses.push(`${attr} = (?)`)
//         params.push( valueToSQL(value) );
//     }

//     if( eids.length > 0 ){
//         const paramStr = buildInParamString(eids);
//         whereClauses.push( `eid IN (${paramStr})`); 
//         params.push(...eids);
//     };

//     let additional = '';
//     if( whereClauses.length > 0 ){
//         additional = 'WHERE ' + whereClauses.join('AND');
//     }

//     let columns = ['eid', ...getDefColumns(def)];

//     let query = `
//         SELECT
//         ${columns}
//         FROM
//         ${tblName}
//         ${additional}
//         ORDER BY
//         eid
//         ;`;

//     // Log.debug('[sqlRetrieveComponentValue]', query, params);
//     let stmt = db.prepare(query);

//     let rows = stmt.all(...params);

//     return rows.map(row => {
//         return returnComs ?
//             [SType.Component, componentRowToComponent(did,row) ]
//             : [SType.ComponentValue, [toComponentId(row.eid, did), attr, row[attr]]];
//     })
// }


export function sqlRetrieveByQuery( ref:SqlRef, query:any[] ){
    const {db} = ref;

    let comp;
    let sql = [];
    let params = [];
    // Log.debug('[sqlRetrieveByQuery]', query);
    walkFilterQuery( sql, params, ...query );
    
    // sql.push('ORDER BY eid')
    // Log.debug('[sqlRetrieveByQuery]', sql, params);
    
    let stmt = db.prepare(sql.join(' ') );
    // Log.debug('[sqlRetrieveByQuery]', sql, params);
    let rows = stmt.all(...params);
    

    return [SType.Array, rows.map(r => [SType.Entity,r.eid]) ];

}

function walkFilterQuery(out:string[], params:any[], cmd?, ...args ){
    if( cmd === 'dids' ){
        let dids = args[0];
        out.push(`SELECT eid from tbl_entity_component WHERE did IN ( ? )`);
        params.push( dids );
    }
    else if( cmd === 'and' ){
        walkFilterQuery(out, params, ...args[1] );
        out.push('INTERSECT');
        walkFilterQuery(out, params, ...args[0] );
    } else if( cmd === 'or' ){
        walkFilterQuery(out, params, ...args[0] );
        out.push('UNION');
        walkFilterQuery(out, params, ...args[1] );
    } else if( cmd === '==' ){
        let {def} = args[0];
        let tbl = defToTbl(def);
        let [key,val] = args[1];
        if( Array.isArray(val) ){
            Log.debug('[walkFilterQuery]', 'might want to do this', val);
        }
        out.push(`SELECT eid from ${tbl} WHERE ${key} = ?`);
        params.push( valueToSQL(val) );
    }
}

function componentRowToComponent(did, row):Component{
    let {eid, ...others} = row;
    return {'@e':eid, '@d':did, ...others};
}

function defToTbl(def: ComponentDef) {
    return 'tbl' + def.uri.split('/').join('_');
}
function getDefColumns(def:ComponentDef){
    let properties = def.properties || [];
    return properties.map(p => p.name);
}

function defToStmt(def: ComponentDef) {

    const tblName = defToTbl(def);
    let properties = def.properties || [];

    let props = properties.map(prop => {
        return `'${prop.name}' ${propTypeToSQL(prop.type)}`;
    }).join(',\n');
    if (props.length > 0) {
        props = props + ',';
    }

    const sql = `
    CREATE TABLE ${tblName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eid INTEGER,
        ${props}
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    UPDATE SQLITE_SEQUENCE SET seq = 1 WHERE name = '${tblName}';`

    return [tblName, sql];
}

function propTypeToSQL(type: string): string {
    switch (type) {
        case 'integer':
            return 'INTEGER';
        case 'number':
            return 'REAL';
        case 'boolean':
            return 'BOOLEAN';
        default:
            return 'TEXT';
    }
}



function initialiseSchema(ref: SqlRef, options: OpenOptions = {}) {
    let existingVersion = 0;
    const { clearDb } = options;
    const { db } = ref;

    try {
        let stmt = db.prepare('SELECT version FROM tbl_meta LIMIT 1');
        let row = stmt.get();
        existingVersion = row.version;
        // Log.debug('[initialseSchema]', 'meta information found', row );
    } catch (err) {
        // Log.warn('[initialiseSchema]', 'error', err.message);
    }

    if (clearDb || existingVersion < SCHEMA_VERSION) {
        // Log.debug(
        //     '[initialseSchema]',
        //     'no meta information found or out of date'
        // );
        db.exec(tblEntitySet);
    } else {
        Log.debug('[initialseSchema]', 'existing db version', existingVersion);
    }
}

const STMT_ENTITY_SET_SELECT_BY_UUID =
    'SELECT * FROM tbl_entity_set WHERE uuid = ?';
const STMT_ENTITY_SET_INSERT =
    'INSERT INTO tbl_entity_set (uuid,status) VALUES (?,?)';


enum Status {
    Inactive = 0,
    Active = 1
};

const tblEntitySet = `
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;

    DROP TABLE IF EXISTS "tbl_meta";
    CREATE TABLE
        tbl_meta
    (
        version INTEGER
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    INSERT INTO tbl_meta (version) VALUES ( ${SCHEMA_VERSION} );

    DROP TABLE IF EXISTS "tbl_entity_set";
    CREATE TABLE
        tbl_entity_set
        (
            id INTEGER PRIMARY KEY,
            uuid STRING,
            status INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    
    DROP TABLE IF EXISTS "tbl_component_def";
    CREATE TABLE tbl_component_def (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eid INTEGER,
        uri STRING,
        hash INTEGER,
        schema STRING,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- UPDATE sqlite_sequence SET seq = 1 WHERE name = "tbl_component_def";
        
    DROP TABLE IF EXISTS "tbl_entity";
    CREATE TABLE tbl_entity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- UPDATE sqlite_sequence SET seq = 1 WHERE name = "tbl_entity";

    -- links tbl_entity to tbl_com
    DROP TABLE IF EXISTS "tbl_entity_component";
    CREATE TABLE tbl_entity_component (
        eid INTEGER, -- entity_id
        did INTEGER, -- component_def_id
        cid INTEGER, -- component_id,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    COMMIT;
`;
