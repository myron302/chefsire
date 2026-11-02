import { z } from "zod";
type Sender=(url:string,init:RequestInit)=>Promise<Response>;
const id=z.string().min(1).max(200).refine(v=>!/[\s\x00-\x1f\x7f]/.test(v));
const envelope=z.object({errors:z.array(z.unknown()).length(0).optional(),subscription:z.object({
 id,customer_id:id,location_id:id,plan_variation_id:id,card_id:id,
 status:z.enum(["PENDING","ACTIVE"]),version:z.number().int().safe().nonnegative(),
 canceled_date:z.null().optional(),
})});
export class WeddingSquareCardUpdateTransportError extends Error{
 constructor(){super("Square payment method update requires reconciliation.");}
}
export function createWeddingSquareCardUpdateTransport(sender:Sender=fetch){
 async function request(subscriptionId:string,update?:{cardId:string;version:number}){
  if(process.env.SQUARE_ENV!=="sandbox"||process.env.SQUARE_LIVE_PAYMENTS_ENABLED==="true"||
     process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
     process.env.WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED!=="true"||
     !id.safeParse(process.env.SQUARE_ACCESS_TOKEN).success||!id.safeParse(subscriptionId).success||
     (update&&(!id.safeParse(update.cardId).success||!Number.isSafeInteger(update.version)||update.version<0)))
   throw new WeddingSquareCardUpdateTransportError();
  try{
   const response=await sender("https://connect.squareupsandbox.com/v2/subscriptions/"+encodeURIComponent(subscriptionId),{
    method:update?"PUT":"GET",redirect:"error",signal:AbortSignal.timeout(15000),headers:{
     Authorization:`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,"Square-Version":"2025-10-16",Accept:"application/json",
     ...(update?{"Content-Type":"application/json"}:{}),
    },...(update?{body:JSON.stringify({subscription:{card_id:update.cardId,version:update.version}})}:{}),
   });
   if(response.status!==200)throw new WeddingSquareCardUpdateTransportError();
   const length=response.headers.get("content-length");
   if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw new WeddingSquareCardUpdateTransportError();
   const raw=await response.text();if(raw.length>65536)throw new WeddingSquareCardUpdateTransportError();
   const s=envelope.parse(JSON.parse(raw)).subscription;
   if(s.id!==subscriptionId||(update&&(s.card_id!==update.cardId||s.version<=update.version)))
    throw new WeddingSquareCardUpdateTransportError();
   return Object.freeze({id:s.id,customerId:s.customer_id,locationId:s.location_id,planVariationId:s.plan_variation_id,
    cardId:s.card_id,version:s.version,status:s.status});
  }catch{throw new WeddingSquareCardUpdateTransportError();}
 }
 return {get:(subscriptionId:string)=>request(subscriptionId),
  update:(subscriptionId:string,cardId:string,version:number)=>request(subscriptionId,{cardId,version})};
}
export const weddingSquareCardUpdateTransport=createWeddingSquareCardUpdateTransport();
