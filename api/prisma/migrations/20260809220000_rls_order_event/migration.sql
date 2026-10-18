-- RLS для OrderEvent (как Payment / Shipment — через Order.userId)

ALTER TABLE "OrderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY order_event_all ON "OrderEvent"
  FOR ALL
  USING (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "OrderEvent"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  )
  WITH CHECK (
    jcos_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "Order" o
      WHERE o.id = "OrderEvent"."orderId"
        AND o."userId" IS NOT NULL
        AND o."userId" = jcos_rls_user_id()
    )
  );
