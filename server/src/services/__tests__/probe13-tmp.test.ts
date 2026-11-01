import { describe, it, expect } from 'vitest';
import { silentLogger } from '../../utils/silent-logger';
import { logger } from '../../utils/logger';
describe('probe13', () => {
  it('silentLogger.info throws?', () => {
    let err: any = null;
    try { silentLogger.info('hello'); } catch (e) { err = e; }
    console.log('SILENT_ERR', err ? String(err.message) : 'none');
    let err2: any = null;
    try { logger.info('hello2'); } catch (e) { err2 = e; }
    console.log('LOGGER_ERR', err2 ? String(err2.message) : 'none');
    expect(1).toBe(1);
  });
});
