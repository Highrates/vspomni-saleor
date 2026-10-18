-- Row Level Security: покупатель видит только свои строки.
-- Nest задаёт GUCs на запрос: app.user_id, app.rls_bypass (см. RlsInterceptor).
-- FORCE — политики действуют и для владельца таблицы (Prisma DATABASE_URL).

-- Soft-deleted staff: role → USER (случайный сброс staffDeletedAt не вернёт ACL)
UPDATE "User"
SET role = 'USER'
WHERE "staffDeletedAt" IS NOT NULL
  AND role IN ('MODERATOR', 'ADMIN');

CREATE OR REPLACE FUNCTION jcos_rls_bypass() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(nullif(current_setting('app.rls_bypass', true), ''), 'off')) IN ('on', 'true', '1');
$$;

CREATE OR REPLACE FUNCTION jcos_rls_user_id() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.user_id', true), '');
$$;

-- ─── User ───────────────────────────────────────────────────────────
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_select ON "User"
  FOR SELECT
  USING (jcos_rls_bypass() OR id = jcos_rls_user_id());

CREATE POLICY user_insert ON "User"
  FOR INSERT
  WITH CHECK (jcos_rls_bypass() OR id = jcos_rls_user_id());

CREATE POLICY user_update ON "User"
  FOR UPDATE
  USING (jcos_rls_bypass() OR id = jcos_rls_user_id())
  WITH CHECK (jcos_rls_bypass() OR id = jcos_rls_user_id());

CREATE POLICY user_delete ON "User"
  FOR DELETE
  USING (jcos_rls_bypass());

-- ─── UserAddress ────────────────────────────────────────────────────
ALTER TABLE "UserAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAddress" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_address_all ON "UserAddress"
  FOR ALL
  USING (jcos_rls_bypass() OR "userId" = jcos_rls_user_id())
  WITH CHECK (jcos_rls_bypass() OR "userId" = jcos_rls_user_id());

-- ─── Order ──────────────────────────────────────────────────────────
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;

CREATE POLICY order_all ON "Order"
  FOR ALL
  USING (
    jcos_rls_bypass()
    OR ("userId" IS NOT NULL AND "userId" = jcos_rls_user_id())
  )
  WITH CHECK (
    jcos_rls_bypass()
    OR ("userId" IS NOT NULL AND "userId" = jcos_rls_user_id())
  );

-- ─── OrderItem ──────────────────────────────────────────────────────
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" FORCE ROW LEVEL SECURITY;

CREATE POLICY order_item_all ON "OrderItem"
  FOR ALL
  USING (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "OrderItem"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  )
  WITH CHECK (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "OrderItem"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  );

-- ─── Payment ────────────────────────────────────────────────────────
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_all ON "Payment"
  FOR ALL
  USING (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "Payment"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  )
  WITH CHECK (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "Payment"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  );

-- ─── Shipment ───────────────────────────────────────────────────────
ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipment" FORCE ROW LEVEL SECURITY;

CREATE POLICY shipment_all ON "Shipment"
  FOR ALL
  USING (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "Shipment"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  )
  WITH CHECK (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "Shipment"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  );

-- ─── PromoCodeRedemption ────────────────────────────────────────────
ALTER TABLE "PromoCodeRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoCodeRedemption" FORCE ROW LEVEL SECURITY;

CREATE POLICY promo_redemption_all ON "PromoCodeRedemption"
  FOR ALL
  USING (
    jcos_rls_bypass()
    OR ("userId" IS NOT NULL AND "userId" = jcos_rls_user_id())
  )
  WITH CHECK (
    jcos_rls_bypass()
    OR ("userId" IS NOT NULL AND "userId" = jcos_rls_user_id())
  );
