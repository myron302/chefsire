import { z } from "zod";
import { readWeddingSquareInvoicePaymentCustomer } from "./wedding-square-invoice-payment-customer";

type Sender = (url: string, init: RequestInit) => Promise<Response>;
const id = z.string().min(1).max(200).refine(v => !/[\s\x00-\x1f\x7f]/.test(v));
const money = z.object({amount:z.number().int().safe().nonnegative(),currency:z.literal("USD")});
const errors = z.array(z.unknown()).length(0).optional();
const refundEnvelope = z.object({errors,refund:z.object({
  id,payment_id:id,location_id:id,status:z.enum(["PENDING","COMPLETED","REJECTED","FAILED"]),
  amount_money:money,unlinked:z.literal(false).optional(),
})});
const paymentEnvelope = z.object({errors,payment:z.object({
  id,customer_id:id.optional(),order_id:id.optional(),location_id:id,status:z.literal("COMPLETED"),
  amount_money:money,total_money:money,refunded_money:money,
  refund_ids:z.array(id).min(1).max(1000),
})});
export class WeddingSquareRefundReadbackError extends Error {
  constructor(){super("Square refund requires independent reconciliation.");}
}
/** Read ORIGINAL JSON. A signed notification supplies only a lookup hint. */
export function createWeddingSquareRefundReadback(sender:Sender=fetch){
  async function get(path:string){
    if(process.env.SQUARE_ENV!=="sandbox"||process.env.SQUARE_LIVE_PAYMENTS_ENABLED==="true"||
       process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED!=="true"||
       !id.safeParse(process.env.SQUARE_ACCESS_TOKEN).success)throw new WeddingSquareRefundReadbackError();
    const response=await sender("https://connect.squareupsandbox.com/v2/"+path,{
      method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),headers:{
        Authorization:`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,"Square-Version":"2025-10-16",Accept:"application/json",
      },
    });
    if(response.status!==200)throw new WeddingSquareRefundReadbackError();
    const length=response.headers.get("content-length");
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw new WeddingSquareRefundReadbackError();
    const raw=await response.text();
    if(raw.length>65536)throw new WeddingSquareRefundReadbackError();
    return JSON.parse(raw);
  }
  async function inspect(refundId:string){
    try{
      if(!id.safeParse(refundId).success)throw new WeddingSquareRefundReadbackError();
      const refund=refundEnvelope.parse(await get("refunds/"+encodeURIComponent(refundId))).refund;
      if(refund.id!==refundId||refund.location_id!==process.env.SQUARE_LOCATION_ID||
         refund.amount_money.amount<=0)throw new WeddingSquareRefundReadbackError();
      // Pending/failed refunds do not prove funds returned. The event stays pending.
      if(refund.status!=="COMPLETED")throw new WeddingSquareRefundReadbackError();
      const payment=paymentEnvelope.parse(await get("payments/"+encodeURIComponent(refund.payment_id))).payment;
      if(payment.id!==refund.payment_id||payment.location_id!==refund.location_id||
         !payment.refund_ids.includes(refund.id)||
         payment.refunded_money.amount<refund.amount_money.amount||
         payment.refunded_money.amount>payment.total_money.amount||
         payment.total_money.amount!==payment.amount_money.amount)
        throw new WeddingSquareRefundReadbackError();
      return Object.freeze({refundId:refund.id,paymentId:payment.id,customerId:await readWeddingSquareInvoicePaymentCustomer(payment,sender),
        locationId:payment.location_id,amountCents:payment.amount_money.amount,
        completedRefund:true as const,grantsEntitlement:false as const});
    }catch{throw new WeddingSquareRefundReadbackError();}
  }
  return {
    inspect,
    /** Resolve a late payment hint without treating a refunded payment as clean. */
    async inspectPayment(paymentId:string){
      try{
        if(!id.safeParse(paymentId).success)throw new WeddingSquareRefundReadbackError();
        const payment=paymentEnvelope.parse(await get("payments/"+encodeURIComponent(paymentId))).payment;
        if(payment.id!==paymentId||payment.location_id!==process.env.SQUARE_LOCATION_ID||
           payment.refunded_money.amount<=0||payment.refunded_money.amount>payment.total_money.amount||
           payment.total_money.amount!==payment.amount_money.amount||
           new Set(payment.refund_ids).size!==payment.refund_ids.length)
          throw new WeddingSquareRefundReadbackError();
        // ANY independently completed refund invalidates full-price coverage.
        // At most 87 GETs including bounded invoice ownership fallback
        // (under eleven minutes of configured timeouts), within the queue lease. Missing/pending/unavailable candidates never prove
        // clean payment or restore entitlement.
        const customerId=await readWeddingSquareInvoicePaymentCustomer(payment,sender);
        for(const refundId of payment.refund_ids.slice(0,10)){
          try{
            const proof=await inspect(refundId);
            if(proof.paymentId===paymentId&&proof.customerId===customerId&&
               proof.locationId===payment.location_id&&proof.amountCents===payment.amount_money.amount)
              return proof;
          }catch{/* Another completed refund can still independently prove revocation. */}
        }
        throw new WeddingSquareRefundReadbackError();
      }catch{throw new WeddingSquareRefundReadbackError();}
    },
  };
}
export const weddingSquareRefundReadback=createWeddingSquareRefundReadback();
