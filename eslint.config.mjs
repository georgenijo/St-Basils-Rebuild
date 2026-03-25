import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  {
    ignores: ['assets/**', 'forms/**', 'documentation/**', 'PSD/**', '.next/**', 'next-env.d.ts'],
  },
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'plugin:jsx-a11y/recommended',
    'prettier'
  ),
]

export default eslintConfig
