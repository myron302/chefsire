import { z } from "zod";
import { weddingSquareBillingAudit } from "./wedding-square-billing-audit";
import { weddingSquareReconciliationReadback } from "./wedding-square-reconciliation-readback";

/**
 * Conservative, read-only period proof. Square chargedThroughDate proves
 * invoicing, NOT payment; require the same newest invoice to be PAID, its
 * attached payment to be COMPLETED and the independent refund/dispute audit.
 * Coverage cannot begin before the settled payment was created.
 *
 * No Neon write, Square mutation, automatic charge or paid entitlement.
 */
type Billing = Pick<typeof weddingSquareBillingAudit,"inspect">;
type Saved = Pick<typeof weddingSquareReconciliationReadback,"inspect">;
type Reader = (type:"subscriptions"|"invoices"|"payments",id:string)=>Promise<unknown>;
const id=z.string().min(1).max(200).refine(s=>!/\s|[\x00-\x1f\x7f]/.test(s));
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
  const t=Date.parse(s+"T00:00:00.000Z");
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s;
});
const rfc=z.string().datetime({offset:true});
const errors=z.array(z.unknown()).length(0).optional();
const sub=z.object({errors,subscription:z.object({
  id,customer_id:id,location_id:id,plan_variation_id:id,
  start_date:day,charged_through_date:day,
  status:z.enum(["ACTIVE","CANCELED"]),
  invoice_ids:z.array(id).min(1).max(1000),
}).passthrough()}).passthrough();
const inv=z.object({errors,invoice:z.object({
  id,subscription_id:id,order_id:id,location_id:id,
  created_at:rfc,status:z.literal("PAID"),
  primary_recipient:z.object({customer_id:id}).passthrough(),
}).passthrough()}).passthrough();
const money=z.object({amount:z.number().int().safe().nonnegative(),currency:z.literal("USD")}).passthrough();
const pay=z.object({errors,payment:z.object({
  id,order_id:id,customer_id:id,location_id:id,created_at:rfc,
  status:z.literal("COMPLETED"),
  amount_money:money,total_money:money,
  refund_ids:z.array(id).max(0).optional(),
  refunded_money:money.optional(),
}).passthrough()}).passthrough();

export class WeddingSquarePeriodReadbackError extends Error {
  constructor(){super("Wedding Square billing period requires provider reconciliation.");this.name="WeddingSquarePeriodReadbackError";}
}
export function createWeddingSquarePeriodReadback(billing:Billing,saved:Saved,reader:Reader){
  return {async inspect(attemptId:string,userId:string){
    if(process.env.SQUARE_ENV!=="sandbox"||
       process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
       !id.safeParse(attemptId).success||!id.safeParse(userId).success)
      throw new WeddingSquarePeriodReadbackError();
    try{
      const proof=await billing.inspect(attemptId,userId);
      const bound=await saved.inspect(attemptId,userId);
      if(!proof.noRefundsOrDisputes||proof.grantsEntitlement!==false||
         proof.requiresIndependentPeriodVerification!==true||
         !id.safeParse(proof.subscriptionId).success||
         !id.safeParse(proof.invoiceId).success||
         !id.safeParse(proof.paymentId).success||
         proof.subscriptionId!==bound.providerSubscriptionId||
         bound.status!=="confirmed")throw Error("Owner or amount mismatch");
      const subscription=sub.parse(await reader("subscriptions",proof.subscriptionId)).subscription;
      if(subscription.id!==proof.subscriptionId||
         subscription.customer_id!==bound.customerId||
         subscription.location_id!==bound.locationId||
         subscription.plan_variation_id!==bound.planVariationId||
         subscription.invoice_ids[0]!==proof.invoiceId||
         new Set(subscription.invoice_ids).size!==subscription.invoice_ids.length)
        throw Error("Latest provider invoice mismatch");
      const invoice=inv.parse(await reader("invoices",proof.invoiceId)).invoice;
      if(invoice.id!==proof.invoiceId||invoice.subscription_id!==proof.subscriptionId||
         invoice.location_id!==bound.locationId||
         invoice.primary_recipient.customer_id!==bound.customerId)
        throw Error("Invoice recipient mismatch");
      const payment=pay.parse(await reader("payments",proof.paymentId)).payment;
      if(payment.id!==proof.paymentId||payment.order_id!==invoice.order_id||
         payment.customer_id!==bound.customerId||payment.location_id!==bound.locationId||
         payment.amount_money.amount!==proof.verifiedAmountCents||
         payment.total_money.amount!==proof.verifiedAmountCents||
         (payment.refund_ids?.length??0)!==0||
         (payment.refunded_money?.amount??0)!==0)
        throw Error("Payment value mismatch");

      const startMs=Date.parse(subscription.start_date+"T00:00:00.000Z");
      const invoiceMs=Date.parse(invoice.created_at);
      const settledMs=Date.parse(payment.created_at);
      const lastDayMs=Date.parse(subscription.charged_through_date+"T00:00:00.000Z");
      const endMs=lastDayMs+86_400_000;
      const now=Date.now();
      // A future/late invoice, an unpaid month, or a charged-through date
      // spanning more than one monthly cycle never becomes paid access.
      if(![startMs,invoiceMs,settledMs,lastDayMs,endMs].every(Number.isFinite)||
         invoiceMs<startMs||settledMs<invoiceMs||settledMs>now||
         endMs<=now||endMs<=settledMs||
         endMs-invoiceMs>35*86_400_000)
        throw Error("Unproven paid interval");
      return Object.freeze({
        subscriptionId:proof.subscriptionId,invoiceId:proof.invoiceId,
        paymentId:proof.paymentId,verifiedAmountCents:proof.verifiedAmountCents,
        providerPaidAt:new Date(settledMs).toISOString(),
        periodStartsAt:new Date(settledMs).toISOString(),
        periodEndsAt:new Date(endMs).toISOString(),
        grantsEntitlement:false as const,requiresOperatorReconciliation:true as const,
        requiresIndependentRefundDisputeRecheck:true as const,
      });
    }catch{throw new WeddingSquarePeriodReadbackError();}
  }};
}

async function squareGet(type:"subscriptions"|"invoices"|"payments",key:string):Promise<unknown>{
  const token=process.env.SQUARE_ACCESS_TOKEN;
  if(process.env.SQUARE_ENV!=="sandbox"||
     process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
     !id.safeParse(token).success||!id.safeParse(key).success)
    throw new WeddingSquarePeriodReadbackError();
  try{
    const response=await fetch("https://connect.squareupsandbox.com/v2/"+type+"/"+encodeURIComponent(key),{
      method:"GET",redirect:"error",
      headers:{Authorization:`Bearer ${token}`,"Square-Version":"2025-10-16",Accept:"application/json"},
      signal:AbortSignal.timeout(15000),
    });
    if(!response||response.status!==200)throw Error("Square HTTP unavailable");
    const length=response.headers.get("content-length");
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw Error("Oversized Square response");
    const text=await response.text();
    if(text.length>65536)throw Error("Oversized Square response");
    return JSON.parse(text);
  }catch{throw new WeddingSquarePeriodReadbackError();}
}
export const weddingSquarePeriodReadback=createWeddingSquarePeriodReadback(
  weddingSquareBillingAudit,weddingSquareReconciliationReadback,squareGet);
