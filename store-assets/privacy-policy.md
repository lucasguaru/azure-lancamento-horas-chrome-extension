# Politica de Privacidade - Azure DevOps Timesheet

Ultima atualizacao: 2026-04-01

## 1. Sobre a extensao

A extensao **Azure DevOps Timesheet** foi criada para automatizar e facilitar fluxos de lancamento de horas no Azure DevOps (`dev.azure.com`).

## 2. Dados acessados

A extensao acessa apenas o conteudo das paginas do Azure DevOps para executar suas funcionalidades, incluindo:

- dados visiveis de Work Items na tela;
- respostas das APIs do Azure DevOps usadas para exibicao/atualizacao de informacoes no proprio fluxo do usuario.

## 3. Coleta e armazenamento

- A extensao **nao vende** dados de usuario.
- A extensao **nao compartilha** dados com terceiros.
- A extensao utiliza armazenamento local do navegador (`storage` e `localStorage`) apenas para preferencias e estado de interface.

## 4. Transmissao de dados

As requisicoes sao feitas apenas para:

- `https://dev.azure.com/*`

Nao ha envio de dados para servidores externos da extensao.

## 5. Seguranca

As operacoes ocorrem no contexto da sessao autenticada do proprio usuario no Azure DevOps.

## 6. Direitos e contato

Em caso de duvidas sobre esta politica, entre em contato pelo canal de suporte informado na pagina da extensao na Chrome Web Store.
