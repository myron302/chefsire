import {Router,type RequestHandler,type Request} from "express";
import {z} from "zod";
import {requireAuth} from "../middleware";
import {weddingSquareEnrollmentSubmitLimiter} from "../middleware/rate-limit";
import {weddingSquareCardUpdate,weddingSquareCardUpdateEnabled} from "../lib/wedding-square-card-update";
type Service=Pick<typeof weddingSquareCardUpdate,"inspect"|"update"|"reconcile">;
const body=z.object({sourceId:z.string().min(6).max(16384).startsWith("cnon:"),
 verificationToken:z.string().min(1).max(16384),acceptedExistingRecurringBilling:z.literal(true)}).strict();
const empty=z.object({}).strict();
const ownerId=(req:Request)=>{
 const user=req.user as {id?:unknown}|undefined;
 return typeof user?.id==="string"&&/^[^\s\x00-\x1f\x7f]{1,100}$/.test(user.id)?user.id:null;
};
export function createWeddingSquareCardUpdateRouter(service:Service,auth:RequestHandler=requireAuth,
 limiter:RequestHandler=weddingSquareEnrollmentSubmitLimiter){
 const router=Router();
 const gate:RequestHandler=(req,res,next)=>{
  res.set("Cache-Control","private, no-store");
  if(!weddingSquareCardUpdateEnabled())return res.status(503).json({ok:false,code:"WEDDING_CARD_UPDATE_DISABLED"});
  if(!ownerId(req))return res.status(401).json({ok:false});
  try{const origin=process.env.WEDDING_SQUARE_ALLOWED_ORIGIN!;const url=new URL(origin);
   if(url.protocol!=="https:"||url.origin!==origin||url.pathname!=="/"||url.username||url.password||url.search||url.hash)
    throw Error();
   if(req.method!=="GET"&&req.get("origin")!==origin)return res.status(403).json({ok:false});
  }catch{return res.status(503).json({ok:false,code:"WEDDING_CARD_UPDATE_DISABLED"});}
  next();
 };
 router.get("/subscription/sandbox/payment-method/config",auth,gate,async(req,res)=>{
  try{
   const state=await service.inspect(ownerId(req)!);
   if(!state.available)return res.status(409).json({ok:false,needsReconciliation:true});
   if(!process.env.SQUARE_APPLICATION_ID||!process.env.SQUARE_LOCATION_ID)throw Error();
   return res.json({ok:true,...state,applicationId:process.env.SQUARE_APPLICATION_ID,
    locationId:process.env.SQUARE_LOCATION_ID,squareEnvironment:"sandbox",billingLive:false});
  }catch{return res.status(409).json({ok:false,needsReconciliation:true});}
 });
 router.post("/subscription/sandbox/payment-method",auth,limiter,gate,async(req,res)=>{
  const parsed=body.safeParse(req.body);if(!parsed.success)return res.status(400).json({ok:false});
  try{const result=await service.update(ownerId(req)!,parsed.data.sourceId,parsed.data.verificationToken);
   if(result.status!=="payment_method_updated"||result.paidEntitlementChanged!==false||result.subscriptionCreated!==false)throw Error();
   return res.status(202).json({ok:true,...result});
  }catch{return res.status(409).json({ok:false,needsReconciliation:true,safeToResubmit:false});}
 });
 router.post("/subscription/sandbox/payment-method/reconcile",auth,limiter,gate,async(req,res)=>{
  if(!empty.safeParse(req.body??{}).success)return res.status(400).json({ok:false});
  try{const result=await service.reconcile(ownerId(req)!);
   if(result.status!=="payment_method_updated"||result.paidEntitlementChanged!==false||result.subscriptionCreated!==false)throw Error();
   return res.json({ok:true,...result});
  }catch{return res.status(409).json({ok:false,needsReconciliation:true,safeToResubmit:false});}
 });
 return router;
}
export default createWeddingSquareCardUpdateRouter(weddingSquareCardUpdate);
