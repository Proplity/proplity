import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// The lint gate catches real bugs (hooks used wrongly, undefined names,
// unreachable code). Style is Prettier's job, and a few rules that the existing
// code base trips by the hundreds are warnings until they are cleaned up.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', '.next-test/**', 'out/**', 'node_modules/**', 'prisma/migrations/**']),
  {
    rules: {
      // Style and React-compiler heuristics the code base trips by the dozen;
      // warnings until they are cleaned up. Real bugs stay errors (for example
      // react-hooks/rules-of-hooks, which caught hooks called inside a map).
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
