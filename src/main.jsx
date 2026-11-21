import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * 便携版固定用 23871 端口；万一被别的程序占了，服务会退到随机端口。
 * 那种情况下把端口写进窗口标题，用户窗口关不掉的旧实例 / 找不到地址时一眼能看出来。
 */
const HOSTED = window.location.protocol.startsWith('http') && window.location.port !== ''
if (HOSTED && window.location.port !== '23871') {
  document.title = `小说构建器 · 端口 ${window.location.port}`
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
