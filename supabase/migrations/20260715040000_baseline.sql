


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."enforce_order_transitions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.status = new.status then
    return new;  -- not a status change (e.g. only another column updated)
  end if;
  if not (
       (old.status = 'pending'  and new.status in ('accepted','rejected','cancelled'))
    or (old.status = 'accepted' and new.status in ('ready','cancelled'))
    or (old.status = 'ready'    and new.status in ('completed','cancelled'))
  ) then
    raise exception 'illegal order transition: % -> %', old.status, new.status;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_order_transitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."freeze_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.role is distinct from old.role then
    raise exception 'role is immutable';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."freeze_profile_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'buyer'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_order_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select id from public.orders
  where buyer_id = auth.uid()
     or store_id in (select id from public.stores where owner_id = auth.uid())
$$;


ALTER FUNCTION "public"."my_order_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_store_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select id from public.stores where owner_id = auth.uid()
$$;


ALTER FUNCTION "public"."my_store_ids"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "label" "text",
    "full_address" "text" NOT NULL,
    "lat" double precision,
    "lng" double precision
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buyer_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "ktp_number" "text" NOT NULL,
    "ktp_image_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "buyer_verifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."buyer_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL
);


ALTER TABLE "public"."chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'payment_request'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "fulfillment" "text" NOT NULL,
    "delivery_address" "text",
    "delivery_fee" integer DEFAULT 0 NOT NULL,
    "total" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_delivery_addr_check" CHECK ((("fulfillment" <> 'delivery'::"text") OR ("delivery_address" IS NOT NULL))),
    CONSTRAINT "orders_fulfillment_check" CHECK (("fulfillment" = ANY (ARRAY['pickup'::"text", 'delivery'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'ready'::"text", 'completed'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "method" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "payments_method_check" CHECK (("method" = ANY (ARRAY['cash'::"text", 'gopay'::"text", 'transfer'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" integer NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "products_price_check" CHECK (("price" >= 0))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['buyer'::"text", 'seller'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "lat" double precision,
    "lng" double precision,
    "gmaps_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_recordings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "audio_url" "text" NOT NULL,
    "parsed_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."voice_recordings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buyer_verifications"
    ADD CONSTRAINT "buyer_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buyer_verifications"
    ADD CONSTRAINT "buyer_verifications_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_order_unique" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_product_id_key" UNIQUE ("order_id", "product_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_unique" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_order_unique" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_photos"
    ADD CONSTRAINT "store_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_recordings"
    ADD CONSTRAINT "voice_recordings_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."voice_recordings"
    ADD CONSTRAINT "voice_recordings_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_address_profile" ON "public"."addresses" USING "btree" ("profile_id");



CREATE INDEX "idx_addresses_profile" ON "public"."addresses" USING "btree" ("profile_id");



CREATE INDEX "idx_buyer_verifications_profile" ON "public"."buyer_verifications" USING "btree" ("profile_id");



CREATE INDEX "idx_bv_profile" ON "public"."buyer_verifications" USING "btree" ("profile_id");



CREATE INDEX "idx_chat_order" ON "public"."chats" USING "btree" ("order_id");



CREATE INDEX "idx_message_chat" ON "public"."messages" USING "btree" ("chat_id");



CREATE INDEX "idx_message_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_messages_chat_sent" ON "public"."messages" USING "btree" ("chat_id", "sent_at");



CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_product" ON "public"."order_items" USING "btree" ("product_id");



CREATE INDEX "idx_orders_buyer" ON "public"."orders" USING "btree" ("buyer_id");



CREATE INDEX "idx_orders_buyer_created" ON "public"."orders" USING "btree" ("buyer_id", "created_at" DESC);



CREATE INDEX "idx_orders_store" ON "public"."orders" USING "btree" ("store_id");



CREATE INDEX "idx_orders_store_created" ON "public"."orders" USING "btree" ("store_id", "created_at" DESC);



CREATE INDEX "idx_orders_store_status_created" ON "public"."orders" USING "btree" ("store_id", "status", "created_at");



CREATE INDEX "idx_payment_order" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_product_store" ON "public"."products" USING "btree" ("store_id");



CREATE INDEX "idx_products_store_active" ON "public"."products" USING "btree" ("store_id") WHERE "is_active";



CREATE INDEX "idx_review_order" ON "public"."reviews" USING "btree" ("order_id");



CREATE INDEX "idx_store_photo" ON "public"."store_photos" USING "btree" ("store_id");



CREATE INDEX "idx_store_photos_store" ON "public"."store_photos" USING "btree" ("store_id");



CREATE INDEX "idx_stores_lat_lng" ON "public"."stores" USING "btree" ("lat", "lng");



CREATE INDEX "idx_stores_owner" ON "public"."stores" USING "btree" ("owner_id");



CREATE INDEX "idx_voice_buyer" ON "public"."voice_recordings" USING "btree" ("buyer_id");



CREATE INDEX "idx_voice_order" ON "public"."voice_recordings" USING "btree" ("order_id");



CREATE INDEX "idx_voice_recording_buyer" ON "public"."voice_recordings" USING "btree" ("buyer_id");



CREATE INDEX "idx_voice_recording_order" ON "public"."voice_recordings" USING "btree" ("order_id");



CREATE OR REPLACE TRIGGER "trg_freeze_profile_role" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."freeze_profile_role"();



CREATE OR REPLACE TRIGGER "trg_order_transitions" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_order_transitions"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buyer_verifications"
    ADD CONSTRAINT "buyer_verifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_photos"
    ADD CONSTRAINT "store_photos_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_recordings"
    ADD CONSTRAINT "voice_recordings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_recordings"
    ADD CONSTRAINT "voice_recordings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



CREATE POLICY "Anyone can view active products" ON "public"."products" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view store photos" ON "public"."store_photos" FOR SELECT USING (true);



CREATE POLICY "Buyers create payment for own orders" ON "public"."payments" FOR INSERT WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."buyer_id" = "auth"."uid"()))));



CREATE POLICY "Buyers insert items into own orders" ON "public"."order_items" FOR INSERT WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."buyer_id" = "auth"."uid"()))));



CREATE POLICY "Buyers manage own addresses" ON "public"."addresses" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Buyers manage own recordings" ON "public"."voice_recordings" USING (("buyer_id" = "auth"."uid"())) WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "Buyers submit own verification" ON "public"."buyer_verifications" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Buyers view own verification" ON "public"."buyer_verifications" FOR SELECT USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Order parties access chat" ON "public"."chats" USING (("order_id" IN ( SELECT "public"."my_order_ids"() AS "my_order_ids"))) WITH CHECK (("order_id" IN ( SELECT "public"."my_order_ids"() AS "my_order_ids")));



CREATE POLICY "Order parties view items" ON "public"."order_items" FOR SELECT USING (("order_id" IN ( SELECT "public"."my_order_ids"() AS "my_order_ids")));



CREATE POLICY "Order parties view payment" ON "public"."payments" FOR SELECT USING (("order_id" IN ( SELECT "public"."my_order_ids"() AS "my_order_ids")));



CREATE POLICY "Participants read messages" ON "public"."messages" FOR SELECT USING (("chat_id" IN ( SELECT "chats"."id"
   FROM "public"."chats"
  WHERE ("chats"."order_id" IN ( SELECT "public"."my_order_ids"() AS "my_order_ids")))));



CREATE POLICY "Participants send messages as themselves" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND ("chat_id" IN ( SELECT "chats"."id"
   FROM "public"."chats"
  WHERE ("chats"."order_id" IN ( SELECT "public"."my_order_ids"() AS "my_order_ids"))))));



CREATE POLICY "Sellers manage own products" ON "public"."products" USING (("store_id" IN ( SELECT "public"."my_store_ids"() AS "my_store_ids"))) WITH CHECK (("store_id" IN ( SELECT "public"."my_store_ids"() AS "my_store_ids")));



CREATE POLICY "Sellers manage own store photos" ON "public"."store_photos" USING (("store_id" IN ( SELECT "public"."my_store_ids"() AS "my_store_ids"))) WITH CHECK (("store_id" IN ( SELECT "public"."my_store_ids"() AS "my_store_ids")));



CREATE POLICY "Sellers update payment status" ON "public"."payments" FOR UPDATE USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."store_id" IN ( SELECT "public"."my_store_ids"() AS "my_store_ids")))));



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buyer_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_insert_buyer" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((("buyer_id" = "auth"."uid"()) AND ("status" = 'pending'::"text")));



CREATE POLICY "orders_select_parties" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("buyer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."stores" "s"
  WHERE (("s"."id" = "orders"."store_id") AND ("s"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "orders_update_buyer_cancel" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((("buyer_id" = "auth"."uid"()) AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = ANY (ARRAY['pending'::"text", 'cancelled'::"text"])));



CREATE POLICY "orders_update_seller" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."stores" "s"
  WHERE (("s"."id" = "orders"."store_id") AND ("s"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_order_counterpart" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."stores" "s" ON (("s"."id" = "o"."store_id")))
  WHERE ((("o"."buyer_id" = "auth"."uid"()) AND ("profiles"."id" = "s"."owner_id")) OR (("s"."owner_id" = "auth"."uid"()) AND ("profiles"."id" = "o"."buyer_id"))))));



CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_insert_buyer" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "reviews"."order_id") AND ("o"."buyer_id" = "auth"."uid"()) AND ("o"."status" = 'completed'::"text")))));



CREATE POLICY "reviews_select_public" ON "public"."reviews" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."store_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stores_delete_owner" ON "public"."stores" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "stores_insert_seller" ON "public"."stores" FOR INSERT TO "authenticated" WITH CHECK ((("owner_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'seller'::"text"))))));



CREATE POLICY "stores_select_public" ON "public"."stores" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "stores_update_owner" ON "public"."stores" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."voice_recordings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."enforce_order_transitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_order_transitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_order_transitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."freeze_profile_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."freeze_profile_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."freeze_profile_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_order_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_order_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_order_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_store_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_store_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_store_ids"() TO "service_role";


















GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."buyer_verifications" TO "anon";
GRANT ALL ON TABLE "public"."buyer_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."buyer_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."chats" TO "anon";
GRANT ALL ON TABLE "public"."chats" TO "authenticated";
GRANT ALL ON TABLE "public"."chats" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."store_photos" TO "anon";
GRANT ALL ON TABLE "public"."store_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."store_photos" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."voice_recordings" TO "anon";
GRANT ALL ON TABLE "public"."voice_recordings" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_recordings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































