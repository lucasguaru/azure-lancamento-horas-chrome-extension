# Chrome ADO Hours Extension

Extensao Chrome MV3 para organizar e carregar as automacoes de horas no Azure DevOps.

## O que esta migrado

- `ado-weekly-hours-overlay.js`
- `ado-monthly-hierarchy-report.js`
- `ado-create-task-enhancer.js`
- `ado-autoparent-create.js`

As features foram separadas por modulo e carregadas por roteamento de pagina em ambiente SPA do Azure DevOps.

## Estrutura

- `src/content/`: entrada do content script e router
- `src/features/`: features por dominio
- `src/core/`: utilitarios compartilhados (ADO, DOM, tempo, storage, texto)
- `public/manifest.json`: manifesto MV3

## Desenvolvimento

```bash
cd extensions/chrome-ado-hours
npm install
npm run build
```

## Publicar na Chrome Web Store (assets)

- **Icon master (SVG)**: `store-assets/icon.svg`
- **Exportar ícones PNG (manifest)**: gere `16/32/48/128` **sem alpha** (24-bit) e inclua no zip final com `manifest.json` na raiz.
- **Screenshots (Web Store)**:
  - **máx. 5**
  - **1280×800** ou **640×400**
  - **JPEG ou PNG 24-bit (sem alfa)**

## Carregar no Chrome

1. Abra `chrome://extensions`
2. Ative `Developer mode`
3. Clique em `Load unpacked`
4. Selecione `extensions/chrome-ado-hours/dist`

## Observacoes

- O build copia automaticamente `public/manifest.json` para `dist/`.
- O content script roda em `https://dev.azure.com/*`.
