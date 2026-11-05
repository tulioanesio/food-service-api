ALTER TABLE "Stock" ADD COLUMN "minimumQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "StockMovement_productId_idempotencyKey_key" ON "StockMovement"("productId", "idempotencyKey");
-- Existing products also start with zero stock unless a stock row already exists.
INSERT INTO "Stock" ("id", "productId", "totalQuantity", "inputQuantity", "outputQuantity", "updatedAt")
SELECT gen_random_uuid()::text, "id", 0, 0, 0, CURRENT_TIMESTAMP FROM "Product"
ON CONFLICT ("productId") DO NOTHING;
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_nonnegative_quantities" CHECK ("totalQuantity" >= 0 AND "minimumQuantity" >= 0 AND "inputQuantity" >= 0 AND "outputQuantity" >= 0);
