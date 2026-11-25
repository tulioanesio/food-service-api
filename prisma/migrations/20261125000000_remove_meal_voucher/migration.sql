-- Remove MEAL_VOUCHER from PaymentMethod enum
DELETE FROM "Payment" WHERE "method" = 'MEAL_VOUCHER';
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD');
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod" USING ("method"::text::"PaymentMethod");
DROP TYPE "PaymentMethod_old";
