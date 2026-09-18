import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/ilta/',
  plugins: [react()],
  test: {
    // 단위 테스트만 vitest 가 맡는다. tests/e2e 의 *.spec.ts 는
    // playwright 전용이라 vitest 가 수집하면 수집 단계에서 깨진다.
    include: ['tests/**/*.test.ts'],
  },
})
