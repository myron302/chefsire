import {createHash,randomUUID} from "node:crypto";
import {pool} from "../db";
import {weddingSquareSandboxMerchantAttestation} from "./wedding-square-sandbox-merchant-attestation";
import {weddingSquareSandboxCustomerCardApi} from "./wedding-square-sandbox-customer-card-api";
import {weddingSquareSandboxCardSetupTransport} from "./wedding-square-sandbox-card-setup-transport";
import {weddingSquareCardUpdateTransport} from "./wedding-square-card-update-transport";
import {WEDDING_CONSENT_VERSION,WEDDING_MONTHLY_CENTS} from "./wedding-square-billing-policy";
import {withWeddingOwnerOperationLock,type WeddingBillingDatabase as Db} from "./wedding-square-owner-operation-lock";
type Merchant=Pick<typeof weddingSquareSandboxMerchantAttestation,"inspect">;
type Cards=Pick<typeof weddingSquareSandboxCustomerCardApi,"getCustomer"|"getCard">;
type Create=Pick<typeof weddingSquareSandboxCardSetupTransport,"createCard">;
type Provider=Pick<typeof weddingSquareCardUpdateTransport,"get"|"update">;
type Row={id:string;user_id:string;tier:"premium"|"elite";square_customer_id:string;square_card_id:string;
 square_subscription_id:string;square_plan_variation_id:string;agreed_monthly_amount_cents:number;
 agreed_currency:string;billing_consent_terms_version:string};
type Attempt={id:string;replacement_card_id:string|null;expected_provider_version:number;previous_card_id:string;status:string};
const valid=(v:unknown,n=200):v is string=>typeof v==="string"&&v.length>0&&v.length<=n&&!/[\s\x00-\x1f\x7f]/.test(v);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function weddingSquareCardUpdateEnabled(){return process.env.SQUARE_ENV==="sandbox"&&
 process.env.SQUARE_LIVE_PAYMENTS_ENABLED!=="true"&&process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED==="true"&&
 process.env.WEDDING_SQUARE_SANDBOX_CUSTOMER_CARD_WRITE_ENABLED==="true"&&process.env.WEDDING_SQUARE_SANDBOX_CARD_UPDATE_ENABLED==="true"&&
 valid(process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID)&&valid(process.env.SQUARE_LOCATION_ID);}
export class WeddingSquareCardUpdateError extends Error{
 constructor(){super("Payment method update needs provider reconciliation. Do not resubmit.");}
}
/** Existing subscription only: no new Customer, subscription, consent or paid grant. */
export function createWeddingSquareCardUpdate(db:Db,merchant:Merchant,cards:Cards,create:Create,provider:Provider){
 async function owner(userId:string){
  if(!weddingSquareCardUpdateEnabled()||!valid(userId,100))throw new WeddingSquareCardUpdateError();
  const m=await merchant.inspect();
  if(m.verifiedSandboxMerchantContext!==true||m.merchantId!==process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||
     m.locationId!==process.env.SQUARE_LOCATION_ID||m.grantsEntitlement!==false)throw new WeddingSquareCardUpdateError();
  const selected=await db.query<Row>(`SELECT id::text AS id,user_id,tier,square_customer_id,square_card_id,
    square_subscription_id,square_plan_variation_id,agreed_monthly_amount_cents,agreed_currency,billing_consent_terms_version
   FROM wedding_square_subscriptions WHERE user_id=$1 AND square_environment='sandbox'
    AND square_merchant_id=$2 AND square_location_id=$3 AND provider_status IN ('ACTIVE','PENDING')
    AND cancellation_requested_at IS NULL AND provider_cancelled_at IS NULL LIMIT 2`,[userId,m.merchantId,m.locationId]);
  if(selected.rows.length!==1)throw new WeddingSquareCardUpdateError();
  const row=selected.rows[0];
  if(!uuid.test(row.id)||row.user_id!==userId||!valid(row.square_customer_id)||!valid(row.square_card_id)||
    !valid(row.square_subscription_id)||!valid(row.square_plan_variation_id)||!["premium","elite"].includes(row.tier)||
    row.agreed_currency!=="USD"||row.agreed_monthly_amount_cents!==WEDDING_MONTHLY_CENTS[row.tier]||
    row.billing_consent_terms_version!==WEDDING_CONSENT_VERSION)throw new WeddingSquareCardUpdateError();
  const customer=await cards.getCustomer(row.square_customer_id);
  if(customer.id!==row.square_customer_id||customer.referenceId!==userId)throw new WeddingSquareCardUpdateError();
  return row;
 }
 function matches(row:Row,s:Awaited<ReturnType<Provider["get"]>>,cardId:string){
  return s.id===row.square_subscription_id&&s.customerId===row.square_customer_id&&s.locationId===process.env.SQUARE_LOCATION_ID&&
    s.planVariationId===row.square_plan_variation_id&&s.cardId===cardId&&Number.isSafeInteger(s.version)&&s.version>=0&&
    ["ACTIVE","PENDING"].includes(s.status);
 }
 async function verifyCard(row:Row,cardId:string){
  const card=await cards.getCard(cardId);
  if(card.id!==cardId||card.customerId!==row.square_customer_id||card.merchantId!==process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||
    card.enabled!==true)throw new WeddingSquareCardUpdateError();
 }
 async function finish(row:Row,a:Attempt){
  if(!a.replacement_card_id||!valid(a.replacement_card_id)||!Number.isSafeInteger(a.expected_provider_version))throw new WeddingSquareCardUpdateError();
  await verifyCard(row,a.replacement_card_id);
  const after=await provider.get(row.square_subscription_id);
  if(!matches(row,after,a.replacement_card_id)||after.version<=a.expected_provider_version)throw new WeddingSquareCardUpdateError();
  const saved=await db.query(`WITH changed AS (
    UPDATE wedding_square_subscriptions SET square_card_id=$3,last_reconciled_at=now(),updated_at=now()
     WHERE id=$1::uuid AND user_id=$2 AND square_environment='sandbox' AND square_merchant_id=$4
       AND square_location_id=$5 AND square_subscription_id=$6 AND square_card_id=$7
       AND cancellation_requested_at IS NULL AND provider_cancelled_at IS NULL
       AND provider_status IN ('ACTIVE','PENDING')
       AND EXISTS(SELECT 1 FROM wedding_square_card_updates WHERE id=$8::uuid AND user_id=$2
         AND wedding_subscription_id=$1::uuid AND status IN ('subscription_submitting','needs_reconciliation')
         AND replacement_card_id=$3)
     RETURNING id
   ) UPDATE wedding_square_card_updates SET status='confirmed',updated_at=now()
      WHERE id=$8::uuid AND user_id=$2 AND EXISTS(SELECT 1 FROM changed) RETURNING id`,
    [row.id,row.user_id,a.replacement_card_id,process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,
     process.env.SQUARE_LOCATION_ID,row.square_subscription_id,a.previous_card_id,a.id]);
  if(saved.rows.length!==1)throw new WeddingSquareCardUpdateError();
  return {status:"payment_method_updated" as const,paidEntitlementChanged:false as const,subscriptionCreated:false as const};
 }
 return {
  async inspect(userId:string){try{
   const row=await owner(userId);
   const pending=await db.query(`SELECT status FROM wedding_square_card_updates WHERE user_id=$1 AND status<>'confirmed' LIMIT 2`,[userId]);
   if(!Array.isArray(pending.rows)||pending.rows.length>1)throw new WeddingSquareCardUpdateError();
   const current=await provider.get(row.square_subscription_id);
   const available=pending.rows.length===0&&matches(row,current,row.square_card_id);
   return {available,needsReconciliation:!available,monthlyAmountCents:row.agreed_monthly_amount_cents,currency:"USD" as const};
  }catch{throw new WeddingSquareCardUpdateError();}},
  async update(userId:string,sourceId:string,verificationToken:string){
   let attemptId:string|undefined;
   try{
    if(!valid(sourceId,16384)||!sourceId.startsWith("cnon:")||!valid(verificationToken,16384))throw new WeddingSquareCardUpdateError();
    const row=await owner(userId);
    const before=await provider.get(row.square_subscription_id);
    if(!matches(row,before,row.square_card_id))throw new WeddingSquareCardUpdateError();
    const key=randomUUID();
    const reserved=await withWeddingOwnerOperationLock(db,userId,client=>client.query<{id:string}>(`INSERT INTO wedding_square_card_updates
      (wedding_subscription_id,user_id,square_environment,square_merchant_id,square_subscription_id,
       previous_card_id,source_digest,card_idempotency_key,expected_provider_version,status)
      SELECT id,user_id,'sandbox',square_merchant_id,square_subscription_id,square_card_id,$3,$4,$5,'reserved'
       FROM wedding_square_subscriptions WHERE id=$1::uuid AND user_id=$2 AND square_environment='sandbox'
        AND square_merchant_id=$6 AND square_location_id=$7 AND square_card_id=$8
        AND provider_status IN ('ACTIVE','PENDING') AND cancellation_requested_at IS NULL AND provider_cancelled_at IS NULL
      RETURNING id::text AS id`,[row.id,userId,createHash("sha256").update(sourceId).digest("hex"),key,before.version,
       process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,process.env.SQUARE_LOCATION_ID,row.square_card_id]));
    if(reserved.rows.length!==1||!uuid.test(reserved.rows[0].id))throw new WeddingSquareCardUpdateError();
    attemptId=reserved.rows[0].id;
    const claimed=await db.query(`UPDATE wedding_square_card_updates SET status='card_submitting',updated_at=now()
      WHERE id=$1::uuid AND user_id=$2 AND status='reserved' RETURNING id`,[attemptId,userId]);
    if(claimed.rows.length!==1)throw new WeddingSquareCardUpdateError();
    const card=await create.createCard({idempotencyKey:key,sourceId,verificationToken,customerId:row.square_customer_id,
     referenceId:userId,expectedMerchantId:process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID!});
    if(!valid(card.id)||card.customerId!==row.square_customer_id||card.merchantId!==process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID||
      card.enabled!==true)throw new WeddingSquareCardUpdateError();
    // Persist the replacement before PUT. Even a lost PUT response can then
    // be reconciled by GET without creating a second card or subscription.
    const updating=await db.query(`UPDATE wedding_square_card_updates SET replacement_card_id=$3,
      status='subscription_submitting',updated_at=now() WHERE id=$1::uuid AND user_id=$2 AND status='card_submitting' RETURNING id`,
      [attemptId,userId,card.id]);
    if(updating.rows.length!==1)throw new WeddingSquareCardUpdateError();
    await verifyCard(row,card.id);
    const after=await provider.update(row.square_subscription_id,card.id,before.version);
    if(!matches(row,after,card.id)||after.version<=before.version)throw new WeddingSquareCardUpdateError();
    return await finish(row,{id:attemptId,replacement_card_id:card.id,expected_provider_version:before.version,
     previous_card_id:row.square_card_id,status:"subscription_submitting"});
   }catch{
    if(attemptId)await db.query(`UPDATE wedding_square_card_updates SET status='needs_reconciliation',updated_at=now()
      WHERE id=$1::uuid AND user_id=$2 AND status<>'confirmed'`,[attemptId,userId]).catch(()=>undefined);
    throw new WeddingSquareCardUpdateError();
   }
  },
  async reconcile(userId:string){try{
   const row=await owner(userId);
   const pending=await db.query<Attempt>(`SELECT id::text AS id,replacement_card_id,expected_provider_version::float8 AS expected_provider_version,previous_card_id,status
     FROM wedding_square_card_updates WHERE wedding_subscription_id=$1::uuid AND user_id=$2 AND square_environment='sandbox'
      AND square_merchant_id=$3 AND square_subscription_id=$4 AND status IN ('subscription_submitting','needs_reconciliation') LIMIT 2`,
     [row.id,userId,process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,row.square_subscription_id]);
   if(pending.rows.length===0){
    const done=await db.query<Attempt>(`SELECT id::text AS id,replacement_card_id,expected_provider_version::float8 AS expected_provider_version,previous_card_id,status
      FROM wedding_square_card_updates WHERE wedding_subscription_id=$1::uuid AND user_id=$2 AND status='confirmed'
       AND square_environment='sandbox' AND square_merchant_id=$3 AND replacement_card_id=$4
      ORDER BY created_at DESC,id DESC LIMIT 1`,[row.id,userId,process.env.WEDDING_SQUARE_SANDBOX_MERCHANT_ID,row.square_card_id]);
    if(done.rows.length!==1||!uuid.test(done.rows[0].id))throw new WeddingSquareCardUpdateError();
    await verifyCard(row,row.square_card_id);
    const current=await provider.get(row.square_subscription_id);
    if(!matches(row,current,row.square_card_id)||!Number.isSafeInteger(done.rows[0].expected_provider_version)||
       current.version<=done.rows[0].expected_provider_version)throw new WeddingSquareCardUpdateError();
    return {status:"payment_method_updated" as const,paidEntitlementChanged:false as const,subscriptionCreated:false as const};
   }
   if(pending.rows.length!==1||!uuid.test(pending.rows[0].id)||pending.rows[0].previous_card_id!==row.square_card_id)
    throw new WeddingSquareCardUpdateError();
   return await finish(row,pending.rows[0]);
  }catch{throw new WeddingSquareCardUpdateError();}},
 };
}
export const weddingSquareCardUpdate=createWeddingSquareCardUpdate(pool as Db,weddingSquareSandboxMerchantAttestation,
 weddingSquareSandboxCustomerCardApi,weddingSquareSandboxCardSetupTransport,weddingSquareCardUpdateTransport);
