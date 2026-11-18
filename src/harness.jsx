import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * Harness 挂载入口：
 * 把整个 UI 渲染进一个 Shadow DOM，样式与 Harness 完全隔离。
 * 顺带在右下角放一个落盘状态条：数据存的是本地文件，得让人看得见。
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

  /* ---- 落盘状态条 ---- */
  const bar = document.createElement('div')
  bar.className = 'novel-ui-persist'
  bar.style.cssText = [
    'position:fixed',
    'right:14px',
    'bottom:12px',
    'z-index:20',
    'max-width:70%',
    'padding:4px 10px',
    'border:1px solid #3a3a3a',
    'background:rgba(15,15,15,.92)',
    'color:#8f8f8f',
    'font-size:11px',
    'line-height:1.6',
    'letter-spacing:.04em',
    'pointer-events:none',
    'transition:opacity .3s ease',
    'opacity:0',
  ].join(';')
  shadow.appendChild(bar)

  let hideTimer = null
  const say = (text, keep) => {
    bar.textContent = text
    bar.style.opacity = '1'
    if (hideTimer) clearTimeout(hideTimer)
    if (!keep) hideTimer = setTimeout(() => (bar.style.opacity = '0'), 2600)
  }

  const onPersist = (event) => {
    const d = event.detail || {}
    if (d.state === 'saving') say('保存中…', true)
    else if (d.state === 'saved') say('已保存到本地 · ' + (d.path || ''))
    else if (d.state === 'loaded') say('已从本地读取 · ' + (d.path || ''))
    else if (d.state === 'error') say('写入失败：' + (d.message || ''), true)
  }
  window.addEventListener('novel-ui:persist', onPersist)

  const root = createRoot(host)
  root.render(<App />)

  return () => {
    window.removeEventListener('novel-ui:persist', onPersist)
    if (hideTimer) clearTimeout(hideTimer)
    root.unmount()
    shadow.innerHTML = ''
  }
}
