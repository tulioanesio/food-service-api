ALTER TABLE "Order" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "orderId" TEXT;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StockMovement_orderId_productId_type_key" ON "StockMovement"("orderId", "productId", "type");
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MANUAL', ADD COLUMN "receivedAmount" DECIMAL(10,2), ADD COLUMN "change" DECIMAL(10,2), ADD COLUMN "refundId" TEXT, ADD COLUMN "reversalReason" TEXT;
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
CREATE UNIQUE INDEX "Payment_refundId_key" ON "Payment"("refundId");
CREATE UNIQUE INDEX "Payment_orderId_idempotencyKey_key" ON "Payment"("orderId", "idempotencyKey");
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';
