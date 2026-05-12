# Arquitetura do código

Este documento mapeia **funcionalidades**, **pastas** e **fluxo de build** para quem for alterar a extensão ou usar ferramentas (incluindo IA) com contexto do repositório.

## Visão geral

- A extensão é **Manifest V3**, com um único **content script** (`content.js`) injetado em `https://dev.azure.com/*`, em **`world: "MAIN"`** (mesmo contexto da página do ADO), conforme `public/manifest.json`.
- O **ponto de entrada TypeScript** é `src/content/content-main.ts`. Ele evita boot duplo com uma flag global e chama o roteador de features.
- O **roteador** (`src/content/router.ts`) avalia regras por URL (pathname) e monta cada feature **no máximo uma vez** por carregamento da página; em navegação SPA do ADO, reavalia via listener em `src/core/dom/spa.ts`.
- Cada feature em `src/features/<nome>/index.ts` é um **carregador fino**: importa o módulo legado correspondente em `scripts/*.js`, que concentra a UI e a lógica da funcionalidade. O bundler (Vite/Rollup) tende a emitir esses scripts como **chunks** separados em `dist/chunks/`.

## Mapa: feature → pastas / arquivos

| Feature (produto) | Rota / quando monta | Loader (TypeScript) | Implementação (bundle) |
|-------------------|---------------------|----------------------|-------------------------|
| Overlay semanal de horas (F2, botão) | Sempre em `dev.azure.com` | `src/features/weekly-overlay/index.ts` | `scripts/ado-weekly-hours-overlay.js` |
| Relatório mensal por hierarquia (F3, botão) | Sempre | `src/features/monthly-hierarchy/index.ts` | `scripts/ado-monthly-hierarchy-report.js` |
| Create Task Enhancer | Path contém `/_workitems/create/task` ou `/_workitems/edit/<id>` | `src/features/create-task-enhancer/index.ts` | `scripts/ado-create-task-enhancer.js` |
| Autoparent na criação de work item | Path contém `/_workitems/create/` | `src/features/autoparent-create/index.ts` | `scripts/ado-autoparent-create.js` |

A ordem das regras e a condição exata de cada uma estão em `src/content/router.ts`.

## Estrutura de pastas (raiz)

| Pasta / arquivo | Função |
|-----------------|--------|
| `src/content/` | Entrada (`content-main.ts`) e roteamento (`router.ts`). |
| `src/features/` | Um subdiretório por feature; cada `index.ts` apenas importa o script legado e exporta `mount*`. |
| `src/core/` | Utilitários TypeScript compartilháveis. Hoje o roteador usa `dom/spa.ts` para mudanças de URL no SPA do ADO; existem também módulos em `ado/`, `time/`, `text/`, `storage/`, `dom/wait.ts` (podem ser reutilizados ou preparados para migração gradual do JS). |
| `src/types/` | Declarações TypeScript (ex.: `legacy-scripts.d.ts` para importar `*.js` a partir de TS). |
| `scripts/` | Implementações principais em JavaScript (legado), uma por feature + scripts de build auxiliares (`*.mjs`). |
| `public/` | `manifest.json` copiado para `dist/`, ícones, feriados BR (`holidays/br-national-2026-2030.json`). |
| `dist/` | Saída do `npm run build` (não versionar como fonte; carregar esta pasta no Chrome em modo desenvolvedor). |
| `docs/` | Documentação voltada ao **site** (ex.: GitHub Pages): `index.md`, imagens, etc. |
| `store-assets/` | Materiais da loja (screenshots, política de privacidade, etc.). |
| `vite.config.ts` | Build em modo library: entrada `src/content/content-main.ts`, saída `dist/content.js`, chunks nomeados em `dist/chunks/`. Injeta `__BUILD_VERSION__` e embute `__BR_NATIONAL_HOLIDAYS_2026_2030__` no bundle. |
| `package.json` | Scripts: `build`, `dev` (watch), `zip`, `typecheck`; `prebuild` / `predev` sincronizam versão do manifest. |

## Build e versão

- **`npm run build`**: `prebuild` roda `scripts/sync-manifest-version.mjs` (alinhado com `scripts/build-version.mjs` / `.build-version.json`); em seguida o Vite gera `dist/`.
- **`npm run zip`**: build + `scripts/zip-dist.mjs` para ZIP com artefatos na raiz, pronto para distribuição.
- O **manifest** em tempo de desenvolvimento fica em `public/manifest.json`; a versão exibida no Chrome pode incluir `version_name` atualizado pelo sync de versão.

## Onde mexer para cada tipo de mudança

- **Comportamento ou UI de uma feature existente**: em geral `scripts/ado-*.js` correspondente; conferir o loader em `src/features/<feature>/index.ts` e a regra em `router.ts`.
- **Nova feature**: criar loader em `src/features/<nova>/`, script em `scripts/` (ou módulos TS se migrarem), registrar regra em `src/content/router.ts`.
- **Detecção de navegação SPA / remount**: `src/core/dom/spa.ts` e `router.ts`.
- **Permissões / matches de URL / nome da extensão**: `public/manifest.json` (e rebuild).

## Documentação de usuário

Instalação, atalhos e descrição funcional continuam no [README.md](./README.md) e, para publicação web, em `docs/index.md`.
