import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * Harness 挂载入口：
 * 把整个 UI 渲染进一个 Shadow DOM，样式与 Harness 完全隔离。
 */
window.__NOVEL_UI_MOUNT__ = (container) => {
  const shadow = container.shadowRoot || container.attachShadow({ mode: 'open' })
  shadow.innerHTML = ''

  const style = document.createElement('style')
  style.textContent = window.__NOVEL_UI_CSS__ || ''
  shadow.appendChild(style)

  const host = document.createElement('div')
  host.className = 'novel-ui-host'
  shadow.appendChild(host)

  const root = createRoot(host)
  root.render(<App />)

  return () => {
    root.unmount()
    shadow.innerHTML = ''
  }
}
