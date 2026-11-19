#!/usr/bin/env bash
set -euo pipefail

# When TEST_DATABASE_URL is already provided (e.g. GitHub Actions), run Jest directly.
if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  exec pnpm exec jest --config ./test/jest-e2e.json --runInBand "$@"
fi

TEST_DB_USER="${TEST_DB_USER:-postgres}"
TEST_DB_PASSWORD="${TEST_DB_PASSWORD:-orders_test}"
TEST_DB_NAME="${TEST_DB_NAME:-orders_test}"
TEST_DB_PORT="${TEST_DB_PORT:-5433}"
EPHEMERAL_TEST_URL="postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@localhost:${TEST_DB_PORT}/${TEST_DB_NAME}"

cleanup() {
  echo "Stopping and removing ephemeral test database (db_test)..."
  docker compose --profile test rm -sfv db_test >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting ephemeral test database (db_test) on port ${TEST_DB_PORT}..."
docker compose --profile test up -d --wait db_test

echo "Applying Prisma migrations to test database..."
DATABASE_URL="${EPHEMERAL_TEST_URL}" pnpm exec prisma migrate deploy

echo "Running E2E tests..."
TEST_DATABASE_URL="${EPHEMERAL_TEST_URL}" \
DATABASE_URL="${EPHEMERAL_TEST_URL}" \
JWT_SECRET="${JWT_SECRET:-integration-only-secret-at-least-32-characters}" \
  pnpm exec jest --config ./test/jest-e2e.json --runInBand "$@"
