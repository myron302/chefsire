-- Production schema catch-up (add-only), 2026-11-09.
-- Production was missing 35 declared tables and 48 columns on 5 tables (orders, payment_methods,
-- meal_plan_purchases, catering_inquiries, meal_plan_blueprints), which made marketplace checkout, Square seller
-- connection, catering bookings and paid meal-plan purchases fail. All five tables had 0 rows when checked.
-- Generated from shared/schema.ts: drizzle-kit push to an empty database, pg_dump --schema-only of the missing
-- tables, and ADD COLUMN statements (type, default, NOT NULL) plus constraints/indexes that use the new columns.
-- No DROP, no UPDATE/DELETE. One transaction: any error rolls everything back.
BEGIN;

\restrict M9D7XikuD2XVkxr2LbQ3gWOJDtx56KrTU5gVhPLjnvdNQTt29ZrSfO0Md9vmTRC

CREATE TABLE public.catering_attempt_square_payments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    attempt_id character varying NOT NULL,
    square_payment_id text NOT NULL,
    amount_cents bigint NOT NULL,
    tip_cents bigint DEFAULT 0 NOT NULL,
    currency character varying(3) NOT NULL,
    square_created_at timestamp with time zone,
    square_updated_at timestamp with time zone,
    completed_at timestamp with time zone,
    has_refunds boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_attempt_square_payment_amount_check CHECK (((amount_cents > 0) AND (amount_cents <= '9999999999'::bigint))),
    CONSTRAINT catering_attempt_square_payment_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT catering_attempt_square_payment_tip_check CHECK (((tip_cents >= 0) AND (tip_cents <= amount_cents)))
);

CREATE TABLE public.catering_availability_exceptions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    provider_id character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    type character varying(16) NOT NULL,
    reason character varying(300),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_availability_exception_range_check CHECK ((end_date >= start_date)),
    CONSTRAINT catering_availability_exception_type_check CHECK (((type)::text = ANY ((ARRAY['available'::character varying, 'blocked'::character varying])::text[])))
);

CREATE TABLE public.catering_availability_settings (
    provider_id character varying NOT NULL,
    accepting_bookings boolean DEFAULT true NOT NULL,
    minimum_lead_days integer DEFAULT 0 NOT NULL,
    maximum_advance_days integer DEFAULT 365 NOT NULL,
    timezone character varying(100) DEFAULT 'UTC'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_availability_window_check CHECK (((minimum_lead_days >= 0) AND (maximum_advance_days >= minimum_lead_days) AND (maximum_advance_days <= 1095)))
);

CREATE TABLE public.catering_availability_weekly_rules (
    provider_id character varying NOT NULL,
    day_of_week integer NOT NULL,
    available boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_availability_weekly_day_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

CREATE TABLE public.catering_booking_access_details (
    booking_id character varying NOT NULL,
    load_in_entrance character varying(240),
    loading_dock_notes text,
    elevator_notes text,
    kitchen_access_notes text,
    parking_instructions text,
    security_check_in_notes text,
    access_window_start character varying(5),
    access_window_end character varying(5),
    venue_contact_name character varying(120),
    venue_contact_phone character varying(40),
    venue_contact_source character varying(16),
    power_water_notes text,
    trash_removal_notes text,
    special_restrictions text,
    provider_private_notes text,
    access_confirmed boolean DEFAULT false NOT NULL,
    updated_by character varying,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_execution_access_contact_source_check CHECK (((venue_contact_source IS NULL) OR ((venue_contact_source)::text = ANY ((ARRAY['provider'::character varying, 'customer'::character varying])::text[])))),
    CONSTRAINT catering_execution_access_window_end_check CHECK (((access_window_end IS NULL) OR ((access_window_end)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_access_window_range_check CHECK (((access_window_start IS NULL) OR (access_window_end IS NULL) OR ((access_window_end)::text >= (access_window_start)::text))),
    CONSTRAINT catering_execution_access_window_start_check CHECK (((access_window_start IS NULL) OR ((access_window_start)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text)))
);

CREATE TABLE public.catering_booking_activity (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    actor_user_id character varying NOT NULL,
    event_type character varying(40) NOT NULL,
    visibility character varying(16) DEFAULT 'shared'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_booking_activity_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['booking_offered'::character varying, 'customer_confirmed'::character varying, 'booking_cancelled'::character varying, 'booking_completed'::character varying, 'details_updated'::character varying, 'shared_requirement_added'::character varying, 'shared_requirement_updated'::character varying, 'shared_requirement_completed'::character varying, 'shared_requirement_deleted'::character varying, 'shared_file_uploaded'::character varying, 'shared_file_removed'::character varying, 'provider_file_uploaded'::character varying, 'provider_file_removed'::character varying, 'execution_timeline_added'::character varying, 'execution_timeline_updated'::character varying, 'execution_timeline_completed'::character varying, 'execution_timeline_removed'::character varying, 'shared_equipment_added'::character varying, 'shared_equipment_status_changed'::character varying, 'execution_access_updated'::character varying, 'provider_execution_milestone_completed'::character varying, 'booking_closed_out'::character varying, 'booking_closeout_reopened'::character varying, 'billing_invoice_issued'::character varying, 'billing_invoice_voided'::character varying, 'billing_payment_recorded'::character varying, 'billing_payment_voided'::character varying, 'billing_processor_payment_confirmed'::character varying])::text[]))),
    CONSTRAINT catering_booking_activity_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['provider'::character varying, 'shared'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_adjustments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    entry_kind character varying(16) NOT NULL,
    source character varying(24) DEFAULT 'provider_recorded'::character varying NOT NULL,
    status character varying(16) DEFAULT 'posted'::character varying NOT NULL,
    amount_cents bigint NOT NULL,
    currency character varying(3) NOT NULL,
    reason character varying(500) NOT NULL,
    reference character varying(64),
    payment_id character varying,
    amendment_id character varying,
    idempotency_key character varying(64),
    recorded_by character varying NOT NULL,
    reversed_at timestamp with time zone,
    reversed_by character varying,
    reversal_reason character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_adjustment_amount_check CHECK (((amount_cents > 0) AND (amount_cents <= '9999999999'::bigint))),
    CONSTRAINT catering_adjustment_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT catering_adjustment_kind_check CHECK (((entry_kind)::text = ANY ((ARRAY['charge'::character varying, 'credit'::character varying, 'refund'::character varying])::text[]))),
    CONSTRAINT catering_adjustment_provenance_check CHECK (((((source)::text = 'provider_recorded'::text) AND (amendment_id IS NULL) AND (idempotency_key IS NOT NULL)) OR (((source)::text = 'amendment'::text) AND (amendment_id IS NOT NULL) AND (idempotency_key IS NULL) AND ((entry_kind)::text = ANY ((ARRAY['charge'::character varying, 'credit'::character varying])::text[])) AND (payment_id IS NULL) AND (reference IS NULL)))),
    CONSTRAINT catering_adjustment_reason_check CHECK ((length(btrim((reason)::text)) > 0)),
    CONSTRAINT catering_adjustment_refund_columns_check CHECK ((((payment_id IS NULL) AND (reference IS NULL)) OR ((entry_kind)::text = 'refund'::text))),
    CONSTRAINT catering_adjustment_reversal_check CHECK (((((status)::text = 'posted'::text) AND (reversed_at IS NULL) AND (reversed_by IS NULL) AND (reversal_reason IS NULL)) OR (((status)::text = 'reversed'::text) AND ((source)::text = 'provider_recorded'::text) AND (reversed_at IS NOT NULL) AND (reversed_by IS NOT NULL) AND (reversal_reason IS NOT NULL) AND (length(btrim((reversal_reason)::text)) > 0)))),
    CONSTRAINT catering_adjustment_source_check CHECK (((source)::text = ANY ((ARRAY['provider_recorded'::character varying, 'amendment'::character varying])::text[]))),
    CONSTRAINT catering_adjustment_status_check CHECK (((status)::text = ANY ((ARRAY['posted'::character varying, 'reversed'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_amendments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    amendment_number integer NOT NULL,
    proposed_by_user_id character varying NOT NULL,
    proposed_by_role character varying(16) NOT NULL,
    client_request_id character varying(36) NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    changed_fields text[] NOT NULL,
    base_accepted_amendment_id character varying,
    base_event_date date NOT NULL,
    base_guest_count integer,
    base_price_cents bigint,
    base_currency character varying(3) NOT NULL,
    base_terms_note text,
    event_date date,
    guest_count integer,
    price_cents bigint,
    currency character varying(3),
    terms_note text,
    message text,
    responded_by_user_id character varying,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_amendments_base_currency_check CHECK (((base_currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT catering_amendments_base_guest_check CHECK (((base_guest_count IS NULL) OR (base_guest_count > 0))),
    CONSTRAINT catering_amendments_base_price_check CHECK (((base_price_cents IS NULL) OR (base_price_cents >= 0))),
    CONSTRAINT catering_amendments_currency_check CHECK (((('currency'::text = ANY (changed_fields)) AND (currency IS NOT NULL) AND ((currency)::text ~ '^[A-Z]{3}$'::text)) OR (('currency'::text <> ALL (changed_fields)) AND (currency IS NULL)))),
    CONSTRAINT catering_amendments_event_date_check CHECK (((('event_date'::text = ANY (changed_fields)) AND (event_date IS NOT NULL)) OR (('event_date'::text <> ALL (changed_fields)) AND (event_date IS NULL)))),
    CONSTRAINT catering_amendments_fields_check CHECK (((cardinality(changed_fields) >= 1) AND (changed_fields <@ ARRAY['event_date'::text, 'guest_count'::text, 'price_cents'::text, 'currency'::text, 'terms_note'::text]))),
    CONSTRAINT catering_amendments_guest_check CHECK (((guest_count IS NULL) OR ((guest_count > 0) AND (guest_count <= 100000)))),
    CONSTRAINT catering_amendments_guest_unlisted_check CHECK ((('guest_count'::text = ANY (changed_fields)) OR (guest_count IS NULL))),
    CONSTRAINT catering_amendments_note_length_check CHECK ((((terms_note IS NULL) OR (length(terms_note) <= 2000)) AND ((message IS NULL) OR (length(message) <= 1000)))),
    CONSTRAINT catering_amendments_note_unlisted_check CHECK ((('terms_note'::text = ANY (changed_fields)) OR (terms_note IS NULL))),
    CONSTRAINT catering_amendments_number_check CHECK (((amendment_number >= 1) AND (amendment_number <= 50))),
    CONSTRAINT catering_amendments_price_check CHECK (((price_cents IS NULL) OR ((price_cents >= 0) AND (price_cents <= '9999999999'::bigint)))),
    CONSTRAINT catering_amendments_price_unlisted_check CHECK ((('price_cents'::text = ANY (changed_fields)) OR (price_cents IS NULL))),
    CONSTRAINT catering_amendments_response_check CHECK (((((status)::text = 'pending'::text) AND (responded_by_user_id IS NULL) AND (responded_at IS NULL)) OR (((status)::text = ANY ((ARRAY['accepted'::character varying, 'declined'::character varying])::text[])) AND (responded_by_user_id IS NOT NULL) AND ((responded_by_user_id)::text <> (proposed_by_user_id)::text) AND (responded_at IS NOT NULL)) OR (((status)::text = 'withdrawn'::text) AND ((responded_by_user_id)::text = (proposed_by_user_id)::text) AND (responded_at IS NOT NULL)) OR (((status)::text = 'superseded'::text) AND (responded_by_user_id IS NULL) AND (responded_at IS NOT NULL)))),
    CONSTRAINT catering_amendments_role_check CHECK (((proposed_by_role)::text = ANY ((ARRAY['provider'::character varying, 'customer'::character varying])::text[]))),
    CONSTRAINT catering_amendments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying, 'superseded'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_billing (
    booking_id character varying NOT NULL,
    deposit_mode character varying(16) DEFAULT 'none'::character varying NOT NULL,
    deposit_amount_cents bigint,
    deposit_percent_bp integer,
    deposit_due_on date,
    terms_updated_by character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_billing_amount_check CHECK (((deposit_amount_cents IS NULL) OR ((deposit_amount_cents >= 0) AND (deposit_amount_cents <= '9999999999'::bigint)))),
    CONSTRAINT catering_billing_mode_check CHECK (((deposit_mode)::text = ANY ((ARRAY['none'::character varying, 'fixed'::character varying, 'percentage'::character varying])::text[]))),
    CONSTRAINT catering_billing_percent_check CHECK (((deposit_percent_bp IS NULL) OR ((deposit_percent_bp > 0) AND (deposit_percent_bp <= 10000)))),
    CONSTRAINT catering_billing_terms_pairing_check CHECK (((((deposit_mode)::text = 'none'::text) AND (deposit_amount_cents IS NULL) AND (deposit_percent_bp IS NULL)) OR (((deposit_mode)::text = 'fixed'::text) AND (deposit_amount_cents IS NOT NULL) AND (deposit_percent_bp IS NULL)) OR (((deposit_mode)::text = 'percentage'::text) AND (deposit_percent_bp IS NOT NULL) AND (deposit_amount_cents IS NULL))))
);

CREATE TABLE public.catering_booking_closeout (
    booking_id character varying NOT NULL,
    provider_notes text,
    closed_out_at timestamp with time zone,
    closed_out_by character varying,
    reopen_count integer DEFAULT 0 NOT NULL,
    last_reopened_at timestamp with time zone,
    last_reopened_by character varying,
    updated_by character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_closeout_closed_by_check CHECK ((((closed_out_at IS NULL) AND (closed_out_by IS NULL)) OR ((closed_out_at IS NOT NULL) AND (closed_out_by IS NOT NULL)))),
    CONSTRAINT catering_closeout_reopen_audit_check CHECK ((((reopen_count = 0) AND (last_reopened_at IS NULL) AND (last_reopened_by IS NULL)) OR ((reopen_count > 0) AND (last_reopened_at IS NOT NULL) AND (last_reopened_by IS NOT NULL)))),
    CONSTRAINT catering_closeout_reopen_count_check CHECK ((reopen_count >= 0))
);

CREATE TABLE public.catering_booking_closeout_items (
    booking_id character varying NOT NULL,
    item_key character varying(40) NOT NULL,
    state character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    provider_note text,
    resolved_at timestamp with time zone,
    resolved_by character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_closeout_item_key_check CHECK (((item_key)::text = ANY ((ARRAY['equipment_return_confirmed'::character varying, 'final_documents_delivered'::character varying, 'customer_follow_up_completed'::character varying, 'internal_event_notes_completed'::character varying, 'review_request_handled'::character varying, 'incident_follow_up_resolved'::character varying, 'final_admin_review_completed'::character varying])::text[]))),
    CONSTRAINT catering_closeout_item_resolved_check CHECK (((((state)::text = 'pending'::text) AND (resolved_at IS NULL) AND (resolved_by IS NULL)) OR (((state)::text <> 'pending'::text) AND (resolved_at IS NOT NULL) AND (resolved_by IS NOT NULL)))),
    CONSTRAINT catering_closeout_item_state_check CHECK (((state)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'not_applicable'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_conversations (
    booking_id character varying NOT NULL,
    thread_id character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.catering_booking_details (
    booking_id character varying NOT NULL,
    venue_name character varying(160),
    venue_address character varying(240),
    venue_city character varying(120),
    venue_state character varying(80),
    venue_postal_code character varying(24),
    venue_instructions text,
    arrival_time character varying(5),
    service_start_time character varying(5),
    service_end_time character varying(5),
    setup_notes text,
    access_notes text,
    kitchen_available boolean,
    refrigeration_available boolean,
    power_available boolean,
    water_available boolean,
    indoor_outdoor character varying(16),
    customer_notes text,
    provider_notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_booking_details_arrival_time_check CHECK (((arrival_time IS NULL) OR ((arrival_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_booking_details_indoor_outdoor_check CHECK (((indoor_outdoor IS NULL) OR ((indoor_outdoor)::text = ANY ((ARRAY['indoor'::character varying, 'outdoor'::character varying, 'both'::character varying])::text[])))),
    CONSTRAINT catering_booking_details_service_end_time_check CHECK (((service_end_time IS NULL) OR ((service_end_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_booking_details_service_start_time_check CHECK (((service_start_time IS NULL) OR ((service_start_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text)))
);

CREATE TABLE public.catering_booking_equipment (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    name character varying(160) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    source_type character varying(24) NOT NULL,
    source_name character varying(160),
    pickup_date date,
    pickup_time character varying(5),
    return_date date,
    return_time character varying(5),
    status character varying(16) DEFAULT 'planned'::character varying NOT NULL,
    is_blocker boolean DEFAULT false NOT NULL,
    notes text,
    visibility character varying(20) DEFAULT 'provider_private'::character varying NOT NULL,
    created_by character varying NOT NULL,
    client_request_id uuid,
    shared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_execution_equipment_pickup_time_check CHECK (((pickup_time IS NULL) OR ((pickup_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_equipment_quantity_check CHECK (((quantity >= 1) AND (quantity <= 9999))),
    CONSTRAINT catering_execution_equipment_return_time_check CHECK (((return_time IS NULL) OR ((return_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_equipment_schedule_check CHECK (((pickup_date IS NULL) OR (return_date IS NULL) OR (return_date > pickup_date) OR ((return_date = pickup_date) AND ((pickup_time IS NULL) OR (return_time IS NULL) OR ((return_time)::text >= (pickup_time)::text))))),
    CONSTRAINT catering_execution_equipment_shared_era_check CHECK (((((visibility)::text = 'shared'::text) AND (shared_at IS NOT NULL)) OR (((visibility)::text <> 'shared'::text) AND (shared_at IS NULL)))),
    CONSTRAINT catering_execution_equipment_source_check CHECK (((source_type)::text = ANY ((ARRAY['provider_owned'::character varying, 'rental'::character varying, 'venue_supplied'::character varying, 'customer_supplied'::character varying])::text[]))),
    CONSTRAINT catering_execution_equipment_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'confirmed'::character varying, 'received'::character varying, 'in_use'::character varying, 'returned'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT catering_execution_equipment_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['shared'::character varying, 'provider_private'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_execution_create_requests (
    booking_id character varying NOT NULL,
    created_by character varying NOT NULL,
    resource_type character varying(16) NOT NULL,
    client_request_id uuid NOT NULL,
    resource_id character varying NOT NULL,
    consumed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_execution_create_request_type_check CHECK (((resource_type)::text = ANY ((ARRAY['timeline'::character varying, 'staff'::character varying, 'equipment'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_execution_milestones (
    booking_id character varying NOT NULL,
    milestone_key character varying(32) NOT NULL,
    completed_at timestamp with time zone,
    completed_by character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_execution_milestone_completed_by_check CHECK ((((completed_at IS NULL) AND (completed_by IS NULL)) OR ((completed_at IS NOT NULL) AND (completed_by IS NOT NULL)))),
    CONSTRAINT catering_execution_milestone_key_check CHECK (((milestone_key)::text = ANY ((ARRAY['crew_confirmed'::character varying, 'equipment_loaded'::character varying, 'departed_for_venue'::character varying, 'arrived'::character varying, 'load_in_complete'::character varying, 'setup_complete'::character varying, 'food_ready'::character varying, 'service_started'::character varying, 'service_complete'::character varying, 'cleanup_complete'::character varying, 'load_out_complete'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_execution_timeline (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    category character varying(32) DEFAULT 'custom'::character varying NOT NULL,
    scheduled_time character varying(5),
    end_time character varying(5),
    visibility character varying(20) DEFAULT 'provider_private'::character varying NOT NULL,
    sort_order integer NOT NULL,
    is_blocker boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    completed_by character varying,
    created_by character varying NOT NULL,
    client_request_id uuid,
    shared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_execution_timeline_category_check CHECK (((category)::text = ANY ((ARRAY['arrival'::character varying, 'load_in'::character varying, 'setup'::character varying, 'food_prep'::character varying, 'guest_arrival'::character varying, 'service'::character varying, 'cake_or_special_moment'::character varying, 'cleanup'::character varying, 'breakdown'::character varying, 'load_out'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT catering_execution_timeline_completed_by_check CHECK ((((completed_at IS NULL) AND (completed_by IS NULL)) OR ((completed_at IS NOT NULL) AND (completed_by IS NOT NULL)))),
    CONSTRAINT catering_execution_timeline_end_time_check CHECK (((end_time IS NULL) OR ((end_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_timeline_scheduled_time_check CHECK (((scheduled_time IS NULL) OR ((scheduled_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_timeline_shared_era_check CHECK (((((visibility)::text = 'shared'::text) AND (shared_at IS NOT NULL)) OR (((visibility)::text <> 'shared'::text) AND (shared_at IS NULL)))),
    CONSTRAINT catering_execution_timeline_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT catering_execution_timeline_time_range_check CHECK (((scheduled_time IS NULL) OR (end_time IS NULL) OR ((end_time)::text >= (scheduled_time)::text))),
    CONSTRAINT catering_execution_timeline_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['shared'::character varying, 'provider_private'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_files (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    uploaded_by character varying NOT NULL,
    visibility character varying(16) NOT NULL,
    storage_provider character varying(16) NOT NULL,
    storage_key text NOT NULL,
    original_filename character varying(255) NOT NULL,
    content_type character varying(128) NOT NULL,
    byte_size bigint NOT NULL,
    sha256 character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by character varying,
    object_deleted_at timestamp with time zone,
    cleanup_attempts integer DEFAULT 0 NOT NULL,
    cleanup_error text,
    cleanup_claim_token character varying,
    cleanup_claimed_until timestamp with time zone,
    cleanup_delete_attempted_at timestamp with time zone,
    client_request_id uuid,
    CONSTRAINT catering_booking_files_byte_size_check CHECK (((byte_size > 0) AND (byte_size <= 15728640))),
    CONSTRAINT catering_booking_files_cleanup_attempts_check CHECK ((cleanup_attempts >= 0)),
    CONSTRAINT catering_booking_files_deleted_by_check CHECK ((((deleted_at IS NULL) AND (deleted_by IS NULL)) OR ((deleted_at IS NOT NULL) AND (deleted_by IS NOT NULL)))),
    CONSTRAINT catering_booking_files_object_deleted_check CHECK (((object_deleted_at IS NULL) OR (deleted_at IS NOT NULL))),
    CONSTRAINT catering_booking_files_sha256_check CHECK (((sha256)::text ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT catering_booking_files_storage_provider_check CHECK (((storage_provider)::text = ANY ((ARRAY['r2'::character varying, 'local'::character varying])::text[]))),
    CONSTRAINT catering_booking_files_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['provider'::character varying, 'shared'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    invoice_number integer NOT NULL,
    invoice_kind character varying(16) NOT NULL,
    amount_cents bigint NOT NULL,
    currency character varying(3) NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    due_on date,
    issued_at timestamp with time zone,
    voided_at timestamp with time zone,
    void_reason character varying(200),
    created_by character varying,
    voided_by character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_invoice_amount_check CHECK (((amount_cents > 0) AND (amount_cents <= '9999999999'::bigint))),
    CONSTRAINT catering_invoice_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT catering_invoice_issued_check CHECK (((((status)::text = 'draft'::text) AND (issued_at IS NULL)) OR (((status)::text <> 'draft'::text) AND (issued_at IS NOT NULL)))),
    CONSTRAINT catering_invoice_kind_check CHECK (((invoice_kind)::text = ANY ((ARRAY['deposit'::character varying, 'balance'::character varying, 'adjustment'::character varying])::text[]))),
    CONSTRAINT catering_invoice_number_check CHECK ((invoice_number > 0)),
    CONSTRAINT catering_invoice_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'issued'::character varying, 'void'::character varying])::text[]))),
    CONSTRAINT catering_invoice_void_check CHECK (((((status)::text = 'void'::text) AND (voided_at IS NOT NULL) AND (voided_by IS NOT NULL)) OR (((status)::text <> 'void'::text) AND (voided_at IS NULL) AND (voided_by IS NULL))))
);

CREATE TABLE public.catering_booking_message_requests (
    booking_id character varying NOT NULL,
    sender_id character varying NOT NULL,
    client_request_id uuid NOT NULL,
    message_id character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.catering_booking_payment_attempts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    provider_id character varying NOT NULL,
    processor character varying(24) DEFAULT 'square'::character varying NOT NULL,
    processor_environment character varying(12) DEFAULT 'sandbox'::character varying NOT NULL,
    merchant_id text NOT NULL,
    location_id text NOT NULL,
    currency character varying(3) NOT NULL,
    amount_cents bigint NOT NULL,
    idempotency_key character varying(64) NOT NULL,
    state character varying(32) DEFAULT 'creating'::character varying NOT NULL,
    square_payment_link_id text,
    square_order_id text,
    checkout_url text,
    square_payment_id text,
    processor_amount_cents bigint,
    processor_currency character varying(3),
    processor_payment_count integer DEFAULT 0 NOT NULL,
    payment_id character varying,
    reconciliation_reason character varying(40),
    failure_code character varying(40),
    square_link_closed_at timestamp with time zone,
    square_link_close_attempts integer DEFAULT 0 NOT NULL,
    square_link_close_attempted_at timestamp with time zone,
    square_create_started_at timestamp with time zone,
    square_create_resolved_at timestamp with time zone,
    square_create_uncertain_at timestamp with time zone,
    refund_review_at timestamp with time zone,
    closure_verified_at timestamp with time zone,
    last_checked_at timestamp with time zone,
    verified_at timestamp with time zone,
    completed_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_attempt_amount_check CHECK (((amount_cents > 0) AND (amount_cents <= '9999999999'::bigint))),
    CONSTRAINT catering_attempt_completed_check CHECK ((((state)::text <> 'completed'::text) OR ((payment_id IS NOT NULL) AND (square_payment_id IS NOT NULL) AND (processor_amount_cents IS NOT NULL) AND (processor_currency IS NOT NULL) AND (completed_at IS NOT NULL) AND (processor_payment_count = 1)))),
    CONSTRAINT catering_attempt_currency_check CHECK (((currency)::text = 'USD'::text)),
    CONSTRAINT catering_attempt_environment_check CHECK (((processor_environment)::text = 'sandbox'::text)),
    CONSTRAINT catering_attempt_ledger_link_check CHECK (((payment_id IS NULL) OR ((state)::text = 'completed'::text) OR (((state)::text = 'reconciliation_required'::text) AND ((reconciliation_reason)::text = 'multiple_payments'::text)))),
    CONSTRAINT catering_attempt_link_close_attempts_check CHECK ((square_link_close_attempts >= 0)),
    CONSTRAINT catering_attempt_payment_count_check CHECK (((((state)::text = ANY ((ARRAY['completed'::character varying, 'reconciliation_required'::character varying])::text[])) AND (processor_payment_count >= 1)) OR (((state)::text <> ALL ((ARRAY['completed'::character varying, 'reconciliation_required'::character varying])::text[])) AND (processor_payment_count = 0)))),
    CONSTRAINT catering_attempt_payment_evidence_check CHECK (((square_payment_id IS NULL) OR ((state)::text = ANY ((ARRAY['completed'::character varying, 'reconciliation_required'::character varying])::text[])))),
    CONSTRAINT catering_attempt_pending_check CHECK ((((state)::text <> 'pending'::text) OR ((square_order_id IS NOT NULL) AND (square_payment_link_id IS NOT NULL) AND (checkout_url IS NOT NULL)))),
    CONSTRAINT catering_attempt_processor_amount_check CHECK (((processor_amount_cents IS NULL) OR ((processor_amount_cents > 0) AND (processor_amount_cents <= '9999999999'::bigint)))),
    CONSTRAINT catering_attempt_processor_check CHECK (((processor)::text = 'square'::text)),
    CONSTRAINT catering_attempt_processor_currency_check CHECK (((processor_currency IS NULL) OR ((processor_currency)::text ~ '^[A-Z]{3}$'::text))),
    CONSTRAINT catering_attempt_reconciliation_check CHECK ((((state)::text <> 'reconciliation_required'::text) OR ((reconciliation_reason IS NOT NULL) AND (processor_payment_count >= 1) AND (((processor_payment_count = 1) AND (payment_id IS NULL) AND (square_payment_id IS NOT NULL) AND (processor_amount_cents IS NOT NULL) AND (processor_currency IS NOT NULL)) OR ((processor_payment_count > 1) AND (square_payment_id IS NULL)))))),
    CONSTRAINT catering_attempt_reconciliation_reason_check CHECK (((reconciliation_reason IS NULL) OR ((state)::text = 'reconciliation_required'::text))),
    CONSTRAINT catering_attempt_state_check CHECK (((state)::text = ANY ((ARRAY['creating'::character varying, 'pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'superseded'::character varying, 'reconciliation_required'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_payments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    amount_cents bigint NOT NULL,
    currency character varying(3) NOT NULL,
    payment_method character varying(24) NOT NULL,
    payment_source character varying(24) DEFAULT 'provider_recorded'::character varying NOT NULL,
    status character varying(16) DEFAULT 'recorded'::character varying NOT NULL,
    received_on date NOT NULL,
    reference character varying(64),
    recorded_by character varying,
    voided_at timestamp with time zone,
    voided_by character varying,
    void_reason character varying(200),
    idempotency_key character varying(64),
    processor character varying(24),
    processor_payment_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_payment_amount_check CHECK (((amount_cents > 0) AND (amount_cents <= '9999999999'::bigint))),
    CONSTRAINT catering_payment_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT catering_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'bank_transfer'::character varying, 'card_in_person'::character varying, 'cheque'::character varying, 'other'::character varying, 'card_online'::character varying])::text[]))),
    CONSTRAINT catering_payment_online_method_check CHECK ((((payment_method)::text = 'card_online'::text) = ((payment_source)::text = 'processor'::text))),
    CONSTRAINT catering_payment_processor_check CHECK (((processor IS NULL) OR ((processor)::text = 'square'::text))),
    CONSTRAINT catering_payment_provenance_check CHECK (((((payment_source)::text = 'provider_recorded'::text) AND (recorded_by IS NOT NULL) AND (processor IS NULL) AND (processor_payment_id IS NULL)) OR (((payment_source)::text = 'processor'::text) AND (processor IS NOT NULL) AND (processor_payment_id IS NOT NULL)))),
    CONSTRAINT catering_payment_source_check CHECK (((payment_source)::text = ANY ((ARRAY['provider_recorded'::character varying, 'processor'::character varying])::text[]))),
    CONSTRAINT catering_payment_status_check CHECK (((status)::text = ANY ((ARRAY['recorded'::character varying, 'voided'::character varying])::text[]))),
    CONSTRAINT catering_payment_void_check CHECK (((((status)::text = 'voided'::text) AND (voided_at IS NOT NULL) AND (voided_by IS NOT NULL)) OR (((status)::text <> 'voided'::text) AND (voided_at IS NULL) AND (voided_by IS NULL))))
);

CREATE TABLE public.catering_booking_staff_assignments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    worker_name character varying(120) NOT NULL,
    role character varying(24) NOT NULL,
    custom_role character varying(60),
    contact_note character varying(200),
    arrival_time character varying(5),
    departure_time character varying(5),
    responsibility_note text,
    created_by character varying NOT NULL,
    client_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_execution_staff_arrival_time_check CHECK (((arrival_time IS NULL) OR ((arrival_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_staff_custom_role_check CHECK (((((role)::text = 'custom'::text) AND (custom_role IS NOT NULL)) OR (((role)::text <> 'custom'::text) AND (custom_role IS NULL)))),
    CONSTRAINT catering_execution_staff_departure_time_check CHECK (((departure_time IS NULL) OR ((departure_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_execution_staff_role_check CHECK (((role)::text = ANY ((ARRAY['lead'::character varying, 'chef'::character varying, 'prep'::character varying, 'server'::character varying, 'bartender'::character varying, 'runner'::character varying, 'setup'::character varying, 'breakdown'::character varying, 'driver'::character varying, 'coordinator'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT catering_execution_staff_time_range_check CHECK (((arrival_time IS NULL) OR (departure_time IS NULL) OR ((departure_time)::text >= (arrival_time)::text)))
);

CREATE TABLE public.catering_booking_storage_orphans (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    storage_provider character varying(16) NOT NULL,
    storage_key text NOT NULL,
    file_id character varying,
    reason character varying(40) NOT NULL,
    cleanup_attempts integer DEFAULT 1 NOT NULL,
    cleanup_error text,
    cleanup_claim_token character varying,
    cleanup_claimed_until timestamp with time zone,
    cleanup_delete_attempted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT catering_booking_storage_orphans_attempts_check CHECK ((cleanup_attempts >= 0)),
    CONSTRAINT catering_booking_storage_orphans_provider_check CHECK (((storage_provider)::text = ANY ((ARRAY['r2'::character varying, 'local'::character varying])::text[])))
);

CREATE TABLE public.catering_booking_tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    visibility character varying(16) DEFAULT 'provider'::character varying NOT NULL,
    due_date date,
    due_time character varying(5),
    sort_order integer NOT NULL,
    created_by character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_booking_tasks_due_time_check CHECK (((due_time IS NULL) OR ((due_time)::text ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'::text))),
    CONSTRAINT catering_booking_tasks_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT catering_booking_tasks_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT catering_booking_tasks_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['provider'::character varying, 'shared'::character varying])::text[])))
);

CREATE TABLE public.catering_bookings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    inquiry_id character varying NOT NULL,
    provider_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    package_id character varying,
    event_date date NOT NULL,
    event_type text,
    guest_count integer,
    agreed_price numeric(12,2),
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    package_title_snapshot character varying(160),
    package_pricing_model_snapshot character varying(30),
    package_starting_price_snapshot numeric(12,2),
    status character varying(24) DEFAULT 'pending_confirmation'::character varying NOT NULL,
    provider_confirmed_at timestamp with time zone,
    customer_confirmed_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancelled_by character varying(16),
    cancellation_reason text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_bookings_agreed_price_check CHECK (((agreed_price IS NULL) OR (agreed_price >= (0)::numeric))),
    CONSTRAINT catering_bookings_cancelled_by_check CHECK (((cancelled_by IS NULL) OR ((cancelled_by)::text = ANY ((ARRAY['provider'::character varying, 'customer'::character varying])::text[])))),
    CONSTRAINT catering_bookings_guest_count_check CHECK (((guest_count IS NULL) OR (guest_count > 0))),
    CONSTRAINT catering_bookings_status_check CHECK (((status)::text = ANY ((ARRAY['pending_confirmation'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[])))
);

CREATE TABLE public.catering_offer_revisions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    booking_id character varying NOT NULL,
    revision_number integer NOT NULL,
    kind character varying(16) NOT NULL,
    proposed_by_user_id character varying NOT NULL,
    proposed_by_role character varying(16) NOT NULL,
    client_request_id character varying(36) NOT NULL,
    responds_to_revision_id character varying,
    price_cents bigint,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    guest_count integer,
    note text,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_offer_revisions_change_request_check CHECK ((((kind)::text <> 'change_request'::text) OR ((price_cents IS NULL) AND (guest_count IS NULL) AND (note IS NOT NULL) AND (length(btrim(note)) > 0) AND (accepted_at IS NULL)))),
    CONSTRAINT catering_offer_revisions_currency_check CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT catering_offer_revisions_guest_check CHECK (((guest_count IS NULL) OR ((guest_count > 0) AND (guest_count <= 100000)))),
    CONSTRAINT catering_offer_revisions_kind_check CHECK (((kind)::text = ANY ((ARRAY['offer'::character varying, 'change_request'::character varying])::text[]))),
    CONSTRAINT catering_offer_revisions_number_check CHECK (((revision_number >= 1) AND (revision_number <= 50))),
    CONSTRAINT catering_offer_revisions_price_check CHECK (((price_cents IS NULL) OR ((price_cents >= 0) AND (price_cents <= '9999999999'::bigint)))),
    CONSTRAINT catering_offer_revisions_responds_to_check CHECK ((((kind)::text = 'change_request'::text) OR (responds_to_revision_id IS NULL))),
    CONSTRAINT catering_offer_revisions_role_check CHECK (((((kind)::text = 'offer'::text) AND ((proposed_by_role)::text = 'provider'::text)) OR (((kind)::text = 'change_request'::text) AND ((proposed_by_role)::text = 'customer'::text))))
);

CREATE TABLE public.catering_packages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    provider_id character varying NOT NULL,
    title character varying(120) NOT NULL,
    description text NOT NULL,
    category character varying(40) NOT NULL,
    cover_image text,
    gallery_images jsonb DEFAULT '[]'::jsonb NOT NULL,
    pricing_model character varying(30) NOT NULL,
    starting_price numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    minimum_guests integer NOT NULL,
    maximum_guests integer,
    preparation_style character varying(100),
    service_style character varying(100),
    cuisines jsonb DEFAULT '[]'::jsonb NOT NULL,
    dietary_accommodations jsonb DEFAULT '[]'::jsonb NOT NULL,
    included_services jsonb DEFAULT '[]'::jsonb NOT NULL,
    optional_add_ons jsonb DEFAULT '[]'::jsonb NOT NULL,
    estimated_duration integer,
    active boolean DEFAULT false NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.catering_reviews (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    provider_id character varying NOT NULL,
    reviewer_id character varying NOT NULL,
    inquiry_id character varying,
    rating integer NOT NULL,
    title character varying(120),
    body text NOT NULL,
    verified_event boolean DEFAULT false NOT NULL,
    provider_response text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE public.catering_square_webhook_events (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type character varying(64) NOT NULL,
    merchant_id text,
    square_order_id text,
    square_payment_id text,
    attempt_id character varying,
    state character varying(16) DEFAULT 'received'::character varying NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    outcome character varying(40),
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catering_square_webhook_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT catering_square_webhook_state_check CHECK (((state)::text = ANY ((ARRAY['received'::character varying, 'processing'::character varying, 'processed'::character varying, 'ignored'::character varying, 'failed'::character varying])::text[])))
);

CREATE TABLE public.remix_likes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    remix_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.remix_saves (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    remix_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.square_merchant_revocations (
    merchant_id text NOT NULL,
    revoked_at timestamp with time zone NOT NULL,
    revocation_epoch bigint DEFAULT 1 NOT NULL,
    source character varying(24) DEFAULT 'disconnect'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT square_merchant_revocations_epoch_check CHECK ((revocation_epoch >= 1)),
    CONSTRAINT square_merchant_revocations_merchant_check CHECK ((length(btrim(merchant_id)) > 0)),
    CONSTRAINT square_merchant_revocations_source_check CHECK (((source)::text = 'disconnect'::text))
);

CREATE TABLE public.square_oauth_transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    nonce_hash character varying(64) NOT NULL,
    browser_binding_hash character varying(64) NOT NULL,
    claim_id character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    claimed_at timestamp with time zone,
    consumed_at timestamp with time zone
);

CREATE TABLE public.square_plaintext_enforcement_state (
    id boolean DEFAULT true NOT NULL,
    finalized_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT square_plaintext_enforcement_state_singleton_check CHECK ((id = true))
);

ALTER TABLE ONLY public.catering_attempt_square_payments
    ADD CONSTRAINT catering_attempt_square_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_availability_exceptions
    ADD CONSTRAINT catering_availability_exceptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_availability_settings
    ADD CONSTRAINT catering_availability_settings_pkey PRIMARY KEY (provider_id);

ALTER TABLE ONLY public.catering_booking_access_details
    ADD CONSTRAINT catering_booking_access_details_pkey PRIMARY KEY (booking_id);

ALTER TABLE ONLY public.catering_booking_activity
    ADD CONSTRAINT catering_booking_activity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_adjustments
    ADD CONSTRAINT catering_booking_adjustments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_amendments
    ADD CONSTRAINT catering_booking_amendments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_billing
    ADD CONSTRAINT catering_booking_billing_pkey PRIMARY KEY (booking_id);

ALTER TABLE ONLY public.catering_booking_closeout_items
    ADD CONSTRAINT catering_booking_closeout_items_pkey PRIMARY KEY (booking_id, item_key);

ALTER TABLE ONLY public.catering_booking_closeout
    ADD CONSTRAINT catering_booking_closeout_pkey PRIMARY KEY (booking_id);

ALTER TABLE ONLY public.catering_booking_conversations
    ADD CONSTRAINT catering_booking_conversations_pkey PRIMARY KEY (booking_id);

ALTER TABLE ONLY public.catering_booking_conversations
    ADD CONSTRAINT catering_booking_conversations_thread_id_unique UNIQUE (thread_id);

ALTER TABLE ONLY public.catering_booking_details
    ADD CONSTRAINT catering_booking_details_pkey PRIMARY KEY (booking_id);

ALTER TABLE ONLY public.catering_booking_equipment
    ADD CONSTRAINT catering_booking_equipment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_execution_create_requests
    ADD CONSTRAINT catering_booking_execution_create_requests_pkey PRIMARY KEY (booking_id, created_by, resource_type, client_request_id);

ALTER TABLE ONLY public.catering_booking_execution_milestones
    ADD CONSTRAINT catering_booking_execution_milestones_pkey PRIMARY KEY (booking_id, milestone_key);

ALTER TABLE ONLY public.catering_booking_execution_timeline
    ADD CONSTRAINT catering_booking_execution_timeline_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_files
    ADD CONSTRAINT catering_booking_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_invoices
    ADD CONSTRAINT catering_booking_invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_message_requests
    ADD CONSTRAINT catering_booking_message_requests_pkey PRIMARY KEY (booking_id, sender_id, client_request_id);

ALTER TABLE ONLY public.catering_booking_payment_attempts
    ADD CONSTRAINT catering_booking_payment_attempts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_payments
    ADD CONSTRAINT catering_booking_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_staff_assignments
    ADD CONSTRAINT catering_booking_staff_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_storage_orphans
    ADD CONSTRAINT catering_booking_storage_orphans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_booking_tasks
    ADD CONSTRAINT catering_booking_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_bookings
    ADD CONSTRAINT catering_bookings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_offer_revisions
    ADD CONSTRAINT catering_offer_revisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_packages
    ADD CONSTRAINT catering_packages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_reviews
    ADD CONSTRAINT catering_reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catering_square_webhook_events
    ADD CONSTRAINT catering_square_webhook_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.remix_likes
    ADD CONSTRAINT remix_likes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.remix_saves
    ADD CONSTRAINT remix_saves_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.square_merchant_revocations
    ADD CONSTRAINT square_merchant_revocations_pkey PRIMARY KEY (merchant_id);

ALTER TABLE ONLY public.square_oauth_transactions
    ADD CONSTRAINT square_oauth_transactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.square_oauth_transactions
    ADD CONSTRAINT square_oauth_transactions_user_id_unique UNIQUE (user_id);

ALTER TABLE ONLY public.square_plaintext_enforcement_state
    ADD CONSTRAINT square_plaintext_enforcement_state_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX catering_adjustments_amendment_uidx ON public.catering_booking_adjustments USING btree (amendment_id) WHERE (amendment_id IS NOT NULL);

CREATE INDEX catering_adjustments_booking_idx ON public.catering_booking_adjustments USING btree (booking_id, created_at, id);

CREATE UNIQUE INDEX catering_adjustments_idempotency_uidx ON public.catering_booking_adjustments USING btree (booking_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX catering_adjustments_payment_idx ON public.catering_booking_adjustments USING btree (payment_id) WHERE (payment_id IS NOT NULL);

CREATE UNIQUE INDEX catering_amendments_booking_number_uidx ON public.catering_booking_amendments USING btree (booking_id, amendment_number);

CREATE UNIQUE INDEX catering_amendments_pending_uidx ON public.catering_booking_amendments USING btree (booking_id) WHERE ((status)::text = 'pending'::text);

CREATE UNIQUE INDEX catering_amendments_request_uidx ON public.catering_booking_amendments USING btree (booking_id, proposed_by_user_id, client_request_id);

CREATE INDEX catering_attempt_square_payments_attempt_idx ON public.catering_attempt_square_payments USING btree (attempt_id, completed_at, id);

CREATE UNIQUE INDEX catering_attempt_square_payments_payment_uidx ON public.catering_attempt_square_payments USING btree (square_payment_id);

CREATE INDEX catering_attempts_booking_idx ON public.catering_booking_payment_attempts USING btree (booking_id, created_at, id);

CREATE UNIQUE INDEX catering_attempts_idempotency_uidx ON public.catering_booking_payment_attempts USING btree (idempotency_key);

CREATE INDEX catering_attempts_invoice_idx ON public.catering_booking_payment_attempts USING btree (invoice_id, state);

CREATE UNIQUE INDEX catering_attempts_ledger_uidx ON public.catering_booking_payment_attempts USING btree (payment_id) WHERE (payment_id IS NOT NULL);

CREATE UNIQUE INDEX catering_attempts_link_uidx ON public.catering_booking_payment_attempts USING btree (square_payment_link_id) WHERE (square_payment_link_id IS NOT NULL);

CREATE UNIQUE INDEX catering_attempts_open_invoice_uidx ON public.catering_booking_payment_attempts USING btree (invoice_id) WHERE ((state)::text = ANY ((ARRAY['creating'::character varying, 'pending'::character varying])::text[]));

CREATE UNIQUE INDEX catering_attempts_order_uidx ON public.catering_booking_payment_attempts USING btree (square_order_id) WHERE (square_order_id IS NOT NULL);

CREATE UNIQUE INDEX catering_attempts_square_payment_uidx ON public.catering_booking_payment_attempts USING btree (square_payment_id) WHERE (square_payment_id IS NOT NULL);

CREATE UNIQUE INDEX catering_availability_exception_no_duplicate ON public.catering_availability_exceptions USING btree (provider_id, start_date, end_date, type);

CREATE INDEX catering_availability_exceptions_provider_dates_idx ON public.catering_availability_exceptions USING btree (provider_id, start_date, end_date);

CREATE UNIQUE INDEX catering_availability_weekly_provider_day_uidx ON public.catering_availability_weekly_rules USING btree (provider_id, day_of_week);

CREATE INDEX catering_booking_activity_booking_page_idx ON public.catering_booking_activity USING btree (booking_id, created_at, id);

CREATE INDEX catering_booking_conversations_thread_idx ON public.catering_booking_conversations USING btree (thread_id);

CREATE UNIQUE INDEX catering_booking_files_booking_id_uidx ON public.catering_booking_files USING btree (booking_id, id);

CREATE INDEX catering_booking_files_booking_page_idx ON public.catering_booking_files USING btree (booking_id, created_at, id);

CREATE UNIQUE INDEX catering_booking_files_request_uidx ON public.catering_booking_files USING btree (booking_id, uploaded_by, client_request_id) WHERE (client_request_id IS NOT NULL);

CREATE UNIQUE INDEX catering_booking_files_storage_key_uidx ON public.catering_booking_files USING btree (storage_key);

CREATE INDEX catering_booking_message_requests_message_idx ON public.catering_booking_message_requests USING btree (message_id);

CREATE UNIQUE INDEX catering_booking_tasks_booking_id_uidx ON public.catering_booking_tasks USING btree (booking_id, id);

CREATE INDEX catering_booking_tasks_booking_sort_idx ON public.catering_booking_tasks USING btree (booking_id, sort_order, id);

CREATE INDEX catering_bookings_customer_event_idx ON public.catering_bookings USING btree (customer_id, event_date, id);

CREATE UNIQUE INDEX catering_bookings_inquiry_uidx ON public.catering_bookings USING btree (inquiry_id);

CREATE INDEX catering_bookings_provider_event_idx ON public.catering_bookings USING btree (provider_id, event_date, id);

CREATE UNIQUE INDEX catering_execution_equipment_booking_id_uidx ON public.catering_booking_equipment USING btree (booking_id, id);

CREATE INDEX catering_execution_equipment_booking_idx ON public.catering_booking_equipment USING btree (booking_id, created_at, id);

CREATE UNIQUE INDEX catering_execution_equipment_request_uidx ON public.catering_booking_equipment USING btree (booking_id, created_by, client_request_id) WHERE (client_request_id IS NOT NULL);

CREATE INDEX catering_execution_equipment_visible_idx ON public.catering_booking_equipment USING btree (booking_id, visibility, shared_at, id);

CREATE UNIQUE INDEX catering_execution_staff_booking_id_uidx ON public.catering_booking_staff_assignments USING btree (booking_id, id);

CREATE INDEX catering_execution_staff_booking_idx ON public.catering_booking_staff_assignments USING btree (booking_id, created_at, id);

CREATE UNIQUE INDEX catering_execution_staff_request_uidx ON public.catering_booking_staff_assignments USING btree (booking_id, created_by, client_request_id) WHERE (client_request_id IS NOT NULL);

CREATE UNIQUE INDEX catering_execution_timeline_booking_id_uidx ON public.catering_booking_execution_timeline USING btree (booking_id, id);

CREATE INDEX catering_execution_timeline_booking_sort_idx ON public.catering_booking_execution_timeline USING btree (booking_id, sort_order, id);

CREATE UNIQUE INDEX catering_execution_timeline_request_uidx ON public.catering_booking_execution_timeline USING btree (booking_id, created_by, client_request_id) WHERE (client_request_id IS NOT NULL);

CREATE INDEX catering_invoices_due_idx ON public.catering_booking_invoices USING btree (booking_id, status, due_on);

CREATE UNIQUE INDEX catering_invoices_live_kind_uidx ON public.catering_booking_invoices USING btree (booking_id, invoice_kind) WHERE (((status)::text <> 'void'::text) AND ((invoice_kind)::text <> 'adjustment'::text));

CREATE UNIQUE INDEX catering_invoices_number_uidx ON public.catering_booking_invoices USING btree (booking_id, invoice_number);

CREATE UNIQUE INDEX catering_offer_revisions_accepted_uidx ON public.catering_offer_revisions USING btree (booking_id) WHERE (accepted_at IS NOT NULL);

CREATE UNIQUE INDEX catering_offer_revisions_booking_number_uidx ON public.catering_offer_revisions USING btree (booking_id, revision_number);

CREATE UNIQUE INDEX catering_offer_revisions_request_uidx ON public.catering_offer_revisions USING btree (booking_id, proposed_by_user_id, client_request_id);

CREATE INDEX catering_packages_provider_order_idx ON public.catering_packages USING btree (provider_id, display_order, created_at);

CREATE INDEX catering_payments_booking_idx ON public.catering_booking_payments USING btree (booking_id, received_on, id);

CREATE UNIQUE INDEX catering_payments_idempotency_uidx ON public.catering_booking_payments USING btree (booking_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX catering_payments_invoice_idx ON public.catering_booking_payments USING btree (invoice_id, status);

CREATE UNIQUE INDEX catering_payments_processor_uidx ON public.catering_booking_payments USING btree (processor, processor_payment_id) WHERE (processor_payment_id IS NOT NULL);

CREATE UNIQUE INDEX catering_reviews_inquiry_uidx ON public.catering_reviews USING btree (inquiry_id);

CREATE INDEX catering_reviews_provider_date_idx ON public.catering_reviews USING btree (provider_id, created_at);

CREATE INDEX catering_reviews_provider_rating_idx ON public.catering_reviews USING btree (provider_id, rating);

CREATE UNIQUE INDEX catering_reviews_reviewer_provider_uidx ON public.catering_reviews USING btree (reviewer_id, provider_id);

CREATE INDEX catering_square_webhook_attempt_idx ON public.catering_square_webhook_events USING btree (attempt_id) WHERE (attempt_id IS NOT NULL);

CREATE UNIQUE INDEX catering_square_webhook_event_uidx ON public.catering_square_webhook_events USING btree (event_id);

CREATE INDEX catering_square_webhook_retry_idx ON public.catering_square_webhook_events USING btree (state, updated_at) WHERE ((state)::text = ANY ((ARRAY['received'::character varying, 'processing'::character varying, 'failed'::character varying])::text[]));

CREATE INDEX remix_likes_remix_idx ON public.remix_likes USING btree (remix_id);

CREATE UNIQUE INDEX remix_likes_user_remix_idx ON public.remix_likes USING btree (user_id, remix_id);

CREATE INDEX remix_saves_remix_idx ON public.remix_saves USING btree (remix_id);

CREATE UNIQUE INDEX remix_saves_user_remix_idx ON public.remix_saves USING btree (user_id, remix_id);

CREATE INDEX square_oauth_transactions_expiry_idx ON public.square_oauth_transactions USING btree (expires_at);

CREATE INDEX square_oauth_transactions_nonce_idx ON public.square_oauth_transactions USING btree (nonce_hash);

ALTER TABLE ONLY public.catering_attempt_square_payments
    ADD CONSTRAINT catering_attempt_square_payments_attempt_id_catering_booking_pa FOREIGN KEY (attempt_id) REFERENCES public.catering_booking_payment_attempts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_availability_exceptions
    ADD CONSTRAINT catering_availability_exceptions_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catering_availability_settings
    ADD CONSTRAINT catering_availability_settings_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catering_availability_weekly_rules
    ADD CONSTRAINT catering_availability_weekly_rules_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catering_booking_access_details
    ADD CONSTRAINT catering_booking_access_details_booking_id_catering_bookings_id FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_access_details
    ADD CONSTRAINT catering_booking_access_details_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_activity
    ADD CONSTRAINT catering_booking_activity_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_activity
    ADD CONSTRAINT catering_booking_activity_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_adjustments
    ADD CONSTRAINT catering_booking_adjustments_amendment_id_catering_booking_amen FOREIGN KEY (amendment_id) REFERENCES public.catering_booking_amendments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_adjustments
    ADD CONSTRAINT catering_booking_adjustments_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_adjustments
    ADD CONSTRAINT catering_booking_adjustments_payment_id_catering_booking_paymen FOREIGN KEY (payment_id) REFERENCES public.catering_booking_payments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_adjustments
    ADD CONSTRAINT catering_booking_adjustments_recorded_by_users_id_fk FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_adjustments
    ADD CONSTRAINT catering_booking_adjustments_reversed_by_users_id_fk FOREIGN KEY (reversed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_amendments
    ADD CONSTRAINT catering_booking_amendments_base_accepted_amendment_id_catering FOREIGN KEY (base_accepted_amendment_id) REFERENCES public.catering_booking_amendments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_amendments
    ADD CONSTRAINT catering_booking_amendments_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_amendments
    ADD CONSTRAINT catering_booking_amendments_proposed_by_user_id_users_id_fk FOREIGN KEY (proposed_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_amendments
    ADD CONSTRAINT catering_booking_amendments_responded_by_user_id_users_id_fk FOREIGN KEY (responded_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_billing
    ADD CONSTRAINT catering_booking_billing_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_billing
    ADD CONSTRAINT catering_booking_billing_terms_updated_by_users_id_fk FOREIGN KEY (terms_updated_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_closeout
    ADD CONSTRAINT catering_booking_closeout_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_closeout
    ADD CONSTRAINT catering_booking_closeout_closed_out_by_users_id_fk FOREIGN KEY (closed_out_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_closeout_items
    ADD CONSTRAINT catering_booking_closeout_items_booking_id_catering_bookings_id FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_closeout_items
    ADD CONSTRAINT catering_booking_closeout_items_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_closeout
    ADD CONSTRAINT catering_booking_closeout_last_reopened_by_users_id_fk FOREIGN KEY (last_reopened_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_closeout
    ADD CONSTRAINT catering_booking_closeout_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_conversations
    ADD CONSTRAINT catering_booking_conversations_booking_id_catering_bookings_id_ FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_conversations
    ADD CONSTRAINT catering_booking_conversations_thread_id_dm_threads_id_fk FOREIGN KEY (thread_id) REFERENCES public.dm_threads(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_details
    ADD CONSTRAINT catering_booking_details_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_equipment
    ADD CONSTRAINT catering_booking_equipment_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_equipment
    ADD CONSTRAINT catering_booking_equipment_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_create_requests
    ADD CONSTRAINT catering_booking_execution_create_requests_booking_id_catering_ FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_create_requests
    ADD CONSTRAINT catering_booking_execution_create_requests_created_by_users_id_ FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_milestones
    ADD CONSTRAINT catering_booking_execution_milestones_booking_id_catering_booki FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_milestones
    ADD CONSTRAINT catering_booking_execution_milestones_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_timeline
    ADD CONSTRAINT catering_booking_execution_timeline_booking_id_catering_booking FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_timeline
    ADD CONSTRAINT catering_booking_execution_timeline_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_execution_timeline
    ADD CONSTRAINT catering_booking_execution_timeline_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_files
    ADD CONSTRAINT catering_booking_files_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_files
    ADD CONSTRAINT catering_booking_files_deleted_by_users_id_fk FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_files
    ADD CONSTRAINT catering_booking_files_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_invoices
    ADD CONSTRAINT catering_booking_invoices_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_invoices
    ADD CONSTRAINT catering_booking_invoices_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_invoices
    ADD CONSTRAINT catering_booking_invoices_voided_by_users_id_fk FOREIGN KEY (voided_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_message_requests
    ADD CONSTRAINT catering_booking_message_requests_booking_id_catering_bookings_ FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_message_requests
    ADD CONSTRAINT catering_booking_message_requests_message_id_dm_messages_id_fk FOREIGN KEY (message_id) REFERENCES public.dm_messages(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_message_requests
    ADD CONSTRAINT catering_booking_message_requests_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payment_attempts
    ADD CONSTRAINT catering_booking_payment_attempts_booking_id_catering_bookings_ FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payment_attempts
    ADD CONSTRAINT catering_booking_payment_attempts_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payment_attempts
    ADD CONSTRAINT catering_booking_payment_attempts_invoice_id_catering_booking_i FOREIGN KEY (invoice_id) REFERENCES public.catering_booking_invoices(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payment_attempts
    ADD CONSTRAINT catering_booking_payment_attempts_payment_id_catering_booking_p FOREIGN KEY (payment_id) REFERENCES public.catering_booking_payments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payment_attempts
    ADD CONSTRAINT catering_booking_payment_attempts_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payments
    ADD CONSTRAINT catering_booking_payments_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payments
    ADD CONSTRAINT catering_booking_payments_invoice_id_catering_booking_invoices_ FOREIGN KEY (invoice_id) REFERENCES public.catering_booking_invoices(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payments
    ADD CONSTRAINT catering_booking_payments_recorded_by_users_id_fk FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_payments
    ADD CONSTRAINT catering_booking_payments_voided_by_users_id_fk FOREIGN KEY (voided_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_staff_assignments
    ADD CONSTRAINT catering_booking_staff_assignments_booking_id_catering_bookings FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_staff_assignments
    ADD CONSTRAINT catering_booking_staff_assignments_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_storage_orphans
    ADD CONSTRAINT catering_booking_storage_orphans_booking_id_catering_bookings_i FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_tasks
    ADD CONSTRAINT catering_booking_tasks_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_booking_tasks
    ADD CONSTRAINT catering_booking_tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_bookings
    ADD CONSTRAINT catering_bookings_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_bookings
    ADD CONSTRAINT catering_bookings_inquiry_id_catering_inquiries_id_fk FOREIGN KEY (inquiry_id) REFERENCES public.catering_inquiries(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_bookings
    ADD CONSTRAINT catering_bookings_package_id_catering_packages_id_fk FOREIGN KEY (package_id) REFERENCES public.catering_packages(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.catering_bookings
    ADD CONSTRAINT catering_bookings_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_offer_revisions
    ADD CONSTRAINT catering_offer_revisions_booking_id_catering_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.catering_bookings(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_offer_revisions
    ADD CONSTRAINT catering_offer_revisions_proposed_by_user_id_users_id_fk FOREIGN KEY (proposed_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_offer_revisions
    ADD CONSTRAINT catering_offer_revisions_responds_to_revision_id_catering_offer FOREIGN KEY (responds_to_revision_id) REFERENCES public.catering_offer_revisions(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.catering_packages
    ADD CONSTRAINT catering_packages_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catering_reviews
    ADD CONSTRAINT catering_reviews_inquiry_id_catering_inquiries_id_fk FOREIGN KEY (inquiry_id) REFERENCES public.catering_inquiries(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.catering_reviews
    ADD CONSTRAINT catering_reviews_provider_id_users_id_fk FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catering_reviews
    ADD CONSTRAINT catering_reviews_reviewer_id_users_id_fk FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.catering_square_webhook_events
    ADD CONSTRAINT catering_square_webhook_events_attempt_id_catering_booking_paym FOREIGN KEY (attempt_id) REFERENCES public.catering_booking_payment_attempts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.remix_likes
    ADD CONSTRAINT remix_likes_remix_id_recipe_remixes_id_fk FOREIGN KEY (remix_id) REFERENCES public.recipe_remixes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.remix_likes
    ADD CONSTRAINT remix_likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.remix_saves
    ADD CONSTRAINT remix_saves_remix_id_recipe_remixes_id_fk FOREIGN KEY (remix_id) REFERENCES public.recipe_remixes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.remix_saves
    ADD CONSTRAINT remix_saves_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.square_oauth_transactions
    ADD CONSTRAINT square_oauth_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

\unrestrict M9D7XikuD2XVkxr2LbQ3gWOJDtx56KrTU5gVhPLjnvdNQTt29ZrSfO0Md9vmTRC

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_idempotency_key character varying(64);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_tier_snapshot text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric(5,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_status text DEFAULT 'legacy_unverified'::text NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS square_refund_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS capture_idempotency_key text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS capture_attempted_at timestamp without time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS capture_request_snapshot jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reconciliation_attempted_at timestamp without time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_idempotency_key text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_attempt_payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_attempt_amount_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_attempt_currency text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_attempt_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_payment_failure_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_failed_refund_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_refund_failure_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_revenue_status text DEFAULT 'uncredited'::text NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unverified'::text NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_payment_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_captured_at timestamp without time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.orders ADD CONSTRAINT orders_inventory_status_check CHECK ((inventory_status = ANY (ARRAY['unreserved'::text, 'reserved'::text, 'sold'::text, 'released'::text, 'legacy_unverified'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_trusted_checkout_snapshot_check CHECK (((inventory_status = 'legacy_unverified'::text) OR ((checkout_idempotency_key IS NOT NULL) AND (seller_tier_snapshot IS NOT NULL) AND (commission_rate_snapshot IS NOT NULL))));
ALTER TABLE public.orders ADD CONSTRAINT orders_inventory_payment_lifecycle_check CHECK (((inventory_status = 'legacy_unverified'::text) OR ((inventory_status = 'unreserved'::text) AND (payment_status = 'unverified'::text)) OR ((inventory_status = 'reserved'::text) AND (payment_status = ANY (ARRAY['capture_pending'::text, 'capture_reconciliation'::text]))) OR ((inventory_status = 'released'::text) AND (payment_status = 'unverified'::text)) OR ((inventory_status = 'sold'::text) AND (payment_status = ANY (ARRAY['captured'::text, 'refund_pending'::text, 'refund_reconciliation'::text, 'refunded'::text])))));
ALTER TABLE public.orders ADD CONSTRAINT orders_sold_inventory_payment_evidence_check CHECK (((inventory_status <> 'sold'::text) OR ((payment_status = ANY (ARRAY['captured'::text, 'refund_pending'::text, 'refund_reconciliation'::text, 'refunded'::text])) AND (payment_provider = 'square'::text) AND (square_payment_id IS NOT NULL) AND (provider_payment_status IS NOT NULL) AND (payment_captured_at IS NOT NULL))));
ALTER TABLE public.orders ADD CONSTRAINT orders_captured_payment_evidence_check CHECK (((payment_status <> 'captured'::text) OR ((payment_provider = 'square'::text) AND (square_payment_id IS NOT NULL) AND (square_payment_id !~ '^[[:space:]]*$'::text) AND (capture_idempotency_key IS NOT NULL) AND (capture_idempotency_key !~ '^[[:space:]]*$'::text) AND (provider_payment_status = 'COMPLETED'::text) AND (payment_captured_at IS NOT NULL))));
ALTER TABLE public.orders ADD CONSTRAINT orders_seller_revenue_status_check CHECK ((seller_revenue_status = ANY (ARRAY['uncredited'::text, 'credited'::text, 'reversed'::text, 'legacy_unverified'::text])));
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders USING btree (payment_status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_uidx ON public.orders USING btree (buyer_id, checkout_idempotency_key) WHERE (checkout_idempotency_key IS NOT NULL);
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS encrypted_access_token text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS encrypted_refresh_token text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS last_refreshed_at timestamp with time zone;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS location_id text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS location_currency character varying(3);
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS merchant_name text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS granted_scopes text[];
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS disconnected_at timestamp with time zone;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS credential_generation bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS verification_attempt bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS verification_applied bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_credential_generation_check CHECK ((credential_generation >= 1));
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK ((((encrypted_access_token IS NULL) AND (encrypted_refresh_token IS NULL)) OR ((encrypted_access_token IS NOT NULL) AND (encrypted_refresh_token IS NOT NULL) AND (encrypted_access_token ~~ 'sqenc:v1:%'::text) AND (encrypted_refresh_token ~~ 'sqenc:v1:%'::text) AND (token_expires_at IS NOT NULL) AND (provider IS NOT NULL) AND (provider = 'square'::text))));
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_square_dead_holds_no_secret_check CHECK (((account_status IS NULL) OR (account_status <> ALL (ARRAY['needs_reauthorization'::text, 'disconnected'::text])) OR ((encrypted_access_token IS NULL) AND (encrypted_refresh_token IS NULL) AND ((account_details IS NULL) OR (NOT (account_details ?| ARRAY['accessToken'::text, 'refreshToken'::text]))))));
ALTER TABLE public.meal_plan_purchases ADD COLUMN IF NOT EXISTS acquisition_type text DEFAULT 'legacy_unverified'::text NOT NULL;
ALTER TABLE public.meal_plan_purchases ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE public.meal_plan_purchases ADD COLUMN IF NOT EXISTS provider_payment_id text;
ALTER TABLE public.meal_plan_purchases ADD COLUMN IF NOT EXISTS provider_payment_status text;
ALTER TABLE public.meal_plan_purchases ADD COLUMN IF NOT EXISTS payment_verified_at timestamp with time zone;
ALTER TABLE public.meal_plan_purchases ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk CHECK ((((payment_status = 'verified_paid'::text) AND (acquisition_type = 'paid'::text) AND (price_paid_cents > 0) AND (payment_provider IS NOT NULL) AND (btrim(payment_provider) <> ''::text) AND (provider_payment_id IS NOT NULL) AND (btrim(provider_payment_id) <> ''::text) AND (provider_payment_status = 'COMPLETED'::text) AND (payment_verified_at IS NOT NULL)) OR ((payment_status = 'free_acquired'::text) AND (acquisition_type = 'free'::text) AND (price_paid_cents = 0) AND (payment_provider IS NULL) AND (provider_payment_id IS NULL) AND (provider_payment_status IS NULL) AND (payment_verified_at IS NULL) AND (transaction_id IS NULL)) OR ((payment_status <> ALL (ARRAY['completed'::text, 'verified_paid'::text, 'free_acquired'::text])) AND (acquisition_type = 'legacy_unverified'::text) AND (payment_verified_at IS NULL))));
CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_purchases_provider_payment_uidx ON public.meal_plan_purchases USING btree (payment_provider, provider_payment_id) WHERE (provider_payment_id IS NOT NULL);
ALTER TABLE public.catering_inquiries ADD COLUMN IF NOT EXISTS package_id character varying;
ALTER TABLE public.catering_inquiries ADD COLUMN IF NOT EXISTS customer_email character varying(254);
ALTER TABLE public.catering_inquiries ADD COLUMN IF NOT EXISTS customer_phone character varying(32);
ALTER TABLE public.catering_inquiries ADD CONSTRAINT catering_inquiries_package_id_catering_packages_id_fk FOREIGN KEY (package_id) REFERENCES catering_packages(id) ON DELETE SET NULL;
ALTER TABLE public.meal_plan_blueprints ADD COLUMN IF NOT EXISTS is_premium_content boolean DEFAULT false;
COMMIT;
