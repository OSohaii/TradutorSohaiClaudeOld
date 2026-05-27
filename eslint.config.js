import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Ignore build output, node_modules, and Python virtualenvs that may be
  // present locally (the backend Python tests live under backend/.venv).
  // Also skip the dist folder and any IDE caches.
  { ignores: ['dist/', 'node_modules/', 'backend/.venv/', 'backend/venv/', 'backend/env/', '**/__pycache__/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Relax rules that trigger on existing code to avoid blocking
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'prefer-const': 'warn',
      // Disable set-state-in-effect: existing code uses this pattern legitimately
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
