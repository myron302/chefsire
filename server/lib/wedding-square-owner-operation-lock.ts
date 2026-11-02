import type {PoolClient} from "pg";
type Client=Pick<PoolClient,"query"|"release">;
export type WeddingBillingDatabase=Pick<PoolClient,"query">&{connect?():Promise<Client>};
/** Short durable-intent transaction only. Never hold this lock over Square I/O. */
export async function withWeddingOwnerOperationLock<T>(db:WeddingBillingDatabase,userId:string,run:(client:Client)=>Promise<T>):Promise<T>{
 if(!db.connect)throw Error("Wedding billing operation requires a transactional connection");
 const client=await db.connect();let active=false,complete=false;
 try{
  await client.query("BEGIN");active=true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[userId]);
  const result=await run(client);
  await client.query("COMMIT");active=false;complete=true;
  return result;
 }catch(error){if(active)await client.query("ROLLBACK").catch(()=>undefined);throw error;}
 finally{client.release(complete?undefined:new Error("Discard uncertain Wedding operation transaction"));}
}
