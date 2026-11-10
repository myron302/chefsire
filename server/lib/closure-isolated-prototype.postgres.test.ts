/** Integrates the hard-gated closure prototype in disposable PostgreSQL. No production route. */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { executeIsolatedClosurePrototype, ClosureRefusedError } from "./closure-isolated-prototype";

const names = [
  "admin_audit_log","account_status","catering_booking_conversations","dm_participants","dm_messages",
  "store_drops","stores","likes","posts","products","orders","commissions","payouts",
  "wedding_square_subscriptions","wedding_square_enrollment_attempts","wedding_square_card_setup_attempts",
  "wedding_square_card_updates","catering_booking_invoices","catering_booking_payments","catering_booking_payment_attempts",
  "catering_bookings","drink_bundle_checkout_sessions","drink_collection_checkout_sessions",
  "drink_collection_sales_ledger","drink_collection_purchases","drink_collections","drink_gifts",
  "creator_memberships","creator_membership_checkout_sessions","creator_membership_sales_ledger",
  "drink_bundle_purchases","drink_bundles","meal_plan_purchases","meal_plan_blueprints","subscription_history","users",
];
const drop = `DROP TABLE IF EXISTS ${names.join(", ")} CASCADE;`;

if (!PG_URL) {
  test("isolated closure prototype needs CS_TEST_PG_URL", {skip:true},()=>{});
} else {
  test("account closes atomically in test database, preserves joins, redacts only authored DMs and is idempotent",async()=>{
    const local = await connectLocalPg();
    const { users } = await import("../../shared/schema");
    try {
      await local.query(drop);
      await local.query(`
        ${ddl(users, "users")};
        CREATE TABLE account_status(user_id varchar PRIMARY KEY REFERENCES users(id),status text,reason text,changed_by varchar,changed_at timestamptz DEFAULT now());
        CREATE TABLE products(id varchar PRIMARY KEY,seller_id varchar REFERENCES users(id),is_active boolean,is_digital boolean,digital_file_url text,images jsonb);
        CREATE TABLE stores(id varchar PRIMARY KEY,user_id varchar REFERENCES users(id),published boolean,bio text,handle text);
        CREATE TABLE store_drops(id varchar PRIMARY KEY,owner_id varchar REFERENCES users(id));
        CREATE TABLE posts(id varchar PRIMARY KEY,user_id varchar REFERENCES users(id),body text);
        CREATE TABLE likes(id varchar PRIMARY KEY,user_id varchar REFERENCES users(id),post_id varchar REFERENCES posts(id) ON DELETE RESTRICT);
        CREATE TABLE orders(id varchar PRIMARY KEY,buyer_id varchar REFERENCES users(id),seller_id varchar REFERENCES users(id),
          product_id varchar REFERENCES products(id),status text,payment_status text,inventory_status text,refund_idempotency_key text,capture_request_snapshot jsonb);
        CREATE TABLE commissions(id varchar PRIMARY KEY,seller_id varchar,status text);
        CREATE TABLE payouts(id varchar PRIMARY KEY,seller_id varchar,status text);
        CREATE TABLE wedding_square_subscriptions(id varchar PRIMARY KEY,user_id varchar,provider_status text);
        CREATE TABLE wedding_square_enrollment_attempts(id varchar PRIMARY KEY,user_id varchar,status text);
        CREATE TABLE wedding_square_card_setup_attempts(id varchar PRIMARY KEY,user_id varchar,status text);
        CREATE TABLE wedding_square_card_updates(id varchar PRIMARY KEY,user_id varchar,status text);
        CREATE TABLE catering_bookings(id varchar PRIMARY KEY,customer_id varchar,provider_id varchar,status text);
        CREATE TABLE catering_booking_invoices(id varchar PRIMARY KEY,booking_id varchar,status text,amount_cents bigint);
        CREATE TABLE catering_booking_payments(id varchar PRIMARY KEY,invoice_id varchar,status text,amount_cents bigint);
        CREATE TABLE catering_booking_payment_attempts(id varchar PRIMARY KEY,customer_id varchar,provider_id varchar,
          state text,square_create_started_at timestamp,square_create_resolved_at timestamp,
          square_create_uncertain_at timestamp,closure_verified_at timestamp,refund_review_at timestamp);
        CREATE TABLE drink_bundle_checkout_sessions(id varchar PRIMARY KEY,user_id varchar,status text);
        CREATE TABLE drink_collections(id varchar PRIMARY KEY,user_id varchar);
        CREATE TABLE drink_collection_checkout_sessions(id varchar PRIMARY KEY,user_id varchar,collection_id varchar,status text);
        CREATE TABLE drink_collection_sales_ledger(id varchar PRIMARY KEY,user_id varchar,collection_id varchar,status text);
        CREATE TABLE drink_collection_purchases(id varchar PRIMARY KEY,user_id varchar,collection_id varchar,status text,access_revoked_at timestamp);
        CREATE TABLE drink_gifts(id varchar PRIMARY KEY,purchaser_user_id varchar,recipient_user_id varchar,status text);
        CREATE TABLE creator_memberships(id varchar PRIMARY KEY,user_id varchar,creator_user_id varchar,status text);
        CREATE TABLE creator_membership_checkout_sessions(id varchar PRIMARY KEY,user_id varchar,creator_user_id varchar,status text);
        CREATE TABLE creator_membership_sales_ledger(id varchar PRIMARY KEY,user_id varchar,creator_user_id varchar,status text);
        CREATE TABLE drink_bundles(id varchar PRIMARY KEY,user_id varchar);
        CREATE TABLE drink_bundle_purchases(id varchar PRIMARY KEY,user_id varchar,bundle_id varchar,status text,access_revoked_at timestamp);
        CREATE TABLE meal_plan_blueprints(id varchar PRIMARY KEY,creator_id varchar);
        CREATE TABLE meal_plan_purchases(id varchar PRIMARY KEY,user_id varchar,blueprint_id varchar,payment_status text);
        CREATE TABLE subscription_history(id varchar PRIMARY KEY,user_id varchar,status text);
        CREATE TABLE dm_messages(id varchar PRIMARY KEY,sender_id varchar REFERENCES users(id),thread_id varchar,body text,attachments jsonb);
        CREATE TABLE dm_participants(id varchar PRIMARY KEY,thread_id varchar,user_id varchar REFERENCES users(id));
        CREATE TABLE catering_booking_conversations(id varchar PRIMARY KEY,thread_id varchar);
        CREATE TABLE admin_audit_log(id bigserial PRIMARY KEY,actor_type text,actor_id varchar,actor_label text,
          action text,target_type text,target_id varchar,reason text,details jsonb);
      `);
      const [member] = (await local.query("INSERT INTO users(username,email,display_name) VALUES('close-me','close@example.test','Close Me') RETURNING id")).rows;
      const [friend] = (await local.query("INSERT INTO users(username,email,display_name) VALUES('friend','friend@example.test','Friend') RETURNING id")).rows;
      await local.query("INSERT INTO posts VALUES('p1',$1,'private text')",[member.id]);
      await local.query("INSERT INTO likes VALUES('l1',$1,'p1')",[member.id]);
      await local.query("INSERT INTO dm_messages VALUES('m1',$1,'social','original text','[]')",[member.id]);
      await local.query("INSERT INTO dm_messages VALUES('m2',$1,'social','friend text','[]')",[friend.id]);
      await local.query("INSERT INTO dm_participants VALUES('d1','social',$1),('d2','social',$2)",[member.id,friend.id]);
      await local.query("INSERT INTO products VALUES('product1',$1,true,false,null,'[]')",[member.id]);
      await local.query("INSERT INTO stores VALUES('store1',$1,true,'Personal bio','reserved-handle')",[member.id]);
      await local.query("INSERT INTO store_drops VALUES('drop1',$1)",[member.id]);

      const done=await executeIsolatedClosurePrototype({userId:member.id,actor:{kind:"member",memberId:member.id}});
      assert.deepEqual(done,{changed:true,status:"closed",privateRowsErased:2,messagesRedacted:1,productsUnpublished:1});
      const u=(await local.query("SELECT username,display_name,email,password,auth_version FROM users WHERE id=$1",[member.id])).rows[0];
      assert.equal(u.display_name,"Deleted user");
      assert.match(u.username,/^deleted-[a-f0-9]{32}$/);
      assert.equal(u.password,null);
      assert.equal(u.auth_version,2);
      assert.equal((await local.query("SELECT status FROM account_status WHERE user_id=$1",[member.id])).rows[0].status,"closed");
      assert.equal((await local.query("SELECT count(*)::int n FROM posts")).rows[0].n,0);
      assert.deepEqual((await local.query("SELECT body FROM dm_messages ORDER BY id")).rows,
        [{body:"This message was removed"},{body:"friend text"}]);
      assert.equal((await local.query("SELECT published FROM stores WHERE id='store1'")).rows[0].published,false);
      assert.equal((await local.query("SELECT is_active FROM products WHERE id='product1'")).rows[0].is_active,false);
      assert.equal((await local.query("SELECT count(*)::int n FROM admin_audit_log")).rows[0].n,1);
      assert.deepEqual(await executeIsolatedClosurePrototype({userId:member.id,actor:{kind:"member",memberId:member.id}}),
        {changed:false,status:"closed"});
      await assert.rejects(
        executeIsolatedClosurePrototype({userId:member.id,actor:{kind:"member",memberId:friend.id}}),
        /only close own/,
        "a different member cannot probe even the idempotent closed-account response",
      );
      assert.equal((await local.query("SELECT count(*)::int n FROM admin_audit_log")).rows[0].n,1);

      const [blocked] = (await local.query("INSERT INTO users(username,email,display_name) VALUES('has-order','order@example.test','Order User') RETURNING id")).rows;
      await local.query("INSERT INTO orders VALUES ('pending-order',$1,$2,null,'pending','unverified','unreserved',null,null)",[blocked.id,friend.id]);
      await local.query("INSERT INTO posts VALUES('preserve-on-block',$1,'not deleted')",[blocked.id]);
      await assert.rejects(executeIsolatedClosurePrototype({userId:blocked.id,actor:{kind:"member",memberId:blocked.id}}),
        (e:any)=>e instanceof ClosureRefusedError && e.blockers.some((b:any)=>b.code==="MARKETPLACE_ORDERS"));
      assert.equal((await local.query("SELECT username FROM users WHERE id=$1",[blocked.id])).rows[0].username,"has-order");
      assert.equal((await local.query("SELECT count(*)::int n FROM posts WHERE id='preserve-on-block'")).rows[0].n,1);
      assert.equal((await local.query("SELECT count(*)::int n FROM admin_audit_log")).rows[0].n,1);
    } finally {
      await local.query(drop);
      await local.end();
    }
  });
}
