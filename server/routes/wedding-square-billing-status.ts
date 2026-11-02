import { Router, type RequestHandler } from "express";
import { requireAuth } from "../middleware";
import { weddingSquareBillingStatus } from "../lib/wedding-square-billing-status";

/**
 * Read-only customer billing management snapshot.
 * An authoritative Square payment, card or renewal date is never guessed.
 * No route in this module changes a plan, triggers Square or stores a card.
 */
type Source=Pick<typeof weddingSquareBillingStatus,"inspect">;
export function createWeddingSquareBillingStatusRouter(
 source:Source,auth:RequestHandler=requireAuth,
){
 const router=Router();
 router.get("/subscription/billing-status",auth,async(req,res)=>{
   res.set("Cache-Control","private, no-store");
   res.set("Pragma","no-cache");
   const userId=req.user?.id;
   if(typeof userId!=="string"||!userId){
     return res.status(401).json({ok:false,code:"AUTH_REQUIRED"});
   }
   try {
     const result=await source.inspect(userId);
     if(result.ok!==true||result.billingLive!==false||
        result.requiresProviderVerification!==true)throw Error("Invalid billing result");
     return res.json(result);
   }catch{
     return res.status(503).json({ok:false,code:"WEDDING_BILLING_STATUS_UNAVAILABLE"});
   }
 });
 return router;
}
export default createWeddingSquareBillingStatusRouter(weddingSquareBillingStatus);
