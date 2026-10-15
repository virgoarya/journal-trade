import { join } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [join(__dirname, 'test-setup.ts')],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});