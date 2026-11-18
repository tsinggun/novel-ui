import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 把 UI 打成单文件 client.js，供 DeepSeek Harness 的客户端插件加载器使用：
 *   1. IIFE 里包含 React + 整个 UI，暴露 window.__NOVEL_UI_MOUNT__
 *   2. CSS 全部内联成 window.__NOVEL_UI_CSS__（渲染进 Shadow DOM）
 *   3. 末尾追加 __ModuleLoader__ 注册代码，挂到主面板 + 侧栏图标
 */

/** 把 CSS 改造成 Shadow DOM 可用的版本（输入是压缩后的单行 CSS） */
function isolateCss(css) {
  const out = css
    .replace(/:root\s*\{/g, ':host, :root {')
    .replace(/(^|[}\s])body\s*\{/g, '$1.novel-ui-host {')
    .replace(/\.preview\{([^}]*?)position:fixed/g, '.preview{$1position:absolute')

  return (
    out +
    `
:host {
  display: block;
  height: 100%;
  min-height: 0;
}
.novel-ui-host {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}
`
  )
}

function inlineCssAndRegister() {
  return {
    name: 'harness-inline-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let css = ''
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'asset' && name.endsWith('.css')) {
          css += String(file.source)
          delete bundle[name]
        }
      }
      const safe = JSON.stringify(isolateCss(css))
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        file.code =
          `window.__NOVEL_UI_CSS__ = ${safe};\n` +
          file.code +
          `
;(function () {
  if (!window.__ModuleLoader__) return;
  window.__ModuleLoader__.load({
    id: '@local/plot-builder',
    factory(require) {
      const React = require('react');
      const h = React.createElement;
      function Panel() {
        const ref = React.useRef(null);
        React.useEffect(() => {
          const el = ref.current;
          if (!el || !window.__NOVEL_UI_MOUNT__) return undefined;
          const dispose = window.__NOVEL_UI_MOUNT__(el);
          return () => { if (typeof dispose === 'function') dispose(); };
        }, []);
        return h('div', { ref, style: { height: '100%', minHeight: 0 } });
      }
      function Icon(props) {
        const size = (props && props.size) || 20;
        const active = Boolean(props && props.active);
        const c = active ? '#ffffff' : 'currentColor';
        return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
          h('rect', { x: 3.5, y: 3.5, width: 7, height: 7, rx: 1.5, stroke: c, strokeWidth: 1.6 }),
          h('rect', { x: 13.5, y: 3.5, width: 7, height: 7, rx: 1.5, stroke: c, strokeWidth: 1.6 }),
          h('rect', { x: 3.5, y: 13.5, width: 7, height: 7, rx: 1.5, stroke: c, strokeWidth: 1.6 }),
          h('rect', { x: 13.5, y: 13.5, width: 7, height: 7, rx: 1.5, stroke: c, strokeWidth: 1.6 })
        );
      }
      return {
        inject: ['slots'],
        apply(ctx) {
          ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'plot-builder' }, Panel));
          ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
            { name: 'sidebar.panellist', id: 'plot-builder', order: 24, label: () => '情节构造器' },
            Icon
          ));
        },
      };
    },
  });
})();
`
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), inlineCssAndRegister()],
  /* 浏览器里没有 process，React 的生产判断必须静态替换掉 */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'harness-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024,
    lib: {
      entry: 'src/harness.jsx',
      formats: ['iife'],
      name: 'NovelUI',
      fileName: () => 'client.js',
    },
  },
})
