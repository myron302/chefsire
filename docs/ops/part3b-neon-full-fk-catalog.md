# ChefSire Part 3b — full production FK and financial table metadata audit

**Audited:** 2026-11-10, the existing Neon production PostgreSQL branch. **Scope:** PostgreSQL public-schema `pg_constraint` foreign-key definitions and `information_schema.columns` names only. The queries were **SELECT only**. No member data, payment contents, secrets, Square provider records or media bytes were retrieved, and no production writes, schema changes or branch changes were made.

**Catalog coverage:** 217 public-schema tables with columns; 353 foreign keys; 192 direct users.id FKs; 54 commerce/financial/contract-named tables; 117 CASCADE edges reachable from a hard delete of users. This is a snapshot: rerun before eventual activation and fail closed on schema drift.

**Policy:** This is NOT a list of tables to delete or permission to retain all personal data indefinitely. Financial record retention, provider disputes, consumer deletion exceptions, access controls, backup expiry and legal holds require legal/accounting policy and provider evidence. Never hard-delete users; preserve opaque FK identities.

## 1. Every direct FK to users.id (production definitions)

| Table | Delete action | FK definition |
|---|---|---|
| `account_status` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `adaptive_planner_profiles` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `adaptive_planner_snapshots` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `ai_suggestions` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `body_metrics` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_availability_exceptions` | **CASCADE** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_availability_settings` | **CASCADE** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_availability_weekly_rules` | **CASCADE** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_booking_access_details` | **RESTRICT** | `FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_activity` | **RESTRICT** | `FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_adjustments` | **RESTRICT** | `FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_adjustments` | **RESTRICT** | `FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_amendments` | **RESTRICT** | `FOREIGN KEY (proposed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_amendments` | **RESTRICT** | `FOREIGN KEY (responded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_billing` | **RESTRICT** | `FOREIGN KEY (terms_updated_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_closeout` | **RESTRICT** | `FOREIGN KEY (closed_out_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_closeout` | **RESTRICT** | `FOREIGN KEY (last_reopened_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_closeout` | **RESTRICT** | `FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_closeout_items` | **RESTRICT** | `FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_equipment` | **RESTRICT** | `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_execution_create_requests` | **RESTRICT** | `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_execution_milestones` | **RESTRICT** | `FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_execution_timeline` | **RESTRICT** | `FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_execution_timeline` | **RESTRICT** | `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_files` | **RESTRICT** | `FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_files` | **RESTRICT** | `FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_invoices` | **RESTRICT** | `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_invoices` | **RESTRICT** | `FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_message_requests` | **RESTRICT** | `FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_payment_attempts` | **RESTRICT** | `FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_payment_attempts` | **RESTRICT** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_payments` | **RESTRICT** | `FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_payments` | **RESTRICT** | `FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_staff_assignments` | **RESTRICT** | `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_booking_tasks` | **RESTRICT** | `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_bookings` | **RESTRICT** | `FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_bookings` | **RESTRICT** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_inquiries` | **NO ACTION** | `FOREIGN KEY (chef_id) REFERENCES users(id)` |
| `catering_inquiries` | **NO ACTION** | `FOREIGN KEY (customer_id) REFERENCES users(id)` |
| `catering_offer_revisions` | **RESTRICT** | `FOREIGN KEY (proposed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT` |
| `catering_packages` | **CASCADE** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_portfolio_items` | **CASCADE** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_reviews` | **CASCADE** | `FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE` |
| `catering_reviews` | **CASCADE** | `FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE` |
| `challenge_progress` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `club_join_requests` | **SET NULL** | `FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL` |
| `club_join_requests` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `club_memberships` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `club_post_likes` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `club_posts` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `clubs` | **CASCADE** | `FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE` |
| `comment_likes` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `comments` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `commissions` | **CASCADE** | `FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_analytics` | **NO ACTION** | `FOREIGN KEY (creator_id) REFERENCES users(id)` |
| `creator_campaign_action_states` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_campaign_follows` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_campaign_playbook_profiles` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_campaign_rollout_timeline_events` | **SET NULL** | `FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `creator_campaign_spotlight_events` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `creator_campaign_surface_events` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `creator_campaign_templates` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_campaign_variant_events` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `creator_campaigns` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_collaborations` | **CASCADE** | `FOREIGN KEY (collaborator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_collaborations` | **CASCADE** | `FOREIGN KEY (owner_creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_drop_events` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `creator_drop_rsvps` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_drops` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_membership_checkout_sessions` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_membership_checkout_sessions` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_membership_plans` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_membership_sales_ledger` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_membership_sales_ledger` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_memberships` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_memberships` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_posts` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `creator_roadmap_items` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `custom_drinks` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `dm_messages` | **CASCADE** | `FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE` |
| `dm_participants` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_bundle_checkout_sessions` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_bundle_purchases` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_bundles` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_challenge_submissions` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collection_checkout_sessions` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collection_events` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `drink_collection_promotions` | **CASCADE** | `FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collection_purchases` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collection_reviews` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collection_sales_ledger` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collection_wishlists` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_collections` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_events` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `drink_gifts` | **CASCADE** | `FOREIGN KEY (purchaser_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `drink_gifts` | **SET NULL** | `FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `drink_likes` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `drink_photos` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `drink_recipes` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `drink_saves` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `email_verification_tokens` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `expiry_reminders` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `family_meal_profiles` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `family_members` | **NO ACTION** | `FOREIGN KEY (household_member_id) REFERENCES users(id)` |
| `family_members` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `follow_requests` | **CASCADE** | `FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE` |
| `follow_requests` | **CASCADE** | `FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE` |
| `follows` | **NO ACTION** | `FOREIGN KEY (follower_id) REFERENCES users(id)` |
| `follows` | **NO ACTION** | `FOREIGN KEY (following_id) REFERENCES users(id)` |
| `grocery_list_items` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `health_integrations` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `health_sync_log` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `household_members` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `households` | **NO ACTION** | `FOREIGN KEY (owner_id) REFERENCES users(id)` |
| `leftovers` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `likes` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `meal_favorites` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_plan_blueprints` | **NO ACTION** | `FOREIGN KEY (creator_id) REFERENCES users(id)` |
| `meal_plan_comments` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_plan_creator_profiles` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_plan_likes` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_plan_purchases` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `meal_plan_reviews` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `meal_plan_saves` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_plan_week_shares` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_planner_analytics_events` | **NO ACTION** | `FOREIGN KEY (actor_user_id) REFERENCES users(id)` |
| `meal_planner_analytics_events` | **NO ACTION** | `FOREIGN KEY (creator_id) REFERENCES users(id)` |
| `meal_plans` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `meal_prep_schedules` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_recommendations` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `meal_streaks` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `notifications` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `nutrition_intro_trials` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `nutrition_logs` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `nutrition_personality_profiles` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `orders` | **NO ACTION** | `FOREIGN KEY (buyer_id) REFERENCES users(id)` |
| `orders` | **NO ACTION** | `FOREIGN KEY (seller_id) REFERENCES users(id)` |
| `pantry_household_invites` | **CASCADE** | `FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `pantry_household_invites` | **CASCADE** | `FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `pantry_household_members` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `pantry_households` | **CASCADE** | `FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE` |
| `pantry_items` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `pantry_items_enhanced` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `payment_methods` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `payout_schedules` | **CASCADE** | `FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE` |
| `payouts` | **CASCADE** | `FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE` |
| `pet_food_events` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |
| `planner_objective_history` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `planner_relationship_learning` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `posts` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `products` | **NO ACTION** | `FOREIGN KEY (seller_id) REFERENCES users(id)` |
| `quest_progress` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `recipe_matches` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `recipe_remixes` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `recipe_reviews` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `recipe_saves` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `recipe_timing_log` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `remix_likes` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `remix_saves` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `review_helpful` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `shared_week_comments` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `shared_week_likes` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `shared_week_saves` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `square_oauth_transactions` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `staff_group_members` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `store_drops` | **NO ACTION** | `FOREIGN KEY (owner_id) REFERENCES users(id)` |
| `stores` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `stories` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `subscription_history` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `taste_profiles` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_analytics` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_badges` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_drink_stats` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `user_goals` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_meal_plan_achievements` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_meal_plan_progress` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_nutrition_campaigns` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `user_substitution_preferences` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `water_logs` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `wedding_calendar_events` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `wedding_event_details` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `wedding_intro_trials` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `wedding_planning_insights` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `wedding_planning_tasks` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `wedding_registry_links` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `wedding_rsvp_invitations` | **CASCADE** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `wedding_square_card_setup_attempts` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `wedding_square_card_updates` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `wedding_square_enrollment_attempts` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `wedding_square_subscriptions` | **NO ACTION** | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `wedding_vendor_listings` | **SET NULL** | `FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL` |
| `wedding_vendor_listings` | **SET NULL** | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL` |

## 2. Financial/commerce/contract table inventory (including tables with NO user FK)

| Table | Direct parent FK actions | Candidate personal/sensitive columns (names only) |
|---|---|---|
| `catering_attempt_square_payments` | catering_booking_payment_attempts/RESTRICT | square_payment_id, has_refunds |
| `catering_booking_access_details` | catering_bookings/RESTRICT, users/RESTRICT | loading_dock_notes, elevator_notes, kitchen_access_notes, security_check_in_notes, access_window_start, access_window_end, venue_contact_name, venue_contact_phone, power_water_notes, trash_removal_notes, provider_private_notes, access_confirmed |
| `catering_booking_activity` | users/RESTRICT, catering_bookings/RESTRICT | metadata |
| `catering_booking_adjustments` | catering_booking_amendments/RESTRICT, catering_bookings/RESTRICT, catering_booking_payments/RESTRICT, users/RESTRICT, users/RESTRICT | reason, payment_id, idempotency_key, reversal_reason |
| `catering_booking_amendments` | catering_booking_amendments/RESTRICT, catering_bookings/RESTRICT, users/RESTRICT, users/RESTRICT | base_terms_note, terms_note, message |
| `catering_booking_billing` | catering_bookings/RESTRICT, users/RESTRICT | — |
| `catering_booking_closeout` | catering_bookings/RESTRICT, users/RESTRICT, users/RESTRICT, users/RESTRICT | provider_notes |
| `catering_booking_closeout_items` | catering_bookings/RESTRICT, users/RESTRICT | provider_note |
| `catering_booking_conversations` | catering_bookings/RESTRICT, dm_threads/RESTRICT | — |
| `catering_booking_details` | catering_bookings/RESTRICT | venue_name, venue_address, setup_notes, access_notes, customer_notes, provider_notes |
| `catering_booking_equipment` | catering_bookings/RESTRICT, users/RESTRICT | name, source_name, notes |
| `catering_booking_execution_create_requests` | catering_bookings/RESTRICT, users/RESTRICT | — |
| `catering_booking_execution_milestones` | catering_bookings/RESTRICT, users/RESTRICT | — |
| `catering_booking_execution_timeline` | catering_bookings/RESTRICT, users/RESTRICT, users/RESTRICT | — |
| `catering_booking_files` | catering_bookings/RESTRICT, users/RESTRICT, users/RESTRICT | storage_provider, original_filename, cleanup_claim_token |
| `catering_booking_invoices` | catering_bookings/RESTRICT, users/RESTRICT, users/RESTRICT | invoice_number, invoice_kind, void_reason |
| `catering_booking_message_requests` | catering_bookings/RESTRICT, dm_messages/RESTRICT, users/RESTRICT | message_id |
| `catering_booking_payment_attempts` | catering_bookings/RESTRICT, users/RESTRICT, catering_booking_invoices/RESTRICT, catering_booking_payments/RESTRICT, users/RESTRICT | invoice_id, customer_id, provider_id, merchant_id, idempotency_key, square_payment_link_id, square_payment_id, processor_payment_count, payment_id, reconciliation_reason, refund_review_at |
| `catering_booking_payments` | catering_bookings/RESTRICT, catering_booking_invoices/RESTRICT, users/RESTRICT, users/RESTRICT | invoice_id, payment_method, payment_source, void_reason, idempotency_key, processor_payment_id |
| `catering_booking_staff_assignments` | catering_bookings/RESTRICT, users/RESTRICT | worker_name, contact_note, responsibility_note |
| `catering_booking_storage_orphans` | catering_bookings/RESTRICT | storage_provider, reason, cleanup_claim_token |
| `catering_booking_tasks` | catering_bookings/RESTRICT, users/RESTRICT | — |
| `catering_bookings` | users/RESTRICT, catering_inquiries/RESTRICT, catering_packages/SET NULL, users/RESTRICT | provider_id, customer_id, package_title_snapshot, package_pricing_model_snapshot, package_starting_price_snapshot, provider_confirmed_at, customer_confirmed_at, cancellation_reason |
| `catering_square_webhook_events` | catering_booking_payment_attempts/RESTRICT | merchant_id, square_payment_id |
| `commissions` | orders/CASCADE, payouts/NO ACTION, users/CASCADE | subscription_tier |
| `creator_membership_checkout_sessions` | users/CASCADE, creator_membership_plans/CASCADE, users/CASCADE | provider, square_payment_link_id, square_payment_id, provider_reference_id, failure_reason |
| `creator_membership_plans` | users/CASCADE | name |
| `creator_membership_sales_ledger` | creator_membership_checkout_sessions/SET NULL, users/CASCADE, creator_memberships/SET NULL, creator_membership_plans/SET NULL, users/CASCADE | status_reason |
| `creator_memberships` | users/CASCADE, creator_membership_plans/CASCADE, users/CASCADE | square_subscription_id, payment_reference |
| `drink_bundle_checkout_sessions` | drink_bundles/CASCADE, users/CASCADE | provider, square_payment_link_id, square_payment_id, provider_reference_id, refunded_at, access_revoked_at, failure_reason |
| `drink_bundle_purchases` | drink_bundles/CASCADE, users/CASCADE | status_reason, access_revoked_at |
| `drink_bundle_square_webhook_events` | drink_bundle_checkout_sessions/SET NULL | — |
| `drink_collection_checkout_sessions` | drink_collections/CASCADE, users/CASCADE | provider, square_payment_link_id, square_payment_id, provider_reference_id, refunded_at, access_revoked_at, failure_reason |
| `drink_collection_purchases` | drink_collections/CASCADE, users/CASCADE | status_reason, access_revoked_at |
| `drink_collection_sales_ledger` | drink_collection_checkout_sessions/SET NULL, drink_collections/CASCADE, drink_collection_purchases/SET NULL, users/CASCADE | status_reason, refunded_at |
| `drink_collection_square_webhook_events` | drink_collection_checkout_sessions/SET NULL | — |
| `drink_gifts` | users/CASCADE, users/SET NULL | recipient_user_id, recipient_identifier, provider |
| `meal_plan_purchases` | meal_plan_blueprints/NO ACTION, users/NO ACTION | payment_status, payment_method, payment_provider, provider_payment_id, provider_payment_status, payment_verified_at |
| `nutrition_intro_trials` | users/CASCADE | — |
| `orders` | users/NO ACTION, products/NO ACTION, users/NO ACTION | shipping_address, square_payment_id, checkout_idempotency_key, seller_tier_snapshot, commission_rate_snapshot, square_refund_id, capture_idempotency_key, capture_request_snapshot, refund_idempotency_key, refund_attempt_payment_id, refund_attempt_amount_cents, refund_attempt_currency, refund_attempt_reason, last_payment_failure_code, last_failed_refund_id, last_refund_failure_status, payment_status |
| `payment_methods` | users/CASCADE | provider, provider_id, account_status, account_type, account_email, account_details, encrypted_access_token, encrypted_refresh_token, token_expires_at, location_name, merchant_name, credential_generation |
| `payout_schedules` | users/CASCADE | — |
| `payouts` | payment_methods/NO ACTION, users/CASCADE | payment_method_id, provider, provider_payout_id, failure_reason, metadata |
| `square_merchant_revocations` | none | merchant_id |
| `square_oauth_transactions` | users/CASCADE | — |
| `square_plaintext_enforcement_state` | none | — |
| `subscription_history` | users/NO ACTION | payment_method, subscription_type |
| `wedding_intro_trials` | users/CASCADE | — |
| `wedding_square_card_setup_attempts` | users/NO ACTION | square_merchant_id, customer_idempotency_key, card_idempotency_key, square_customer_id, square_card_id, customer_post_attempted_at, card_post_attempted_at |
| `wedding_square_card_updates` | users/NO ACTION, wedding_square_subscriptions/NO ACTION | wedding_subscription_id, square_merchant_id, square_subscription_id, previous_card_id, replacement_card_id, card_idempotency_key, expected_provider_version |
| `wedding_square_enrollment_attempts` | users/NO ACTION | square_customer_id, square_card_id, idempotency_key, provider_subscription_id |
| `wedding_square_invoice_evidence` | wedding_square_subscriptions/NO ACTION | wedding_subscription_id, square_merchant_id, square_invoice_id, square_payment_id, square_subscription_id, provider_paid_at, last_payment_reconciled_at, payment_revoked_at |
| `wedding_square_subscriptions` | users/NO ACTION | square_merchant_id, square_customer_id, square_subscription_id, square_card_id, provider_status, provider_cancelled_at |
| `wedding_square_webhook_events` | none | square_merchant_id |

## 3. Cascading foreign keys reachable from users

All below represent a **potential loss of historical or counterparty data if users were hard-deleted**. Some paths require an intermediate parent row to exist; actual row contents were not inspected.

| Depth | Child table | Cascading parent | FK constraint |
|---|---|---|---|
| 1 | `account_status` | `users` | `account_status_user_id_fkey` |
| 1 | `ai_suggestions` | `users` | `ai_suggestions_user_id_fkey` |
| 1 | `body_metrics` | `users` | `body_metrics_user_id_fkey` |
| 1 | `catering_availability_exceptions` | `users` | `catering_availability_exceptions_provider_id_users_id_fk` |
| 1 | `catering_availability_settings` | `users` | `catering_availability_settings_provider_id_users_id_fk` |
| 1 | `catering_availability_weekly_rules` | `users` | `catering_availability_weekly_rules_provider_id_users_id_fk` |
| 1 | `catering_packages` | `users` | `catering_packages_provider_id_users_id_fk` |
| 1 | `catering_portfolio_items` | `users` | `catering_portfolio_items_provider_id_fkey` |
| 1 | `catering_reviews` | `users` | `catering_reviews_provider_id_users_id_fk` |
| 1 | `catering_reviews` | `users` | `catering_reviews_reviewer_id_users_id_fk` |
| 1 | `challenge_progress` | `users` | `challenge_progress_user_id_fkey` |
| 1 | `club_join_requests` | `users` | `club_join_requests_user_id_fkey` |
| 1 | `club_memberships` | `users` | `club_memberships_user_id_fkey` |
| 1 | `club_post_likes` | `users` | `club_post_likes_user_id_fkey` |
| 1 | `club_posts` | `users` | `club_posts_user_id_fkey` |
| 1 | `clubs` | `users` | `clubs_creator_id_fkey` |
| 1 | `comment_likes` | `users` | `comment_likes_user_id_fkey` |
| 1 | `commissions` | `users` | `commissions_seller_id_fkey` |
| 1 | `creator_campaign_action_states` | `users` | `creator_campaign_action_states_user_id_fkey` |
| 1 | `creator_campaign_follows` | `users` | `creator_campaign_follows_user_id_fkey` |
| 1 | `creator_campaign_playbook_profiles` | `users` | `creator_campaign_playbook_profiles_creator_user_id_fkey` |
| 1 | `creator_campaign_templates` | `users` | `creator_campaign_templates_creator_user_id_fkey` |
| 1 | `creator_campaigns` | `users` | `creator_campaigns_creator_user_id_fkey` |
| 1 | `creator_collaborations` | `users` | `creator_collaborations_collaborator_user_id_fkey` |
| 1 | `creator_collaborations` | `users` | `creator_collaborations_owner_creator_user_id_fkey` |
| 1 | `creator_drop_rsvps` | `users` | `creator_drop_rsvps_user_id_fkey` |
| 1 | `creator_drops` | `users` | `creator_drops_creator_user_id_fkey` |
| 1 | `creator_membership_checkout_sessions` | `users` | `creator_membership_checkout_sessions_creator_user_id_fkey` |
| 1 | `creator_membership_checkout_sessions` | `users` | `creator_membership_checkout_sessions_user_id_fkey` |
| 1 | `creator_membership_plans` | `users` | `creator_membership_plans_creator_user_id_fkey` |
| 1 | `creator_membership_sales_ledger` | `users` | `creator_membership_sales_ledger_creator_user_id_fkey` |
| 1 | `creator_membership_sales_ledger` | `users` | `creator_membership_sales_ledger_user_id_fkey` |
| 1 | `creator_memberships` | `users` | `creator_memberships_creator_user_id_fkey` |
| 1 | `creator_memberships` | `users` | `creator_memberships_user_id_fkey` |
| 1 | `creator_posts` | `users` | `creator_posts_creator_user_id_fkey` |
| 1 | `creator_roadmap_items` | `users` | `creator_roadmap_items_creator_user_id_fkey` |
| 1 | `dm_messages` | `users` | `dm_messages_sender_id_users_id_fk` |
| 1 | `dm_participants` | `users` | `dm_participants_user_id_users_id_fk` |
| 1 | `drink_bundle_checkout_sessions` | `users` | `drink_bundle_checkout_sessions_user_id_fkey` |
| 1 | `drink_bundle_purchases` | `users` | `drink_bundle_purchases_user_id_fkey` |
| 1 | `drink_bundles` | `users` | `drink_bundles_user_id_fkey` |
| 1 | `drink_challenge_submissions` | `users` | `drink_challenge_submissions_user_id_fkey` |
| 1 | `drink_collection_checkout_sessions` | `users` | `drink_collection_checkout_sessions_user_id_fkey` |
| 1 | `drink_collection_promotions` | `users` | `drink_collection_promotions_creator_user_id_fkey` |
| 1 | `drink_collection_purchases` | `users` | `drink_collection_purchases_user_id_fkey` |
| 1 | `drink_collection_reviews` | `users` | `drink_collection_reviews_user_id_fkey` |
| 1 | `drink_collection_sales_ledger` | `users` | `drink_collection_sales_ledger_user_id_fkey` |
| 1 | `drink_collection_wishlists` | `users` | `drink_collection_wishlists_user_id_fkey` |
| 1 | `drink_collections` | `users` | `drink_collections_user_id_fkey` |
| 1 | `drink_gifts` | `users` | `drink_gifts_purchaser_user_id_fkey` |
| 1 | `email_verification_tokens` | `users` | `email_verification_tokens_user_id_fkey` |
| 1 | `family_meal_profiles` | `users` | `family_meal_profiles_user_id_fkey` |
| 1 | `family_members` | `users` | `family_members_user_id_fkey` |
| 1 | `follow_requests` | `users` | `follow_requests_requester_id_fkey` |
| 1 | `follow_requests` | `users` | `follow_requests_target_id_fkey` |
| 1 | `grocery_list_items` | `users` | `grocery_list_items_user_id_fkey` |
| 1 | `health_integrations` | `users` | `health_integrations_user_id_fkey` |
| 1 | `health_sync_log` | `users` | `health_sync_log_user_id_fkey` |
| 1 | `household_members` | `users` | `household_members_user_id_fkey` |
| 1 | `leftovers` | `users` | `leftovers_user_id_fkey` |
| 1 | `meal_favorites` | `users` | `meal_favorites_user_id_fkey` |
| 1 | `meal_plan_comments` | `users` | `meal_plan_comments_user_id_fkey` |
| 1 | `meal_plan_creator_profiles` | `users` | `meal_plan_creator_profiles_user_id_fkey` |
| 1 | `meal_plan_likes` | `users` | `meal_plan_likes_user_id_fkey` |
| 1 | `meal_plan_saves` | `users` | `meal_plan_saves_user_id_fkey` |
| 1 | `meal_plan_week_shares` | `users` | `meal_plan_week_shares_user_id_fkey` |
| 1 | `meal_prep_schedules` | `users` | `meal_prep_schedules_user_id_fkey` |
| 1 | `meal_recommendations` | `users` | `meal_recommendations_user_id_fkey` |
| 1 | `meal_streaks` | `users` | `meal_streaks_user_id_fkey` |
| 1 | `notifications` | `users` | `notifications_user_id_fkey` |
| 1 | `nutrition_intro_trials` | `users` | `nutrition_intro_trials_user_id_fkey` |
| 1 | `pantry_household_invites` | `users` | `pantry_household_invites_invited_by_user_id_fkey` |
| 1 | `pantry_household_invites` | `users` | `pantry_household_invites_invited_user_id_fkey` |
| 1 | `pantry_household_members` | `users` | `pantry_household_members_user_id_fkey` |
| 1 | `pantry_households` | `users` | `pantry_households_owner_id_fkey` |
| 1 | `payment_methods` | `users` | `payment_methods_user_id_fkey` |
| 1 | `payout_schedules` | `users` | `payout_schedules_seller_id_fkey` |
| 1 | `payouts` | `users` | `payouts_seller_id_fkey` |
| 1 | `quest_progress` | `users` | `quest_progress_user_id_fkey` |
| 1 | `recipe_remixes` | `users` | `recipe_remixes_user_id_fkey` |
| 1 | `recipe_timing_log` | `users` | `recipe_timing_log_user_id_fkey` |
| 1 | `shared_week_comments` | `users` | `shared_week_comments_user_id_fkey` |
| 1 | `shared_week_likes` | `users` | `shared_week_likes_user_id_fkey` |
| 1 | `shared_week_saves` | `users` | `shared_week_saves_user_id_fkey` |
| 1 | `square_oauth_transactions` | `users` | `square_oauth_transactions_user_id_users_id_fk` |
| 1 | `staff_group_members` | `users` | `staff_group_members_user_id_fkey` |
| 1 | `taste_profiles` | `users` | `taste_profiles_user_id_fkey` |
| 1 | `user_analytics` | `users` | `user_analytics_user_id_fkey` |
| 1 | `user_badges` | `users` | `user_badges_user_id_fkey` |
| 1 | `user_goals` | `users` | `user_goals_user_id_fkey` |
| 1 | `user_meal_plan_achievements` | `users` | `user_meal_plan_achievements_user_id_fkey` |
| 1 | `user_meal_plan_progress` | `users` | `user_meal_plan_progress_user_id_fkey` |
| 1 | `user_nutrition_campaigns` | `users` | `user_nutrition_campaigns_user_id_fkey` |
| 1 | `user_substitution_preferences` | `users` | `user_substitution_preferences_user_id_fkey` |
| 1 | `water_logs` | `users` | `water_logs_user_id_fkey` |
| 1 | `wedding_event_details` | `users` | `wedding_event_details_user_id_fkey` |
| 1 | `wedding_intro_trials` | `users` | `wedding_intro_trials_user_id_fkey` |
| 1 | `wedding_planning_insights` | `users` | `wedding_planning_insights_user_id_fkey` |
| 1 | `wedding_registry_links` | `users` | `wedding_registry_links_user_id_fkey` |
| 1 | `wedding_rsvp_invitations` | `users` | `wedding_rsvp_invitations_user_id_fkey` |
| 2 | `allergen_profiles` | `family_members` | `allergen_profiles_family_member_id_fkey` |
| 2 | `challenges` | `clubs` | `challenges_club_id_fkey` |
| 2 | `creator_campaign_cta_variants` | `creator_campaigns` | `creator_campaign_cta_variants_campaign_id_fkey` |
| 2 | `creator_campaign_experiments` | `creator_campaigns` | `creator_campaign_experiments_campaign_id_fkey` |
| 2 | `creator_campaign_goals` | `creator_campaigns` | `creator_campaign_goals_campaign_id_fkey` |
| 2 | `creator_campaign_links` | `creator_campaigns` | `creator_campaign_links_campaign_id_fkey` |
| 2 | `creator_campaign_rollout_timeline_events` | `creator_campaigns` | `creator_campaign_rollout_timeline_events_campaign_id_fkey` |
| 2 | `creator_campaign_spotlight_events` | `creator_campaigns` | `creator_campaign_spotlight_events_campaign_id_fkey` |
| 2 | `creator_campaign_surface_events` | `creator_campaigns` | `creator_campaign_surface_events_campaign_id_fkey` |
| 2 | `creator_campaign_variant_events` | `creator_campaigns` | `creator_campaign_variant_events_campaign_id_fkey` |
| 2 | `creator_drop_events` | `creator_drops` | `creator_drop_events_drop_id_fkey` |
| 2 | `drink_bundle_items` | `drink_bundles` | `drink_bundle_items_bundle_id_fkey` |
| 2 | `drink_bundle_items` | `drink_collections` | `drink_bundle_items_collection_id_fkey` |
| 2 | `drink_collection_events` | `drink_collections` | `drink_collection_events_collection_id_fkey` |
| 2 | `drink_collection_items` | `drink_collections` | `drink_collection_items_collection_id_fkey` |
| 2 | `remix_likes` | `recipe_remixes` | `remix_likes_remix_id_recipe_remixes_id_fk` |
| 2 | `remix_saves` | `recipe_remixes` | `remix_saves_remix_id_recipe_remixes_id_fk` |

## 4. Full PostgreSQL FK catalog (353 relations)

This appendix is intentionally exhaustive; every current public-schema FK, not only guessed financial table names.

| Child table | Parent table | On delete | Constraint |
|---|---|---|---|
| `account_status` | `users` | CASCADE | `account_status_user_id_fkey` |
| `adaptive_planner_profiles` | `users` | NO ACTION | `adaptive_planner_profiles_user_id_fkey` |
| `adaptive_planner_snapshots` | `users` | NO ACTION | `adaptive_planner_snapshots_user_id_fkey` |
| `ai_suggestions` | `custom_drinks` | NO ACTION | `ai_suggestions_custom_drink_id_fkey` |
| `ai_suggestions` | `recipes` | NO ACTION | `ai_suggestions_recipe_id_fkey` |
| `ai_suggestions` | `users` | CASCADE | `ai_suggestions_user_id_fkey` |
| `allergen_profiles` | `family_members` | CASCADE | `allergen_profiles_family_member_id_fkey` |
| `blueprint_versions` | `meal_plan_blueprints` | NO ACTION | `blueprint_versions_blueprint_id_fkey` |
| `body_metrics` | `users` | CASCADE | `body_metrics_user_id_fkey` |
| `catering_attempt_square_payments` | `catering_booking_payment_attempts` | RESTRICT | `catering_attempt_square_payments_attempt_id_catering_booking_pa` |
| `catering_availability_exceptions` | `users` | CASCADE | `catering_availability_exceptions_provider_id_users_id_fk` |
| `catering_availability_settings` | `users` | CASCADE | `catering_availability_settings_provider_id_users_id_fk` |
| `catering_availability_weekly_rules` | `users` | CASCADE | `catering_availability_weekly_rules_provider_id_users_id_fk` |
| `catering_booking_access_details` | `catering_bookings` | RESTRICT | `catering_booking_access_details_booking_id_catering_bookings_id` |
| `catering_booking_access_details` | `users` | RESTRICT | `catering_booking_access_details_updated_by_users_id_fk` |
| `catering_booking_activity` | `users` | RESTRICT | `catering_booking_activity_actor_user_id_users_id_fk` |
| `catering_booking_activity` | `catering_bookings` | RESTRICT | `catering_booking_activity_booking_id_catering_bookings_id_fk` |
| `catering_booking_adjustments` | `catering_booking_amendments` | RESTRICT | `catering_booking_adjustments_amendment_id_catering_booking_amen` |
| `catering_booking_adjustments` | `catering_bookings` | RESTRICT | `catering_booking_adjustments_booking_id_catering_bookings_id_fk` |
| `catering_booking_adjustments` | `catering_booking_payments` | RESTRICT | `catering_booking_adjustments_payment_id_catering_booking_paymen` |
| `catering_booking_adjustments` | `users` | RESTRICT | `catering_booking_adjustments_recorded_by_users_id_fk` |
| `catering_booking_adjustments` | `users` | RESTRICT | `catering_booking_adjustments_reversed_by_users_id_fk` |
| `catering_booking_amendments` | `catering_booking_amendments` | RESTRICT | `catering_booking_amendments_base_accepted_amendment_id_catering` |
| `catering_booking_amendments` | `catering_bookings` | RESTRICT | `catering_booking_amendments_booking_id_catering_bookings_id_fk` |
| `catering_booking_amendments` | `users` | RESTRICT | `catering_booking_amendments_proposed_by_user_id_users_id_fk` |
| `catering_booking_amendments` | `users` | RESTRICT | `catering_booking_amendments_responded_by_user_id_users_id_fk` |
| `catering_booking_billing` | `catering_bookings` | RESTRICT | `catering_booking_billing_booking_id_catering_bookings_id_fk` |
| `catering_booking_billing` | `users` | RESTRICT | `catering_booking_billing_terms_updated_by_users_id_fk` |
| `catering_booking_closeout` | `catering_bookings` | RESTRICT | `catering_booking_closeout_booking_id_catering_bookings_id_fk` |
| `catering_booking_closeout` | `users` | RESTRICT | `catering_booking_closeout_closed_out_by_users_id_fk` |
| `catering_booking_closeout` | `users` | RESTRICT | `catering_booking_closeout_last_reopened_by_users_id_fk` |
| `catering_booking_closeout` | `users` | RESTRICT | `catering_booking_closeout_updated_by_users_id_fk` |
| `catering_booking_closeout_items` | `catering_bookings` | RESTRICT | `catering_booking_closeout_items_booking_id_catering_bookings_id` |
| `catering_booking_closeout_items` | `users` | RESTRICT | `catering_booking_closeout_items_resolved_by_users_id_fk` |
| `catering_booking_conversations` | `catering_bookings` | RESTRICT | `catering_booking_conversations_booking_id_catering_bookings_id_` |
| `catering_booking_conversations` | `dm_threads` | RESTRICT | `catering_booking_conversations_thread_id_dm_threads_id_fk` |
| `catering_booking_details` | `catering_bookings` | RESTRICT | `catering_booking_details_booking_id_catering_bookings_id_fk` |
| `catering_booking_equipment` | `catering_bookings` | RESTRICT | `catering_booking_equipment_booking_id_catering_bookings_id_fk` |
| `catering_booking_equipment` | `users` | RESTRICT | `catering_booking_equipment_created_by_users_id_fk` |
| `catering_booking_execution_create_requests` | `catering_bookings` | RESTRICT | `catering_booking_execution_create_requests_booking_id_catering_` |
| `catering_booking_execution_create_requests` | `users` | RESTRICT | `catering_booking_execution_create_requests_created_by_users_id_` |
| `catering_booking_execution_milestones` | `catering_bookings` | RESTRICT | `catering_booking_execution_milestones_booking_id_catering_booki` |
| `catering_booking_execution_milestones` | `users` | RESTRICT | `catering_booking_execution_milestones_completed_by_users_id_fk` |
| `catering_booking_execution_timeline` | `catering_bookings` | RESTRICT | `catering_booking_execution_timeline_booking_id_catering_booking` |
| `catering_booking_execution_timeline` | `users` | RESTRICT | `catering_booking_execution_timeline_completed_by_users_id_fk` |
| `catering_booking_execution_timeline` | `users` | RESTRICT | `catering_booking_execution_timeline_created_by_users_id_fk` |
| `catering_booking_files` | `catering_bookings` | RESTRICT | `catering_booking_files_booking_id_catering_bookings_id_fk` |
| `catering_booking_files` | `users` | RESTRICT | `catering_booking_files_deleted_by_users_id_fk` |
| `catering_booking_files` | `users` | RESTRICT | `catering_booking_files_uploaded_by_users_id_fk` |
| `catering_booking_invoices` | `catering_bookings` | RESTRICT | `catering_booking_invoices_booking_id_catering_bookings_id_fk` |
| `catering_booking_invoices` | `users` | RESTRICT | `catering_booking_invoices_created_by_users_id_fk` |
| `catering_booking_invoices` | `users` | RESTRICT | `catering_booking_invoices_voided_by_users_id_fk` |
| `catering_booking_message_requests` | `catering_bookings` | RESTRICT | `catering_booking_message_requests_booking_id_catering_bookings_` |
| `catering_booking_message_requests` | `dm_messages` | RESTRICT | `catering_booking_message_requests_message_id_dm_messages_id_fk` |
| `catering_booking_message_requests` | `users` | RESTRICT | `catering_booking_message_requests_sender_id_users_id_fk` |
| `catering_booking_payment_attempts` | `catering_bookings` | RESTRICT | `catering_booking_payment_attempts_booking_id_catering_bookings_` |
| `catering_booking_payment_attempts` | `users` | RESTRICT | `catering_booking_payment_attempts_customer_id_users_id_fk` |
| `catering_booking_payment_attempts` | `catering_booking_invoices` | RESTRICT | `catering_booking_payment_attempts_invoice_id_catering_booking_i` |
| `catering_booking_payment_attempts` | `catering_booking_payments` | RESTRICT | `catering_booking_payment_attempts_payment_id_catering_booking_p` |
| `catering_booking_payment_attempts` | `users` | RESTRICT | `catering_booking_payment_attempts_provider_id_users_id_fk` |
| `catering_booking_payments` | `catering_bookings` | RESTRICT | `catering_booking_payments_booking_id_catering_bookings_id_fk` |
| `catering_booking_payments` | `catering_booking_invoices` | RESTRICT | `catering_booking_payments_invoice_id_catering_booking_invoices_` |
| `catering_booking_payments` | `users` | RESTRICT | `catering_booking_payments_recorded_by_users_id_fk` |
| `catering_booking_payments` | `users` | RESTRICT | `catering_booking_payments_voided_by_users_id_fk` |
| `catering_booking_staff_assignments` | `catering_bookings` | RESTRICT | `catering_booking_staff_assignments_booking_id_catering_bookings` |
| `catering_booking_staff_assignments` | `users` | RESTRICT | `catering_booking_staff_assignments_created_by_users_id_fk` |
| `catering_booking_storage_orphans` | `catering_bookings` | RESTRICT | `catering_booking_storage_orphans_booking_id_catering_bookings_i` |
| `catering_booking_tasks` | `catering_bookings` | RESTRICT | `catering_booking_tasks_booking_id_catering_bookings_id_fk` |
| `catering_booking_tasks` | `users` | RESTRICT | `catering_booking_tasks_created_by_users_id_fk` |
| `catering_bookings` | `users` | RESTRICT | `catering_bookings_customer_id_users_id_fk` |
| `catering_bookings` | `catering_inquiries` | RESTRICT | `catering_bookings_inquiry_id_catering_inquiries_id_fk` |
| `catering_bookings` | `catering_packages` | SET NULL | `catering_bookings_package_id_catering_packages_id_fk` |
| `catering_bookings` | `users` | RESTRICT | `catering_bookings_provider_id_users_id_fk` |
| `catering_inquiries` | `users` | NO ACTION | `catering_inquiries_chef_id_users_id_fk` |
| `catering_inquiries` | `users` | NO ACTION | `catering_inquiries_customer_id_users_id_fk` |
| `catering_inquiries` | `catering_packages` | SET NULL | `catering_inquiries_package_id_catering_packages_id_fk` |
| `catering_offer_revisions` | `catering_bookings` | RESTRICT | `catering_offer_revisions_booking_id_catering_bookings_id_fk` |
| `catering_offer_revisions` | `users` | RESTRICT | `catering_offer_revisions_proposed_by_user_id_users_id_fk` |
| `catering_offer_revisions` | `catering_offer_revisions` | RESTRICT | `catering_offer_revisions_responds_to_revision_id_catering_offer` |
| `catering_packages` | `users` | CASCADE | `catering_packages_provider_id_users_id_fk` |
| `catering_portfolio_items` | `users` | CASCADE | `catering_portfolio_items_provider_id_fkey` |
| `catering_reviews` | `catering_inquiries` | SET NULL | `catering_reviews_inquiry_id_catering_inquiries_id_fk` |
| `catering_reviews` | `users` | CASCADE | `catering_reviews_provider_id_users_id_fk` |
| `catering_reviews` | `users` | CASCADE | `catering_reviews_reviewer_id_users_id_fk` |
| `catering_square_webhook_events` | `catering_booking_payment_attempts` | RESTRICT | `catering_square_webhook_events_attempt_id_catering_booking_paym` |
| `challenge_progress` | `challenges` | CASCADE | `challenge_progress_challenge_id_fkey` |
| `challenge_progress` | `users` | CASCADE | `challenge_progress_user_id_fkey` |
| `challenges` | `clubs` | CASCADE | `challenges_club_id_fkey` |
| `club_join_requests` | `clubs` | CASCADE | `club_join_requests_club_id_fkey` |
| `club_join_requests` | `users` | SET NULL | `club_join_requests_decided_by_fkey` |
| `club_join_requests` | `users` | CASCADE | `club_join_requests_user_id_fkey` |
| `club_memberships` | `clubs` | CASCADE | `club_memberships_club_id_fkey` |
| `club_memberships` | `users` | CASCADE | `club_memberships_user_id_fkey` |
| `club_post_likes` | `club_posts` | CASCADE | `club_post_likes_club_post_id_fkey` |
| `club_post_likes` | `users` | CASCADE | `club_post_likes_user_id_fkey` |
| `club_posts` | `clubs` | CASCADE | `club_posts_club_id_fkey` |
| `club_posts` | `recipes` | SET NULL | `club_posts_recipe_id_fkey` |
| `club_posts` | `users` | CASCADE | `club_posts_user_id_fkey` |
| `clubs` | `users` | CASCADE | `clubs_creator_id_fkey` |
| `comment_likes` | `comments` | CASCADE | `comment_likes_comment_id_fkey` |
| `comment_likes` | `users` | CASCADE | `comment_likes_user_id_fkey` |
| `comments` | `comments` | CASCADE | `comments_parent_id_comments_id_fk` |
| `comments` | `posts` | NO ACTION | `comments_post_id_posts_id_fk` |
| `comments` | `users` | NO ACTION | `comments_user_id_users_id_fk` |
| `commissions` | `orders` | CASCADE | `commissions_order_id_fkey` |
| `commissions` | `payouts` | NO ACTION | `commissions_payout_id_fkey` |
| `commissions` | `users` | CASCADE | `commissions_seller_id_fkey` |
| `creator_analytics` | `users` | NO ACTION | `creator_analytics_creator_id_fkey` |
| `creator_campaign_action_states` | `creator_campaigns` | CASCADE | `creator_campaign_action_states_campaign_id_fkey` |
| `creator_campaign_action_states` | `users` | CASCADE | `creator_campaign_action_states_user_id_fkey` |
| `creator_campaign_cta_variants` | `creator_campaigns` | CASCADE | `creator_campaign_cta_variants_campaign_id_fkey` |
| `creator_campaign_experiments` | `creator_campaigns` | CASCADE | `creator_campaign_experiments_campaign_id_fkey` |
| `creator_campaign_follows` | `creator_campaigns` | CASCADE | `creator_campaign_follows_campaign_id_fkey` |
| `creator_campaign_follows` | `users` | CASCADE | `creator_campaign_follows_user_id_fkey` |
| `creator_campaign_goals` | `creator_campaigns` | CASCADE | `creator_campaign_goals_campaign_id_fkey` |
| `creator_campaign_links` | `creator_campaigns` | CASCADE | `creator_campaign_links_campaign_id_fkey` |
| `creator_campaign_playbook_profiles` | `creator_campaign_playbook_profiles` | SET NULL | `creator_campaign_playbook_profi_parent_playbook_profile_id_fkey` |
| `creator_campaign_playbook_profiles` | `users` | CASCADE | `creator_campaign_playbook_profiles_creator_user_id_fkey` |
| `creator_campaign_playbook_profiles` | `creator_campaigns` | SET NULL | `creator_campaign_playbook_profiles_source_campaign_id_fkey` |
| `creator_campaign_rollout_timeline_events` | `users` | SET NULL | `creator_campaign_rollout_timeline_events_actor_user_id_fkey` |
| `creator_campaign_rollout_timeline_events` | `creator_campaigns` | CASCADE | `creator_campaign_rollout_timeline_events_campaign_id_fkey` |
| `creator_campaign_spotlight_events` | `creator_campaigns` | CASCADE | `creator_campaign_spotlight_events_campaign_id_fkey` |
| `creator_campaign_spotlight_events` | `users` | SET NULL | `creator_campaign_spotlight_events_user_id_fkey` |
| `creator_campaign_surface_events` | `creator_campaigns` | CASCADE | `creator_campaign_surface_events_campaign_id_fkey` |
| `creator_campaign_surface_events` | `users` | SET NULL | `creator_campaign_surface_events_user_id_fkey` |
| `creator_campaign_templates` | `users` | CASCADE | `creator_campaign_templates_creator_user_id_fkey` |
| `creator_campaign_templates` | `creator_campaigns` | SET NULL | `creator_campaign_templates_source_campaign_id_fkey` |
| `creator_campaign_variant_events` | `creator_campaigns` | CASCADE | `creator_campaign_variant_events_campaign_id_fkey` |
| `creator_campaign_variant_events` | `users` | SET NULL | `creator_campaign_variant_events_user_id_fkey` |
| `creator_campaign_variant_events` | `creator_campaign_cta_variants` | CASCADE | `creator_campaign_variant_events_variant_id_fkey` |
| `creator_campaigns` | `creator_campaign_playbook_profiles` | SET NULL | `creator_campaigns_applied_playbook_profile_id_fkey` |
| `creator_campaigns` | `users` | CASCADE | `creator_campaigns_creator_user_id_fkey` |
| `creator_collaborations` | `users` | CASCADE | `creator_collaborations_collaborator_user_id_fkey` |
| `creator_collaborations` | `users` | CASCADE | `creator_collaborations_owner_creator_user_id_fkey` |
| `creator_drop_events` | `creator_drops` | CASCADE | `creator_drop_events_drop_id_fkey` |
| `creator_drop_events` | `users` | SET NULL | `creator_drop_events_user_id_fkey` |
| `creator_drop_rsvps` | `creator_drops` | CASCADE | `creator_drop_rsvps_drop_id_fkey` |
| `creator_drop_rsvps` | `users` | CASCADE | `creator_drop_rsvps_user_id_fkey` |
| `creator_drops` | `users` | CASCADE | `creator_drops_creator_user_id_fkey` |
| `creator_drops` | `drink_challenges` | SET NULL | `creator_drops_linked_challenge_id_fkey` |
| `creator_drops` | `drink_collections` | SET NULL | `creator_drops_linked_collection_id_fkey` |
| `creator_drops` | `drink_collection_promotions` | SET NULL | `creator_drops_linked_promotion_id_fkey` |
| `creator_membership_checkout_sessions` | `users` | CASCADE | `creator_membership_checkout_sessions_creator_user_id_fkey` |
| `creator_membership_checkout_sessions` | `creator_membership_plans` | CASCADE | `creator_membership_checkout_sessions_plan_id_fkey` |
| `creator_membership_checkout_sessions` | `users` | CASCADE | `creator_membership_checkout_sessions_user_id_fkey` |
| `creator_membership_plans` | `users` | CASCADE | `creator_membership_plans_creator_user_id_fkey` |
| `creator_membership_sales_ledger` | `creator_membership_checkout_sessions` | SET NULL | `creator_membership_sales_ledger_checkout_session_id_fkey` |
| `creator_membership_sales_ledger` | `users` | CASCADE | `creator_membership_sales_ledger_creator_user_id_fkey` |
| `creator_membership_sales_ledger` | `creator_memberships` | SET NULL | `creator_membership_sales_ledger_membership_id_fkey` |
| `creator_membership_sales_ledger` | `creator_membership_plans` | SET NULL | `creator_membership_sales_ledger_plan_id_fkey` |
| `creator_membership_sales_ledger` | `users` | CASCADE | `creator_membership_sales_ledger_user_id_fkey` |
| `creator_memberships` | `users` | CASCADE | `creator_memberships_creator_user_id_fkey` |
| `creator_memberships` | `creator_membership_plans` | CASCADE | `creator_memberships_plan_id_fkey` |
| `creator_memberships` | `users` | CASCADE | `creator_memberships_user_id_fkey` |
| `creator_posts` | `users` | CASCADE | `creator_posts_creator_user_id_fkey` |
| `creator_posts` | `drink_challenges` | SET NULL | `creator_posts_linked_challenge_id_fkey` |
| `creator_posts` | `drink_collections` | SET NULL | `creator_posts_linked_collection_id_fkey` |
| `creator_roadmap_items` | `users` | CASCADE | `creator_roadmap_items_creator_user_id_fkey` |
| `creator_roadmap_items` | `drink_challenges` | SET NULL | `creator_roadmap_items_linked_challenge_id_fkey` |
| `creator_roadmap_items` | `drink_collections` | SET NULL | `creator_roadmap_items_linked_collection_id_fkey` |
| `custom_drinks` | `users` | NO ACTION | `custom_drinks_user_id_users_id_fk` |
| `daily_quests` | `badges` | NO ACTION | `daily_quests_badge_reward_fkey` |
| `dm_messages` | `users` | CASCADE | `dm_messages_sender_id_users_id_fk` |
| `dm_messages` | `dm_threads` | CASCADE | `dm_messages_thread_id_dm_threads_id_fk` |
| `dm_participants` | `dm_threads` | CASCADE | `dm_participants_thread_id_dm_threads_id_fk` |
| `dm_participants` | `users` | CASCADE | `dm_participants_user_id_users_id_fk` |
| `drink_bundle_checkout_sessions` | `drink_bundles` | CASCADE | `drink_bundle_checkout_sessions_bundle_id_fkey` |
| `drink_bundle_checkout_sessions` | `users` | CASCADE | `drink_bundle_checkout_sessions_user_id_fkey` |
| `drink_bundle_items` | `drink_bundles` | CASCADE | `drink_bundle_items_bundle_id_fkey` |
| `drink_bundle_items` | `drink_collections` | CASCADE | `drink_bundle_items_collection_id_fkey` |
| `drink_bundle_purchases` | `drink_bundles` | CASCADE | `drink_bundle_purchases_bundle_id_fkey` |
| `drink_bundle_purchases` | `users` | CASCADE | `drink_bundle_purchases_user_id_fkey` |
| `drink_bundle_square_webhook_events` | `drink_bundle_checkout_sessions` | SET NULL | `drink_bundle_square_webhook_events_checkout_session_id_fkey` |
| `drink_bundles` | `users` | CASCADE | `drink_bundles_user_id_fkey` |
| `drink_challenge_submissions` | `drink_challenges` | CASCADE | `drink_challenge_submissions_challenge_id_fkey` |
| `drink_challenge_submissions` | `users` | CASCADE | `drink_challenge_submissions_user_id_fkey` |
| `drink_collection_checkout_sessions` | `drink_collections` | CASCADE | `drink_collection_checkout_sessions_collection_id_fkey` |
| `drink_collection_checkout_sessions` | `users` | CASCADE | `drink_collection_checkout_sessions_user_id_fkey` |
| `drink_collection_events` | `drink_collections` | CASCADE | `drink_collection_events_collection_id_fkey` |
| `drink_collection_events` | `users` | SET NULL | `drink_collection_events_user_id_fkey` |
| `drink_collection_items` | `drink_collections` | CASCADE | `drink_collection_items_collection_id_fkey` |
| `drink_collection_promotions` | `drink_collections` | CASCADE | `drink_collection_promotions_collection_id_fkey` |
| `drink_collection_promotions` | `users` | CASCADE | `drink_collection_promotions_creator_user_id_fkey` |
| `drink_collection_purchases` | `drink_collections` | CASCADE | `drink_collection_purchases_collection_id_fkey` |
| `drink_collection_purchases` | `users` | CASCADE | `drink_collection_purchases_user_id_fkey` |
| `drink_collection_reviews` | `drink_collections` | CASCADE | `drink_collection_reviews_collection_id_fkey` |
| `drink_collection_reviews` | `users` | CASCADE | `drink_collection_reviews_user_id_fkey` |
| `drink_collection_sales_ledger` | `drink_collection_checkout_sessions` | SET NULL | `drink_collection_sales_ledger_checkout_session_id_fkey` |
| `drink_collection_sales_ledger` | `drink_collections` | CASCADE | `drink_collection_sales_ledger_collection_id_fkey` |
| `drink_collection_sales_ledger` | `drink_collection_purchases` | SET NULL | `drink_collection_sales_ledger_purchase_id_fkey` |
| `drink_collection_sales_ledger` | `users` | CASCADE | `drink_collection_sales_ledger_user_id_fkey` |
| `drink_collection_square_webhook_events` | `drink_collection_checkout_sessions` | SET NULL | `drink_collection_square_webhook_events_checkout_session_id_fkey` |
| `drink_collection_wishlists` | `drink_collections` | CASCADE | `drink_collection_wishlists_collection_id_fkey` |
| `drink_collection_wishlists` | `users` | CASCADE | `drink_collection_wishlists_user_id_fkey` |
| `drink_collections` | `users` | CASCADE | `drink_collections_user_id_fkey` |
| `drink_events` | `users` | NO ACTION | `drink_events_user_id_users_id_fk` |
| `drink_gifts` | `users` | CASCADE | `drink_gifts_purchaser_user_id_fkey` |
| `drink_gifts` | `users` | SET NULL | `drink_gifts_recipient_user_id_fkey` |
| `drink_likes` | `custom_drinks` | CASCADE | `drink_likes_drink_id_custom_drinks_id_fk` |
| `drink_likes` | `users` | NO ACTION | `drink_likes_user_id_users_id_fk` |
| `drink_photos` | `custom_drinks` | CASCADE | `drink_photos_drink_id_custom_drinks_id_fk` |
| `drink_photos` | `users` | NO ACTION | `drink_photos_user_id_users_id_fk` |
| `drink_recipes` | `users` | NO ACTION | `drink_recipes_user_id_fkey` |
| `drink_saves` | `custom_drinks` | CASCADE | `drink_saves_drink_id_custom_drinks_id_fk` |
| `drink_saves` | `users` | NO ACTION | `drink_saves_user_id_users_id_fk` |
| `email_verification_tokens` | `users` | CASCADE | `email_verification_tokens_user_id_fkey` |
| `expiry_reminders` | `pantry_items_enhanced` | CASCADE | `expiry_reminders_pantry_item_id_fkey` |
| `expiry_reminders` | `users` | NO ACTION | `expiry_reminders_user_id_fkey` |
| `family_meal_profiles` | `family_members` | NO ACTION | `family_meal_profiles_family_member_id_fkey` |
| `family_meal_profiles` | `users` | CASCADE | `family_meal_profiles_user_id_fkey` |
| `family_members` | `users` | NO ACTION | `family_members_household_member_id_fkey` |
| `family_members` | `users` | CASCADE | `family_members_user_id_fkey` |
| `follow_requests` | `users` | CASCADE | `follow_requests_requester_id_fkey` |
| `follow_requests` | `users` | CASCADE | `follow_requests_target_id_fkey` |
| `follows` | `users` | NO ACTION | `follows_follower_id_users_id_fk` |
| `follows` | `users` | NO ACTION | `follows_following_id_users_id_fk` |
| `grocery_list_items` | `meal_plans` | NO ACTION | `grocery_list_items_meal_plan_id_fkey` |
| `grocery_list_items` | `users` | CASCADE | `grocery_list_items_user_id_fkey` |
| `health_integrations` | `users` | CASCADE | `health_integrations_user_id_fkey` |
| `health_sync_log` | `health_integrations` | CASCADE | `health_sync_log_integration_id_fkey` |
| `health_sync_log` | `users` | CASCADE | `health_sync_log_user_id_fkey` |
| `household_members` | `households` | CASCADE | `household_members_household_id_fkey` |
| `household_members` | `users` | CASCADE | `household_members_user_id_fkey` |
| `households` | `users` | NO ACTION | `households_owner_id_fkey` |
| `leftovers` | `recipes` | NO ACTION | `leftovers_recipe_id_fkey` |
| `leftovers` | `recipes` | NO ACTION | `leftovers_repurposed_into_fkey` |
| `leftovers` | `users` | CASCADE | `leftovers_user_id_fkey` |
| `likes` | `posts` | NO ACTION | `likes_post_id_posts_id_fk` |
| `likes` | `users` | NO ACTION | `likes_user_id_users_id_fk` |
| `meal_favorites` | `users` | CASCADE | `meal_favorites_user_id_fkey` |
| `meal_plan_blueprints` | `users` | NO ACTION | `meal_plan_blueprints_creator_id_fkey` |
| `meal_plan_comments` | `meal_plan_blueprints` | CASCADE | `meal_plan_comments_blueprint_id_fkey` |
| `meal_plan_comments` | `users` | CASCADE | `meal_plan_comments_user_id_fkey` |
| `meal_plan_creator_profiles` | `users` | CASCADE | `meal_plan_creator_profiles_user_id_fkey` |
| `meal_plan_entries` | `meal_plans` | NO ACTION | `meal_plan_entries_meal_plan_id_meal_plans_id_fk` |
| `meal_plan_entries` | `recipes` | NO ACTION | `meal_plan_entries_recipe_id_recipes_id_fk` |
| `meal_plan_likes` | `meal_plan_blueprints` | CASCADE | `meal_plan_likes_blueprint_id_fkey` |
| `meal_plan_likes` | `users` | CASCADE | `meal_plan_likes_user_id_fkey` |
| `meal_plan_purchases` | `meal_plan_blueprints` | NO ACTION | `meal_plan_purchases_blueprint_id_fkey` |
| `meal_plan_purchases` | `users` | NO ACTION | `meal_plan_purchases_user_id_fkey` |
| `meal_plan_reviews` | `meal_plan_blueprints` | NO ACTION | `meal_plan_reviews_blueprint_id_fkey` |
| `meal_plan_reviews` | `users` | NO ACTION | `meal_plan_reviews_user_id_fkey` |
| `meal_plan_saves` | `meal_plan_blueprints` | CASCADE | `meal_plan_saves_blueprint_id_fkey` |
| `meal_plan_saves` | `users` | CASCADE | `meal_plan_saves_user_id_fkey` |
| `meal_plan_week_shares` | `users` | CASCADE | `meal_plan_week_shares_user_id_fkey` |
| `meal_planner_analytics_events` | `users` | NO ACTION | `meal_planner_analytics_events_actor_user_id_fkey` |
| `meal_planner_analytics_events` | `users` | NO ACTION | `meal_planner_analytics_events_creator_id_fkey` |
| `meal_planner_analytics_events` | `meal_plan_blueprints` | NO ACTION | `meal_planner_analytics_events_meal_plan_id_fkey` |
| `meal_plans` | `users` | NO ACTION | `meal_plans_user_id_users_id_fk` |
| `meal_prep_schedules` | `meal_plans` | NO ACTION | `meal_prep_schedules_meal_plan_id_fkey` |
| `meal_prep_schedules` | `users` | CASCADE | `meal_prep_schedules_user_id_fkey` |
| `meal_recommendations` | `meal_plan_blueprints` | NO ACTION | `meal_recommendations_blueprint_id_fkey` |
| `meal_recommendations` | `recipes` | NO ACTION | `meal_recommendations_recipe_id_fkey` |
| `meal_recommendations` | `users` | CASCADE | `meal_recommendations_user_id_fkey` |
| `meal_streaks` | `users` | CASCADE | `meal_streaks_user_id_fkey` |
| `notifications` | `users` | CASCADE | `notifications_user_id_fkey` |
| `nutrition_intro_trials` | `users` | CASCADE | `nutrition_intro_trials_user_id_fkey` |
| `nutrition_logs` | `recipes` | NO ACTION | `nutrition_logs_recipe_id_recipes_id_fk` |
| `nutrition_logs` | `users` | NO ACTION | `nutrition_logs_user_id_users_id_fk` |
| `nutrition_personality_profiles` | `users` | NO ACTION | `nutrition_personality_profiles_user_id_fkey` |
| `orders` | `users` | NO ACTION | `orders_buyer_id_users_id_fk` |
| `orders` | `products` | NO ACTION | `orders_product_id_products_id_fk` |
| `orders` | `users` | NO ACTION | `orders_seller_id_users_id_fk` |
| `pantry_household_invites` | `pantry_households` | CASCADE | `pantry_household_invites_household_id_fkey` |
| `pantry_household_invites` | `users` | CASCADE | `pantry_household_invites_invited_by_user_id_fkey` |
| `pantry_household_invites` | `users` | CASCADE | `pantry_household_invites_invited_user_id_fkey` |
| `pantry_household_members` | `pantry_households` | CASCADE | `pantry_household_members_household_id_fkey` |
| `pantry_household_members` | `users` | CASCADE | `pantry_household_members_user_id_fkey` |
| `pantry_households` | `users` | CASCADE | `pantry_households_owner_id_fkey` |
| `pantry_items` | `pantry_households` | SET NULL | `pantry_items_household_id_fkey` |
| `pantry_items` | `users` | NO ACTION | `pantry_items_user_id_users_id_fk` |
| `pantry_items_enhanced` | `households` | NO ACTION | `pantry_items_enhanced_household_id_fkey` |
| `pantry_items_enhanced` | `users` | NO ACTION | `pantry_items_enhanced_user_id_fkey` |
| `payment_methods` | `users` | CASCADE | `payment_methods_user_id_fkey` |
| `payout_schedules` | `users` | CASCADE | `payout_schedules_seller_id_fkey` |
| `payouts` | `payment_methods` | NO ACTION | `payouts_payment_method_id_fkey` |
| `payouts` | `users` | CASCADE | `payouts_seller_id_fkey` |
| `pet_food_events` | `users` | SET NULL | `pet_food_events_user_id_fkey` |
| `planner_objective_history` | `users` | NO ACTION | `planner_objective_history_user_id_fkey` |
| `planner_relationship_learning` | `users` | NO ACTION | `planner_relationship_learning_user_id_fkey` |
| `posts` | `users` | NO ACTION | `posts_user_id_users_id_fk` |
| `products` | `users` | NO ACTION | `products_seller_id_users_id_fk` |
| `quest_progress` | `daily_quests` | CASCADE | `quest_progress_quest_id_fkey` |
| `quest_progress` | `users` | CASCADE | `quest_progress_user_id_fkey` |
| `recipe_allergens` | `recipes` | CASCADE | `recipe_allergens_recipe_id_fkey` |
| `recipe_matches` | `recipes` | NO ACTION | `recipe_matches_recipe_id_fkey` |
| `recipe_matches` | `users` | NO ACTION | `recipe_matches_user_id_fkey` |
| `recipe_remixes` | `recipes` | NO ACTION | `recipe_remixes_original_recipe_id_fkey` |
| `recipe_remixes` | `recipes` | NO ACTION | `recipe_remixes_remixed_recipe_id_fkey` |
| `recipe_remixes` | `users` | CASCADE | `recipe_remixes_user_id_fkey` |
| `recipe_review_photos` | `recipe_reviews` | NO ACTION | `recipe_review_photos_review_id_fkey` |
| `recipe_reviews` | `recipes` | NO ACTION | `recipe_reviews_recipe_id_fkey` |
| `recipe_reviews` | `users` | NO ACTION | `recipe_reviews_user_id_fkey` |
| `recipe_saves` | `recipes` | CASCADE | `recipe_saves_recipe_id_fkey` |
| `recipe_saves` | `users` | NO ACTION | `recipe_saves_user_id_fkey` |
| `recipe_timing_log` | `recipes` | CASCADE | `recipe_timing_log_recipe_id_fkey` |
| `recipe_timing_log` | `users` | CASCADE | `recipe_timing_log_user_id_fkey` |
| `recipes` | `clubs` | NO ACTION | `recipes_origin_club_id_fkey` |
| `recipes` | `posts` | NO ACTION | `recipes_post_id_posts_id_fk` |
| `remix_likes` | `recipe_remixes` | CASCADE | `remix_likes_remix_id_recipe_remixes_id_fk` |
| `remix_likes` | `users` | NO ACTION | `remix_likes_user_id_users_id_fk` |
| `remix_saves` | `recipe_remixes` | CASCADE | `remix_saves_remix_id_recipe_remixes_id_fk` |
| `remix_saves` | `users` | NO ACTION | `remix_saves_user_id_users_id_fk` |
| `review_helpful` | `recipe_reviews` | NO ACTION | `review_helpful_review_id_fkey` |
| `review_helpful` | `users` | NO ACTION | `review_helpful_user_id_fkey` |
| `shared_week_comments` | `users` | CASCADE | `shared_week_comments_user_id_fkey` |
| `shared_week_likes` | `users` | CASCADE | `shared_week_likes_user_id_fkey` |
| `shared_week_saves` | `users` | CASCADE | `shared_week_saves_user_id_fkey` |
| `square_oauth_transactions` | `users` | CASCADE | `square_oauth_transactions_user_id_users_id_fk` |
| `staff_group_members` | `staff_groups` | CASCADE | `staff_group_members_group_id_fkey` |
| `staff_group_members` | `users` | CASCADE | `staff_group_members_user_id_fkey` |
| `staff_group_permissions` | `staff_groups` | CASCADE | `staff_group_permissions_group_id_fkey` |
| `staff_invites` | `staff_users` | CASCADE | `staff_invites_staff_user_id_fkey` |
| `staff_recovery_codes` | `staff_users` | CASCADE | `staff_recovery_codes_staff_user_id_fkey` |
| `staff_sessions` | `staff_users` | CASCADE | `staff_sessions_staff_user_id_fkey` |
| `staff_user_groups` | `staff_groups` | CASCADE | `staff_user_groups_group_id_fkey` |
| `staff_user_groups` | `staff_users` | CASCADE | `staff_user_groups_staff_user_id_fkey` |
| `store_drops` | `users` | NO ACTION | `store_drops_owner_id_fkey` |
| `store_drops` | `products` | NO ACTION | `store_drops_product_id_fkey` |
| `store_drops` | `stores` | NO ACTION | `store_drops_store_id_fkey` |
| `stores` | `users` | NO ACTION | `stores_user_id_users_id_fk` |
| `stories` | `users` | NO ACTION | `stories_user_id_users_id_fk` |
| `subscription_history` | `users` | NO ACTION | `subscription_history_user_id_users_id_fk` |
| `substitutions` | `substitution_ingredients` | CASCADE | `substitutions_ingredient_id_substitution_ingredients_id_fk` |
| `taste_profiles` | `users` | CASCADE | `taste_profiles_user_id_fkey` |
| `user_analytics` | `users` | CASCADE | `user_analytics_user_id_fkey` |
| `user_badges` | `badges` | CASCADE | `user_badges_badge_id_fkey` |
| `user_badges` | `users` | CASCADE | `user_badges_user_id_fkey` |
| `user_drink_stats` | `users` | NO ACTION | `user_drink_stats_user_id_users_id_fk` |
| `user_goals` | `users` | CASCADE | `user_goals_user_id_fkey` |
| `user_meal_plan_achievements` | `meal_plan_achievements` | NO ACTION | `user_meal_plan_achievements_achievement_id_fkey` |
| `user_meal_plan_achievements` | `users` | CASCADE | `user_meal_plan_achievements_user_id_fkey` |
| `user_meal_plan_progress` | `meal_plan_blueprints` | NO ACTION | `user_meal_plan_progress_blueprint_id_fkey` |
| `user_meal_plan_progress` | `meal_plans` | NO ACTION | `user_meal_plan_progress_meal_plan_id_fkey` |
| `user_meal_plan_progress` | `users` | CASCADE | `user_meal_plan_progress_user_id_fkey` |
| `user_nutrition_campaigns` | `users` | CASCADE | `user_nutrition_campaigns_user_id_fkey` |
| `user_substitution_preferences` | `users` | CASCADE | `user_substitution_preferences_user_id_fkey` |
| `water_logs` | `users` | CASCADE | `water_logs_user_id_fkey` |
| `wedding_calendar_events` | `users` | NO ACTION | `wedding_calendar_events_user_id_fkey` |
| `wedding_event_details` | `users` | CASCADE | `wedding_event_details_user_id_fkey` |
| `wedding_intro_trials` | `users` | CASCADE | `wedding_intro_trials_user_id_fkey` |
| `wedding_planning_insights` | `users` | CASCADE | `wedding_planning_insights_user_id_fkey` |
| `wedding_planning_tasks` | `users` | NO ACTION | `wedding_planning_tasks_user_id_fkey` |
| `wedding_registry_links` | `users` | CASCADE | `wedding_registry_links_user_id_fkey` |
| `wedding_rsvp_invitations` | `users` | CASCADE | `wedding_rsvp_invitations_user_id_fkey` |
| `wedding_square_card_setup_attempts` | `users` | NO ACTION | `wedding_square_card_setup_attempts_user_id_fkey` |
| `wedding_square_card_updates` | `users` | NO ACTION | `wedding_square_card_updates_user_id_fkey` |
| `wedding_square_card_updates` | `wedding_square_subscriptions` | NO ACTION | `wedding_square_card_updates_wedding_subscription_id_fkey` |
| `wedding_square_enrollment_attempts` | `users` | NO ACTION | `wedding_square_enrollment_attempts_user_id_fkey` |
| `wedding_square_invoice_evidence` | `wedding_square_subscriptions` | NO ACTION | `wedding_square_invoice_evidence_wedding_subscription_id_fkey` |
| `wedding_square_subscriptions` | `users` | NO ACTION | `wedding_square_subscriptions_user_id_fkey` |
| `wedding_vendor_listings` | `users` | SET NULL | `wedding_vendor_listings_reviewed_by_fkey` |
| `wedding_vendor_listings` | `users` | SET NULL | `wedding_vendor_listings_user_id_fkey` |

## Required release checks

- Retained financial and purchased-content rows **must never be hard deleted**, even through indirect CASCADE edges.
- Verify all provider-backed payments, refunds, disputes, card updates, subscriptions and seller payouts; local status alone cannot authorize erasure.
- Protect all financial writers with closure-compatible row locks; include provider retries and async webhooks.
- Inventory personal data inside retained JSON, notes, order addresses, checkout snapshots and audit rows; apply owner-approved legal retention and minimization policy.
- Keep all media cleanup as queued candidates until complete independent reference checks for paid/shared/local/R2 objects.
- Current `account_status` CHECK still excludes `closed`; production migration requires explicit owner authorization. Permanent deletion stays OFF.
