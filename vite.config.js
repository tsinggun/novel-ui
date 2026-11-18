import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 本地开发用 `/`；发布到 GitHub Pages（https://tsinggun.github.io/novel-ui/）用 `/novel-ui/`。
 * 构建时加 `--mode pages` 即可，见 package.json 的 build:pages。
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/novel-ui/' : '/',
  plugins: [react()],
}))
