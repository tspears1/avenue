const SCRIPT_MARKER = 'data-avenue-editor-content-loader'
const LISTENER_MARKER = 'data-avenue-editor-content-loader-listener'

/**
 * Boot editor UI bridge logic.
 *
 * - In the top admin window, inject editor-content into the editor iframe.
 * - In an iframe realm, run editor-content directly.
 */
function bootEditorUi() {
   if (window.top !== window) {
      injectEditorContentIntoDocument(document, import.meta.url)
      return
   }

   bridgeContentIntoEditorIframe()
}

function injectEditorContentIntoDocument(doc: Document, sourceHref: string) {
   if (!doc.head) {
      return false
   }

   const sourceUrl = resolveEditorContentUrl(sourceHref)
   const components = new URL(sourceHref).searchParams.get('components')

   if (components) {
      sourceUrl.searchParams.set('components', components)
   }

   const existing = doc.head.querySelector(`script[${SCRIPT_MARKER}]`)
   if (existing) {
      return true
   }

   const script = doc.createElement('script')
   script.type = 'module'
   script.src = sourceUrl.toString()
   script.setAttribute(SCRIPT_MARKER, 'true')
   doc.head.appendChild(script)

   return true
}

function resolveEditorContentUrl(sourceHref: string): URL {
   const sourceUrl = new URL(sourceHref)
   sourceUrl.pathname = sourceUrl.pathname.replace(/editor-ui\.js$/, 'editor-content.js')
   sourceUrl.search = ''

   return sourceUrl
}

function bridgeContentIntoEditorIframe() {
   const inject = (iframe: HTMLIFrameElement): boolean => {
      const doc = iframe.contentDocument
      if (!doc) {
         return false
      }

      const iframeLocation = iframe.contentWindow?.location.href
      if (!iframeLocation || iframeLocation === 'about:blank') {
         return false
      }

      return injectEditorContentIntoDocument(doc, import.meta.url)
   }

   const bindLoadListener = (iframe: HTMLIFrameElement) => {
      if (iframe.getAttribute(LISTENER_MARKER) === 'true') {
         return
      }

      iframe.setAttribute(LISTENER_MARKER, 'true')
      iframe.addEventListener('load', () => {
         inject(iframe)
      })
   }

   const findIframe = () =>
      document.querySelector('iframe[name="editor-canvas"]') as HTMLIFrameElement | null

   const current = findIframe()
   if (current) {
      bindLoadListener(current)
   }

   if (current && inject(current)) {
      return
   }

   const observer = new MutationObserver(() => {
      const iframe = findIframe()
      if (!iframe) {
         return
      }

      bindLoadListener(iframe)

      if (inject(iframe)) {
         observer.disconnect()
      }
   })

   observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
   })
}

void bootEditorUi()
