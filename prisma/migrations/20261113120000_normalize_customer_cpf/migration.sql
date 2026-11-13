-- Atomic and exclusive: do not race legacy writes or partially normalize data.
BEGIN;
LOCK TABLE "Customer" IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE
  customer RECORD;
  canonical TEXT;
  prefix_length INTEGER;
  digit_index INTEGER;
  weighted_sum INTEGER;
  check_digit INTEGER;
BEGIN
  FOR customer IN SELECT id, cpf FROM "Customer" WHERE cpf IS NOT NULL LOOP
    canonical := regexp_replace(customer.cpf, '[.[:space:]-]', '', 'g');
    IF canonical !~ '^[0-9]{11}$' OR canonical ~ '^([0-9])\1{10}$' THEN
      RAISE EXCEPTION 'Customer % has an invalid legacy CPF; correct it before retrying migration', customer.id;
    END IF;
    FOR prefix_length IN 9..10 LOOP
      weighted_sum := 0;
      FOR digit_index IN 1..prefix_length LOOP
        weighted_sum := weighted_sum + substring(canonical, digit_index, 1)::INTEGER * (prefix_length + 2 - digit_index);
      END LOOP;
      check_digit := (weighted_sum * 10) % 11;
      IF check_digit = 10 THEN check_digit := 0; END IF;
      IF check_digit <> substring(canonical, prefix_length + 1, 1)::INTEGER THEN
        RAISE EXCEPTION 'Customer % has an invalid legacy CPF checksum; correct it before retrying migration', customer.id;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM "Customer" WHERE cpf IS NOT NULL
    GROUP BY regexp_replace(cpf, '[.[:space:]-]', '', 'g') HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Legacy CPF normalization collision: reconcile customer records before retrying migration';
  END IF;
END $$;
UPDATE "Customer" SET cpf = regexp_replace(cpf, '[.[:space:]-]', '', 'g') WHERE cpf IS NOT NULL;
COMMIT;
