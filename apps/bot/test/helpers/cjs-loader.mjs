import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cria um require ancorado no diretório do bot (apps/bot/src/),
 * pra que os testes peguem o MESMO cache CJS que os módulos internos
 * (`const x = require('../../foo')`) e possam mutar `module.exports`
 * diretamente (mock sem vi.mock).
 *
 * Uso:
 *   import { srcRequire } from '../helpers/cjs-loader.mjs';
 *   const gcal = srcRequire('ai/tools/check-availability').require('../../integrations/calendar');
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_ROOT = path.resolve(__dirname, '../..');
const SRC_ROOT = path.join(BOT_ROOT, 'src');

export function requireFromSrc(relativePathInsideSrc) {
  const caller = path.join(SRC_ROOT, relativePathInsideSrc);
  return createRequire(caller);
}

export { BOT_ROOT, SRC_ROOT };
