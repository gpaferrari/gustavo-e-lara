# Documentação do Sistema de Convite e RSVP — Gustavo & Lara 💍

Este documento detalha as funcionalidades e a arquitetura do sistema personalizado desenvolvido para o casamento de Gustavo e Lara.

---

## 🚀 Visão Geral
O projeto é uma aplicação web mobile-first construída com HTML/CSS/JS vanilla, integrada a uma API Serverless (Node.js) que persiste os dados em `data/families.json` **no próprio repositório do GitHub** (via API de Contents) para gerenciar convites e confirmações de presença de forma personalizada por família.

> **Histórico**: o sistema usava Redis (Vercel Marketplace) até 07/2026, mas o banco free-tier foi apagado por inatividade. Migramos para armazenamento em JSON no GitHub — imune a exclusão por inatividade e com backup automático via histórico de commits.

---

## 🛠️ Funcionalidades Implementadas

### 1. Website do Convite (`index.html`)
- **Design Personalizado**: Tema baseado em bioinformática (hélice de DNA) e fé (Eclesiastes 4:12).
- **Seções**: Hero, Nossa História, Detalhes do Evento, Lista de Presentes e RSVP.
- **Lista de Presentes**: Links integrados para Magalu e Havan.
- **Compartilhamento**: Botão dinâmico que abre o menu nativo do celular ou copia o link no desktop.

### 2. Painel Administrativo (`admin.html`)
Área restrita para os noivos gerenciarem a lista de convidados.
- **Acesso Seguro**: Login protegido. A credencial fica na variável de ambiente `ADMIN_AUTH` na Vercel — **nunca escrever a senha neste arquivo** (o repositório é público).
- **Dashboard de Estatísticas**:
    - **Total de Convidados**: Soma geral de todas as pessoas cadastradas.
    - **Pagantes**: Convidados que entram no cálculo do buffet.
    - **Crianças (-5 anos)**: Convidados marcados como não pagantes.
    - **Confirmados**: Total de pessoas que já marcaram "Vou" no RSVP.
- **Gestão de Convites (Cards)**:
    - **Criação**: Permite criar convites por família. Suporta o sufixo `:c` (ex: `Enzo:c`) para marcar crianças rapidamente.
    - **Edição**: Alterar nome da família, adicionar/remover membros ou alternar status de criança.
    - **Exclusão**: Remover um convite inteiro do sistema.
    - **QR Code**: Gera e permite baixar o QR Code exclusivo para cada família imprimir ou enviar.
    - **Status Visual**: Círculo amarelo (○) para convites pendentes e Check verde (✓) para famílias que já responderam totalmente.

### 3. Sistema de RSVP Personalizado (`rsvp.html`)
Página que o convidado acessa via QR Code ou Link único.
- **Reconhecimento de Família**: O sistema identifica a família pelo ID na URL (`?id=xyz`) e exibe apenas os nomes daquela família.
- **Confirmação Individual**: Cada membro da família pode marcar seu status: **Vou**, **Não vou** ou **Pendente**.
- **Sincronização em Tempo Real**: Assim que o convidado clica em "Confirmar", os dados são atualizados no Banco de Dados e refletem no Painel Admin.

---

## 🏗️ Arquitetura Técnica

- **Frontend**: HTML5, CSS3 (Variáveis, Flexbox, Grid), JavaScript (Vanilla, Intersection Observer API, Web Share API).
- **Backend**: Vercel Serverless Functions (Node.js), sem dependências externas (usa `fetch` nativo).
- **Banco de Dados**: `data/families.json` no repositório GitHub, acessado pela API de Contents. Leitura-modificação-escrita com retry para concorrência (ver `api/_store.js`).
- **Bibliotecas Externas**: `qrcode.js` (geração de QR Codes no admin).

---

## ⚙️ Variáveis de Ambiente Necessárias
Configurar na Vercel (Production + Preview):
- `GITHUB_TOKEN`: Personal Access Token (fine-grained) com permissão **Contents: Read and write** apenas no repo `gustavo-e-lara`.
- `GITHUB_REPO`: `gpaferrari/gustavo-e-lara`.
- `GITHUB_BRANCH`: `master` (opcional; padrão `master`).
- `DATA_FILE`: `data/families.json` (opcional; padrão).

---

## 📝 Instruções de Manutenção

> 📗 **Para o dia a dia** (criar convite, corrigir QR já entregue, apagar, testar), use o [GUIA-CONVITES.md](GUIA-CONVITES.md) — passo a passo com os comandos prontos. Esta seção cobre o essencial.

1. **Adicionar Novos Convidados**: Acesse `/admin.html`, faça login e use o formulário "Novo Convite".
2. **Gerar Convites Físicos**: No painel admin, use o botão "QR" em cada card, baixe a imagem e anexe ao convite impresso.
3. **Deploy de Mudanças**: Sempre que houver alteração no código ou dependências (`package.json`), rode `vercel --prod`.

### ⚠️ Editando `data/families.json` na mão
O admin e o RSVP escrevem **direto no GitHub**, então o clone local fica desatualizado sem aviso.

1. **Sempre `git pull --ff-only` antes de editar.** Commitar por cima do arquivo local apaga confirmações reais de convidados.
2. Edite (pelo GitHub web, pelo editor local ou por script), `git add` + `commit` + `push`.
3. A API lê do GitHub em tempo real: assim que o push entra, o link já funciona — não depende do redeploy da Vercel.

**Quando o QR code já foi entregue**, o convite *precisa* ser recriado com o **mesmo `id` do QR**, editando o JSON à mão. O admin (`POST /api/admin`) sempre gera um `id` novo aleatório, o que invalidaria o QR impresso.

### 🔧 `scripts/novo-convite.js`
Script para criar ou corrigir convite pela linha de comando. Ele sincroniza com o GitHub sozinho antes de gravar.

```powershell
# convite novo (id sorteado, igual ao admin)
node scripts/novo-convite.js "Família Silva" "João Silva" "Enzo:c"

# corrigir convite cujo QR JÁ foi entregue — mantém o id do QR
node scripts/novo-convite.js --id 081d3b22 "Padrinhos - Natália e João" "Natália" "João" --push
```

O sufixo `:c` marca criança (-5 anos, não pagante), igual ao admin. Ao final o script imprime o **ID e o link** prontos.

| Flag | O que faz |
|---|---|
| `--id <id>` | Usa este `id` em vez de sortear. Se o convite já existir, atualiza — é o caso do QR já entregue. |
| `--push` | Commita e dá push automaticamente. Sem ela, o script mostra os comandos. |
| `--force` | Autoriza sobrescrever membros que **já responderam**. Sem ela, o script bloqueia para não apagar confirmação. |
| `--dry-run` | Mostra o que faria, sem gravar. |

**Caso de uso principal**: convidado avisa que abriu o QR e "não aparece o nome dele". Pegue o `id` da URL que ele mandou e rode com `--id`, preenchendo os nomes da família.

---

## 🔒 Pendências de Segurança (mini-spec — resolver antes de escalar os convites)

Nenhuma delas quebra o sistema hoje; são riscos conhecidos, registrados para tratar com calma.

### 1. Senha do admin está exposta publicamente — **prioridade alta**
A credencial aparece em texto puro em **`js/admin.js:182-183`**, arquivo servido no site e visível no repositório público. Estava também neste documento (removida em 01/08/2026), mas **permanece no histórico de commits**. Com ela, qualquer pessoa entra no `/admin.html` e apaga ou edita todos os convites.

*Correção — os dois passos são necessários juntos*:
1. Trocar `ADMIN_AUTH` na Vercel (Production + Preview) por uma senha nova.
2. Remover a comparação hardcoded de `js/admin.js` (item 4). **Trocar só a env var quebra o login**, porque o cliente valida contra a string fixa e é ela que vai no campo `auth` das requisições.

Reescrever o histórico do git não é necessário: assim que a senha antiga deixa de ser válida, o que vazou não serve para nada.

### 2. Lista de convidados é pública
`data/families.json` fica dentro da pasta publicada, então responde **200** em `https://gustavo-e-lara.vercel.app/data/families.json` — nomes e status de todo mundo. O repo também é público.

*Correção sugerida*: mover os dados para um branch separado (`GITHUB_BRANCH=data` + `DATA_FILE`), que some do deploy sem mudar o código da API. Alternativa: tornar o repo privado.

### 3. RSVP não autentica — qualquer um pode responder pelos outros
`POST /api/rsvp` confia apenas no `id` do convite, sem nenhum segredo adicional. Como os `id`s estão no JSON público (item 2), dá para confirmar ou recusar presença no lugar de qualquer família. **Resolver o item 2 já derruba boa parte deste risco**, porque os `id`s deixam de ser listáveis.

*Correção completa (se valer o esforço)*: adicionar um token por família na URL do QR — mas isso **invalida todos os QR codes já entregues**, então provavelmente não compensa a esta altura.

### 4. Login do admin é validado no cliente
`js/admin.js` compara usuário/senha no navegador, então a credencial fica visível para quem abrir o DevTools. O servidor já valida de verdade (`ADMIN_AUTH` + `timingSafeEqual`), então a proteção real existe — o problema é a exposição.

*Correção*: mover a verificação do login para o servidor.

---
*Feito com amor, fé e muito código.* <code>&lt;/code&gt;</code>
