import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {useUser} from "@/contexts/UserContext";
import {loadSquareSandboxSdk,type SquarePayments,type SquareCard} from "./WeddingSquareSandboxCheckout";

/** A saved subscription is updated; this form never starts another checkout. */
export function WeddingSquarePaymentMethod({onRefresh}:{onRefresh:()=>void}){
 const {user}=useUser();const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);const [uncertain,setUncertain]=useState(false);
 const [accepted,setAccepted]=useState(false);const [amount,setAmount]=useState<number|null>(null);
 const [message,setMessage]=useState("");
 const sdk=useRef<SquarePayments|null>(null);
 const card=useRef<SquareCard|null>(null);
 useEffect(()=>{
  if(!open)return;let canceled=false;let instance:typeof card.current=null;
  void(async()=>{try{
   const res=await fetch("/api/wedding/subscription/sandbox/payment-method/config",{credentials:"include",cache:"no-store"});
   const config=await res.json();
   if(!res.ok||config.ok!==true||config.available!==true||config.squareEnvironment!=="sandbox"||config.billingLive!==false||
    ![2499,4999].includes(config.monthlyAmountCents)||config.currency!=="USD")throw Error();
   const Square=await loadSquareSandboxSdk();if(canceled)return;
   const payments=await Square.payments(config.applicationId,config.locationId);instance=await payments.card();
   if(canceled){await instance.destroy?.();return;}
   await instance.attach("#wedding-square-replacement-card");
   if(canceled){await instance.destroy?.();return;}
   sdk.current=payments;card.current=instance;setAmount(config.monthlyAmountCents);setReady(true);
  }catch{if(!canceled)setMessage("Payment-method changes are unavailable or need reconciliation. You can check the previous update without submitting another card.");}})();
  return()=>{canceled=true;card.current=null;sdk.current=null;void instance?.destroy?.().catch(()=>undefined);};
 },[open]);
 async function update(){
  if(busy||uncertain||!accepted||!ready||!card.current||!sdk.current||!user?.email)return;
  setBusy(true);let started=false;
  try{
   const token=await card.current.tokenize();if(token.status!=="OK"||!token.token?.startsWith("cnon:"))throw Error("Check the secure card details.");
   const verification=await sdk.current.verifyBuyer(token.token,{intent:"STORE",billingContact:{email:user.email}});
   if(!verification.token)throw Error("Buyer verification is required.");
   started=true;setUncertain(true);
   const res=await fetch("/api/wedding/subscription/sandbox/payment-method",{method:"POST",credentials:"include",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceId:token.token,verificationToken:verification.token,acceptedExistingRecurringBilling:true})});
   const result=await res.json();if(!res.ok||result.ok!==true||result.status!=="payment_method_updated"||result.paidEntitlementChanged!==false||result.subscriptionCreated!==false)throw Error();
   setMessage("Payment method updated for your existing sandbox subscription. Paid access still requires verified invoice payment.");onRefresh();
  }catch(error){setMessage(started?"The update needs verification. Do not submit another card. Use Check previous update or contact support.":error instanceof Error?error.message:"Card verification failed.");}
  finally{setBusy(false);}
 }
 async function reconcile(){if(busy)return;setBusy(true);try{
  const res=await fetch("/api/wedding/subscription/sandbox/payment-method/reconcile",{method:"POST",credentials:"include",cache:"no-store",
   headers:{"Content-Type":"application/json"},body:"{}"});const result=await res.json();
  if(!res.ok||result.ok!==true||result.status!=="payment_method_updated"||result.paidEntitlementChanged!==false||result.subscriptionCreated!==false)throw Error();
  setUncertain(true);setMessage("The previous payment-method update is independently verified. No new card was submitted.");onRefresh();
 }catch{setMessage("The previous update cannot yet be verified. Contact support; do not submit another card.");}finally{setBusy(false);}}
 return <div className="mt-3 space-y-3">
  {!open?<Button variant="outline" type="button" onClick={()=>setOpen(true)}>Update payment method</Button>:<>
   <p className="text-sm">Square sandbox only. Replace the card for your existing monthly subscription.</p>
   <div id="wedding-square-replacement-card" aria-label="Square secure replacement card"/>
   {ready&&amount!==null?<label className="flex gap-2 text-sm"><input type="checkbox" checked={accepted}
    disabled={busy||uncertain} onChange={e=>setAccepted(e.target.checked)}/>
    Use this card for my existing ${(amount/100).toFixed(2)} USD monthly subscription under its current terms.</label>:null}
   <Button type="button" disabled={!ready||!accepted||busy||uncertain} onClick={()=>void update()}>Save replacement card</Button>
   <Button type="button" variant="outline" disabled={busy} onClick={()=>void reconcile()}>Check previous update</Button>
  </>}
  {message?<p role="status" className="text-sm text-amber-800">{message}</p>:null}
 </div>;
}
