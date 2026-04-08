# Validacao da migracao

## Validacoes executadas

- Build da extensao: `npm run build` (ok)
- Geracao de artefatos em `dist/` (ok)
- Presenca de `dist/manifest.json` com `content.js` (ok)
- Bundle com os 4 scripts migrados em chunks separados (ok)

## Checklist funcional manual no Azure DevOps

1. Carregar `extensions/chrome-ado-hours/dist` em `chrome://extensions`.
2. Abrir `https://dev.azure.com/<org>/<project>`.
3. Verificar overlay semanal (atalho `F2` e botao).
4. Verificar relatorio mensal (atalho `F3` e botao).
5. Abrir create task e validar enhancer de criacao.
6. Criar task com `lh_parent` na URL e validar autoparent.

## Resultado atual

- Infraestrutura da extensao e empacotamento: validado.
- Fluxos em ambiente real Azure DevOps: pendentes de validacao manual.
