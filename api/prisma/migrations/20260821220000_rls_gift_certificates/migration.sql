-- RLS для GiftCertificate / GiftCertificateLedger (как Order — через владельца).
-- Писатели checkout (CAPTURE/RELEASE/validate-by-code) временно поднимают
-- app.rls_bypass в tx (withLocalRlsBypass в gift-certificate-hold.util.ts).
-- Denomination без RLS (публичный каталог номиналов).

ALTER TABLE "GiftCertificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GiftCertificate" FORCE ROW LEVEL SECURITY;

CREATE POLICY gift_certificate_select ON "GiftCertificate"
  FOR SELECT
  USING (
    jcos_rls_bypass()
    OR ("recipientUserId" IS NOT NULL AND "recipientUserId" = jcos_rls_user_id())
    OR (
      "recipientEmail" IS NOT NULL
      AND lower("recipientEmail") = (
        SELECT lower(u.email) FROM "User" u WHERE u.id = jcos_rls_user_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "GiftCertificate"."purchaseOrderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  );

CREATE POLICY gift_certificate_insert ON "GiftCertificate"
  FOR INSERT
  WITH CHECK (jcos_rls_bypass());

CREATE POLICY gift_certificate_update ON "GiftCertificate"
  FOR UPDATE
  USING (jcos_rls_bypass())
  WITH CHECK (jcos_rls_bypass());

CREATE POLICY gift_certificate_delete ON "GiftCertificate"
  FOR DELETE
  USING (jcos_rls_bypass());

ALTER TABLE "GiftCertificateLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GiftCertificateLedger" FORCE ROW LEVEL SECURITY;

CREATE POLICY gift_certificate_ledger_select ON "GiftCertificateLedger"
  FOR SELECT
  USING (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "GiftCertificate" gc
      WHERE gc.id = "GiftCertificateLedger"."certificateId"
        AND (
          (gc."recipientUserId" IS NOT NULL AND gc."recipientUserId" = jcos_rls_user_id())
          OR (
            gc."recipientEmail" IS NOT NULL
            AND lower(gc."recipientEmail") = (
              SELECT lower(u.email) FROM "User" u WHERE u.id = jcos_rls_user_id()
            )
          )
          OR EXISTS (
            SELECT 1 FROM "Order" o
            WHERE o.id = gc."purchaseOrderId"
              AND o."userId" IS NOT NULL
              AND o."userId" = jcos_rls_user_id()
          )
        )
    )
  );

CREATE POLICY gift_certificate_ledger_insert ON "GiftCertificateLedger"
  FOR INSERT
  WITH CHECK (jcos_rls_bypass());

CREATE POLICY gift_certificate_ledger_update ON "GiftCertificateLedger"
  FOR UPDATE
  USING (jcos_rls_bypass())
  WITH CHECK (jcos_rls_bypass());

CREATE POLICY gift_certificate_ledger_delete ON "GiftCertificateLedger"
  FOR DELETE
  USING (jcos_rls_bypass());
