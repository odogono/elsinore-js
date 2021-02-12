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
    getDefId,
    getProperty as getDefProperty,
    ComponentDefProperty,
    getProperty,
    ComponentDefId
} from '../component_def';
import {
    Entity,
    getEntityId,
    EntityId
} from '../entity';
import {
    BitField,
    create as createBitField,
    get as bfGet,
    set as bfSet,
    count as bfCount,
    and as bfAnd,
    or as bfOr,
    toValues as bfToValues
} from '@odgn/utils/bitfield';
import { Component, ComponentId, toComponentId } from '../component';
import { SType } from '../query/types';
import { isBoolean, isRegex, isDate, isValidDate } from '@odgn/utils';
import { compareDates } from '../query/words/util';
import { hashToString } from '@odgn/utils';
import { stringify } from '@odgn/utils';

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

export function sqlOpen(path: string, options: OpenOptions): SqlRef {
    const isMemory = options.isMemory ?? true;
    const { verbose } = options;
    const db = new BetterSqlite3(isMemory ? ":memory:" : path, { verbose });

    // define our regexp function - so nice!
    db.function('regexp', { deterministic: true }, (regex, val) => {
        if( val == null ){
            return 0;
        }
        let end = regex.lastIndexOf('/');
        let flags = regex.substring(end + 1);
        const re = new RegExp(regex.substring(1, end), flags);

        // console.log('[sqlOpen][regexp]', regex, val, re.test(val) ? 1 : 0 );
        // const re = new RegExp(regex);
        return re.test(val) ? 1 : 0;
    });

    db.pragma('journal_mode = WAL');

    let begin = db.prepare('BEGIN');
    let commit = db.prepare('COMMIT');
    let rollback = db.prepare('ROLLBACK');

    let ref: SqlRef = {
        db, isMemory, begin, commit, rollback
    };

    // Log.debug('[sqlOpen]', ref );

    let stmt = db.prepare('PRAGMA compile_options');
    let rows = stmt.all();
    // Log.debug('[sqlOpen]', rows.map(r => r.compile_options));

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
    const hash = def.hash;// defHash(def);
    const schema = defToObject(def, false);
    let [tblName, sql] = defToStmt(def);

    let stmt = db.prepare('INSERT INTO tbl_component_def (uri,hash,tbl,schema) VALUES (?,?,?,?)');

    stmt.run(def.uri, hash, tblName, JSON.stringify(schema));
    let did = sqlLastId(ref);

    
    // Log.debug('[sqlInsertDef]', sql);
    db.exec(sql);
    // let out = stmt.all(sql);


    let sdef = createComponentDef(did, schema) as ComponentDefSQL;
    sdef.tblName = tblName;
    
    return sdef as ComponentDef;
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

    let bf = e.bitField !== undefined ? bfToValues(e.bitField) : [];

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
    e.id = eid;

    return e;
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
    const bf = createBitField(dids);

    return new Entity(eid, bf);
}

export function sqlUpdateComponent(ref: SqlRef, com: Component, def: ComponentDefSQL): Component {
    const { db } = ref;
    let { '@e': eid, '@d': did } = com;
    const { tblName } = def;

    // add to tbl_component
    let stmt = db.prepare(`SELECT id FROM ${tblName} WHERE eid = ? LIMIT 1`);
    const row = stmt.get(eid);
    const exists = row !== undefined;

    let names = def.properties.map(p => p.persist === true ? `${p.name}` : undefined).filter(Boolean);

    if (exists) {
        const { id } = row;
        const set = defToSetStmt(def);
        // let vals = names.map(name => com[name]);
        let vals = names.map(name => valueToSQL(com[name], getDefProperty(def, name)));
        const sql = `UPDATE ${tblName} ${set} WHERE id = ?`;
        stmt = db.prepare(sql);
        // Log.debug('[sqlUpdateComponent]', eid, did, sql, names, 'vals', vals );
        stmt.run([...vals, id]);
    }
    else {

        let cols = ['eid'];
        // cols = def.properties.reduce( (cols,p) => [...cols,p.name], cols );
        let colString = [...cols, ...names].map(c => `'${c}'`).join(',');
        let vals: any[] = [eid];
        vals = [...vals, ...names.map(name => valueToSQL(com[name], getDefProperty(def, name)))];
        let valString = vals.map(v => '?').join(',');
        // Log.debug('[sqlUpdateComponent]',`INSERT INTO ${tblName} (${colString}) VALUES (${valString});`, vals, com);
        // Log.debug('[sqlUpdateComponent]', 'def', def);
        stmt = db.prepare(`INSERT INTO ${tblName} (${colString}) VALUES (${valString});`)
        stmt.run(vals);
        const cid = sqlLastId(ref);

        // Log.debug('[sqlUpdateComponent]',`inserting into tbl_entity_component ${eid} ${did} ${cid}`);
        stmt = db.prepare('INSERT INTO tbl_entity_component (eid,did,cid,created_at,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)');
        stmt.run(eid, did, cid);
    }

    return com;
}

function valueToSQL(value: any, property?: ComponentDefProperty) {
    if (property !== undefined) {
        switch (property.type) {
            case 'integer':
            case 'number':
            case 'string':
                return value;
            case 'datetime':
                const dte = new Date(value);
                return isValidDate(dte) ? dte.toISOString() : undefined;
                // console.log('[valueToSQL]', value, isDate(value));
                return value;
            default:
                return JSON.stringify(value);

        }
    }
    if (isRegex(value)) {
        return value.source;
    }

    if (isBoolean(value)) {
        return value + '';
    }
    // if( value === undefined ){
    // Log.debug('[valueToSQL]', 'dammit', value, property );
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
    // const did = def[ComponentDefT];

    let stmt = db.prepare(`SELECT * FROM ${tblName} WHERE eid = ? LIMIT 1`);
    let row = stmt.get(eid);

    if (row === undefined) {
        return undefined;
    }

    // Log.debug('[sqlRetrieveComponent]', row );

    let com = rowToComponent(def, row);
    // let { created_at: ca, updated_at: ua, id: id, eid: ee } = row;

    // let com = { '@e': eid, '@d': did };

    // for( const prop of def.properties ){
    //     let val = row[ prop.name ];
    //     switch( prop.type ){
    //         case 'json':
    //         case 'boolean':
    //             val = JSON.parse(val);
    //             break;
    //     }
        
    //     com[prop.name] = val;
    // }

    return com;
}


function rowToComponent(def:ComponentDefSQL, row:any ): Component {
    const did = def[ComponentDefT];
    let com: any = { '@e': row.eid, '@d': did };

    for( const prop of def.properties ){
        let val = row[ prop.name ];
        switch( prop.type ){
            case 'json':
            case 'boolean':
                val = JSON.parse(val);
                break;
        }
        
        com[prop.name] = val;
    }

    return com;
}

// export function sqlRetrieveComponents(ref: SqlRef, eids: EntityId[], dids: ComponentDefId[]): Component[] {
//     const { db } = ref;
//     let result = [];

//     if (eids !== undefined && eids.length === 0) {
//         return result;
//     }

//     if( dids === undefined ){
//         let stmt = db.prepare(`
//     SELECT 
//         eid,did 
//     FROM 
//         tbl_entity_component 
//     WHERE 
//         eid IN (
//             SELECT 
//                 eid 
//             FROM 
//                 tbl_entity_component 
//             WHERE 
//                 did IN (?)
//         ) 
//     ORDER BY 
//         eid;
//     `);
//     let rows = stmt.all(did);
//     }
// }



/**
 * Returns a generator which yields each component of a given def type
 * 
 * @param ref 
 * @param def 
 */
export function *sqlRetrieveComponentsByDef(ref: SqlRef, def:ComponentDefSQL ){
    const {db} = ref;

    let stmt = db.prepare(`SELECT * FROM ${def.tblName} ORDER BY eid`);
    
    for( const row of stmt.iterate() ){
        yield rowToComponent(def, row);
    }
}


/**
 * Retrieves components of entities which have the specified defs
 * 
 * @param ref 
 * @param eids 
 * @param defs 
 */
export function sqlRetrieveComponents(ref: SqlRef, eids: EntityId[], defs: ComponentDefSQL[], allDefs = false): Component[] {
    const { db } = ref;
    let result = [];

    if (eids !== undefined && eids.length === 0) {
        return result;
    }
    
    const dids = defs.map( d => getDefId(d) );
    // Log.debug('[sqlRetrieveComponents]', {allDefs}, dids, eids);

    const eidCondition = eids === undefined ? '' : `AND eid IN (${eids})`;

    // NOTE - this is horrible
    const havingCondition = allDefs ? '' : `HAVING COUNT(eid) = ${dids.length}`

    const sql = `
    SELECT DISTINCT eid FROM tbl_entity_component
    WHERE eid IN (
        SELECT eid FROM tbl_entity_component
        WHERE did IN (${dids}) ${eidCondition}
        GROUP BY eid ${havingCondition}
    )
    AND did IN (${dids})
    `;

    // Log.debug('[sqlRetrieveComponents]', sql);

    let stmt = db.prepare(sql);

    eids = stmt.all().map( r => r.eid );

    // Log.debug('[sqlRetrieveComponents]', 'result', eids );


    // build a list of entity ids which have all the defs

    
    for (let ii = 0; ii < defs.length; ii++) {
        let def = defs[ii];
        
        
        let rows;
        if (eids === undefined) {
            let stmt = db.prepare(`SELECT * FROM ${def.tblName} ORDER BY eid`);
            rows = stmt.all();
        } else {
            const params = buildInParamString(eids);
            let stmt = db.prepare(`SELECT * FROM ${def.tblName} WHERE eid IN (${params}) ORDER BY eid`);
            // Log.debug('[sqlRetrieveComponents]', eids, params);
            rows = stmt.all(...eids);
        }
        
        for (let rr = 0; rr < rows.length; rr++) {
            const row = rows[rr];
            let com = rowToComponent(def, row);
            result.push(com);
        }
    }


    return result;
}

export function sqlRetrieveComponentIds(ref: SqlRef, eids: EntityId[], defs: ComponentDefSQL[], allDefs = false): ComponentId[] {
    const { db } = ref;
    let result = [];

    if (eids !== undefined && eids.length === 0) {
        return result;
    }

    const dids = defs.map( d => getDefId(d) );
    // Log.debug('[sqlRetrieveComponents]', {allDefs}, dids, eids);

    const eidCondition = eids === undefined ? '' : `AND eid IN (${eids})`;

    // NOTE - this is horrible
    const havingCondition = allDefs ? '' : `HAVING COUNT(eid) = ${dids.length}`

    const sql = `
    SELECT DISTINCT eid,did FROM tbl_entity_component
    WHERE eid IN (
        SELECT eid FROM tbl_entity_component
        WHERE did IN (${dids}) ${eidCondition}
        GROUP BY eid ${havingCondition}
    )
    AND did IN (${dids})
    `;

    // Log.debug('[sqlRetrieveComponents]', sql);

    let stmt = db.prepare(sql);

    return stmt.all().map( r => toComponentId(r.eid,r.did) );


}

function buildInParamString(params: any[]): string {
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

    return rows.map(r => r.id);
}

export function getLastEntityId(ref: SqlRef): number {
    let stmt = ref.db.prepare('SELECT id FROM tbl_entity ORDER BY id DESC LIMIT 1');
    let row = stmt.get();
    return row !== undefined ? row.id : 0;
}

export function sqlRetrieveDefs(ref: SqlRef): ComponentDefSQL[] {
    const { db } = ref;
    let stmt = db.prepare('SELECT * FROM tbl_component_def');
    let rows = stmt.all();

    return rows.map(row => {
        let { id, schema } = row;
        // return createComponentDef(id, JSON.parse(schema));
        return sqlCreateComponentDef( id, schema );
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
    return sqlCreateComponentDef( id, schema );
}

export function sqlRetrieveDefByHash(ref: SqlRef, id: number): ComponentDefSQL {
    const { db } = ref;

    let stmt = db.prepare('SELECT * FROM tbl_component_def WHERE hash = ? LIMIT 1');
    let row = stmt.get(id);

    if (row === undefined) {
        return undefined;
    }

    let { id: did, schema } = row;
    return sqlCreateComponentDef( did, schema );
}

function sqlCreateComponentDef( did: ComponentDefId, schema:string ): ComponentDefSQL {
    const def = createComponentDef(did, JSON.parse(schema)) as ComponentDefSQL;
    def.tblName = defToTbl(def);
    return def;
}

/**
 * Retrieves entities with the given entityIds
 * 
 * @param ref 
 * @param eids 
 */
export function sqlRetrieveEntities(ref: SqlRef, eids?: EntityId[]): Entity[] {
    const { db } = ref;
    let rows, stmt;
    if (eids !== undefined) {
        const params = buildInParamString(eids);
        stmt = db.prepare(`SELECT eid,did FROM tbl_entity_component WHERE eid IN (${params}) ORDER BY eid`);
        rows = stmt.all(...eids);
        // rows = stmt.all( ...eids );
    } else {
        stmt = db.prepare(`SELECT eid,did FROM tbl_entity_component ORDER BY eid;`);
        rows = stmt.all();
    }

    // Log.debug('[sqlRetrieveEntities]', rows);

    let result = rows.reduce((result, { eid, did }) => {
        let e = result[eid];
        if (e === undefined) {
            e = new Entity(eid);
        }
        e.bitField = bfSet(e.bitField, did);
        return { ...result, [eid]: e };
    }, {});
    return Object.values(result);
}



export function sqlRetrieveEntityByDefId(ref: SqlRef, did: number[]): Entity[] {
    const { db } = ref;

    // Log.debug('[sqlRetrieveEntityByDefId]', did);
    if( did === undefined || did.length === 0 ){
        return [];
    }

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
                did IN (${did})
        ) 
    ORDER BY 
        eid;
    `);
    // Log.debug('[sqlRetrieveEntityByDefId]', did);
    let rows = stmt.all();

    let result = rows.reduce((result, { eid, did }) => {
        let e = result[eid];
        if (e === undefined) {
            e = new Entity(eid);
        }
        e.bitField = bfSet(e.bitField, did);
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


export function sqlRetrieveByQuery(ref: SqlRef, eids: EntityId[], query: any[]) {
    const { db } = ref;

    let comp;
    let sql = [];
    let params = [];
    // Log.debug('[sqlRetrieveByQuery]', eids, query);
    walkFilterQuery(eids, sql, params, ...query);

    // sql.push('ORDER BY eid')
    // Log.debug('[sqlRetrieveByQuery]', sql, params );
    // Log.debug('[sqlRetrieveByQuery]', sql, params.map(p => Array.isArray(p) ? stringify(p) : p) );

    let stmt = db.prepare(sql.join(' '));
    
    params = params.map( p => {
        if( Array.isArray(p) ){
            if( p.length === 1 ){
                return p[0];
            }
            return stringify(p);
        }
        return p;
    })
    params = params.map(p => Array.isArray(p) ? stringify(p) : p);

    let rows = stmt.all(...params );

    // Log.debug('[sqlRetrieveByQuery]', sql, params );


    // Log.debug('[sqlRetrieveByQuery]', sql, params, rows);

    return [SType.List, rows.map(r => [SType.Entity, r.eid])];

}

function walkFilterQuery(eids: EntityId[], out: string[], params: any[], cmd?, ...args) {
    if (cmd === 'dids') {
        let dids = args[0];
        out.push(`SELECT eid from tbl_entity_component WHERE did IN ( ? )`);
        params.push(dids);
    }
    else if (cmd === 'and') {
        walkFilterQuery(eids, out, params, ...args[1]);
        out.push('INTERSECT');
        walkFilterQuery(eids, out, params, ...args[0]);
    } else if (cmd === 'or') {
        walkFilterQuery(eids, out, params, ...args[0]);
        out.push('UNION');
        walkFilterQuery(eids, out, params, ...args[1]);
    } else {
        switch (cmd) {
            case '==':
            case '!=':
            case '>':
            case '>=':
            case '<':
            case '<=':
                return walkFilterQueryCompare(eids, out, params, cmd, ...args);
            default:
                console.log('[walkFQ]', `unhandled ${cmd}`);
                // return eids;
                break;
        }
    }
}

function walkFilterQueryCompare(eids:EntityId[], out: string[], params: any[], cmd?, ...args) {
    let { def } = args[0];
    let tbl = defToTbl(def);
    let [ptr, val] = args[1];

    // get the first part of the ptr - the property name
    // the rest of the ptr is converted to a sqlite json /path/key -> $.path.key
    let [key, path] = ptrToSQL(ptr);

    const props = getProperty(def, key);

    if (props.type === 'json') {
        key = `json_extract( ${key}, '${path}' )`;
    }

    // console.log(' ', key, path );
    const op = compareOpToSQL(cmd);
    const prop = getDefProperty(def, key);

    if (isRegex(val)) {
        // console.log(`SELECT eid from ${tbl} WHERE ${key} REGEXP '${val.toString()}'`);
        out.push(`SELECT eid from ${tbl} WHERE ${key} REGEXP '${val.toString()}'`);
    } else if( Array.isArray(val) ){
        let arrOp = cmd === '!=' ? 'NOT IN' : 'IN';
        // console.log(`SELECT eid from ${tbl} WHERE ${key} ${arrOp} (${val})`, op);
        out.push(`SELECT eid from ${tbl} WHERE ${key} ${arrOp} (${val})`);
        // params.push(valueToSQL(val,prop));
    } else {
        // console.log(`SELECT eid from ${tbl} WHERE ${key} ${op} ?`, valueToSQL(val,prop), val );
        // out.push(`SELECT eid from ${tbl} WHERE eid IN (${eids}) AND ${key} ${op} ?`);
        out.push(`SELECT eid from ${tbl} WHERE ${key} ${op} ?`);
        params.push(valueToSQL(val,prop));
    }
}

function compareOpToSQL(op:string){
    switch (op) {
        case '==':
            return '=';
        case '!=':
            return '<>';
        case '>':
        case '>=':
        case '<':
        case '<=':
        default:
            return op;
    }
}

function ptrToSQL(ptr: string) {
    if (ptr.charAt(0) === '/') {
        let parts = ptr.substring(1).split('/');
        let [prop, ...path] = parts;
        return [prop, '$.' + path.join('.')];
    }
    return [ptr, undefined];
}

function componentRowToComponent(did, row): Component {
    let { eid, ...others } = row;
    return { '@e': eid, '@d': did, ...others };
}

function defToTbl(def: ComponentDef) {
    return 'tbl' + def.uri.split('/').join('_') + '_' + hashToString(def.hash);
}
function getDefColumns(def: ComponentDef) {
    let properties = def.properties || [];
    return properties.map(p => p.name);
}

function defToStmt(def: ComponentDef) {

    const tblName = defToTbl(def);
    const hash = hashToString(def.hash);
    let properties = def.properties || [];

    let props = properties.map(prop => {
        if( prop.persist === false ){
            return undefined;
        }
        return `'${prop.name}' ${propTypeToSQL(prop.type)}`;
    }).filter(Boolean).join(',\n');
    if (props.length > 0) {
        props = props + ',';
    }

    const sql = `
    CREATE TABLE IF NOT EXISTS ${tblName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eid INTEGER,
        ${props}
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    UPDATE SQLITE_SEQUENCE SET seq = 1 WHERE name = '${tblName}';
    CREATE INDEX IF NOT EXISTS idx_${hash}_eid ON ${tblName} (eid);
    `

    return [tblName, sql];
}

function propTypeToSQL(type: string): string {
    switch (type) {
        case 'integer':
        case 'entity':
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
        // Log.debug('[initialseSchema]', 'existing db version', existingVersion);
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
        tbl STRING,
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
    CREATE INDEX idx_entity_component ON tbl_entity_component (eid,did);

    COMMIT;
`;
