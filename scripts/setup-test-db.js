#!/usr/bin/env node
/**
 * Roda todas as migrations num DB de teste (docker-compose.test.yml).
 * Usa TEST_DATABASE_URL ou default postgres://test:test@localhost:5433/agenda_facil_test.
 */
const { testHelpers } = require('../packages/db');

testHelpers
  .setupTestDb()
  .then(() => {
    console.log('✓ Test DB ready at', testHelpers.testDatabaseUrl());
  })
  .catch((err) => {
    console.error('✗ setupTestDb failed:', err.message);
    process.exit(1);
  });
