

let id:number = 0;


export function generateId():number {
    id = id + 1;
    return id;
}