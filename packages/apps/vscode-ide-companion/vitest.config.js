/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: true,
  },
});
