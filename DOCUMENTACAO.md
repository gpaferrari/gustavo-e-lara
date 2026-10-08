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
- **Lista de Presentes**: Magalu (lista oficial no *Quero de Casamento* — os presentes viram crédito no Cartão Listas Magalu, válido por 1 ano) e Havan.
- **Contagem regressiva** no topo e **passo a passo da confirmação** com botões de agenda (Google / `casamento.ics`) e ajuda por WhatsApp.
- **Lembrete de confirmação**: barra discreta no rodapé, mostrada uma vez por aparelho (até o prazo).
- **Compartilhamento**: botão no rodapé que abre o menu nativo do celular ou copia o link no desktop.
- Funciona sem JavaScript (o conteúdo só começa oculto para a animação quando o JS está ativo).

### 2. Painel Administrativo (`admin.html`)
Área restrita para os noivos gerenciarem a lista de convidados.
- **Acesso Seguro**: Login validado **no servidor** (`POST /api/admin` com `action: 'login'`). A credencial fica só na variável de ambiente `ADMIN_AUTH` na Vercel — **nunca escrever a senha neste arquivo nem no JS** (o repositório é público).
- **Resumo**: barra de progresso de **convites entregues** (x de y), barra de **respostas** (vão / não vão / pendentes) e números de pessoas, pagantes, crianças e **pagantes confirmados** (base do buffet).
- **Busca e filtros**: busca por família ou convidado (ignora acentos) e filtros Todos · A entregar · Entregues · Aguardando · Responderam · Sem integrantes.
- **Gestão de Convites (Cards)**:
    - **Entregue ✓**: toque no botão "Entregue" do card para marcar que o convite físico/QR já foi entregue (grava `delivered` + `deliveredAt`). Desmarcar desfaz.
    - **Criação**: formulário com uma linha por integrante e caixa "Criança". Colar `João, Maria, Enzo:c` num campo cria várias linhas de uma vez (o sufixo `:c` continua valendo). Ao criar, o QR abre na hora.
    - **Nome que o convidado vê** (opcional, campo `displayName`): texto mostrado em destaque no RSVP no lugar do nome interno (ex.: "Tia Dalva e família" em vez de "Família do Noivo - Tia Dalva").
    - **Edição**: Alterar nome, adicionar/remover integrantes ou marcar criança. **Mantém o `id`** (o QR continua valendo) e **nunca sobrescreve uma resposta** que o convidado tenha dado enquanto o formulário estava aberto.
    - **Exclusão**: Remover um convite inteiro (avisa se ele já foi entregue).
    - **QR Code**: Baixa PNG em alta resolução com margem branca (melhor leitura impressa) ou envia o link (menu de compartilhar do celular / WhatsApp).

### 3. Sistema de RSVP Personalizado (`rsvp.html`)
Página que o convidado acessa via QR Code ou Link único.
- **Reconhecimento de Família**: O sistema identifica a família pelo ID na URL (`?id=xyz`) e exibe apenas os nomes daquela família.
- **Confirmação Individual**: Cada membro marca **Vou**, **Não vou** ou **Ainda não sei** (= `pending`). Atalho "Todos vão" para famílias.
- **Retorno**: quem volta ao link vê as respostas anteriores e a data em que respondeu.
- **Sucesso**: resumo de quem vai, botões para salvar na agenda (Google / .ics para iPhone) e "Como chegar".
- **Convite sem integrantes**: em vez de uma tela vazia, mostra "Quase lá!" com botão de WhatsApp já contendo o código do convite.
- **Sincronização em Tempo Real**: Assim que o convidado envia, os dados são atualizados no Banco de Dados e refletem no Painel Admin.

---

## 🏗️ Arquitetura Técnica

- **Frontend**: HTML5, CSS3 (Variáveis, Flexbox, Grid), JavaScript (Vanilla, Intersection Observer API, Web Share API).
- **Backend**: Vercel Serverless Functions (Node.js), sem dependências externas (usa `fetch` nativo).
- **Banco de Dados**: `data/families.json` no repositório GitHub, acessado pela API de Contents. Leitura-modificação-escrita com retry para concorrência (ver `api/_store.js`).
- **Bibliotecas Externas**: `qrcode.js` (geração de QR Codes no admin).
- **Estilos**: `css/style.css` (site + variáveis), `css/admin.css` (painel) e `css/rsvp.css` (confirmação). Admin e RSVP reaproveitam as variáveis de cor/fonte do `style.css`.
- **API do admin** (`api/admin.js`): `GET` lista · `POST` cria (ou `action: 'login'`) · `PUT` edita · `PATCH { id, delivered }` marca entrega · `DELETE` exclui. Todas as escritas exigem `auth`.

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

### 1. Senha antiga do admin vazou no histórico — **trocar a senha**
A comparação hardcoded saiu de `js/admin.js` (10/2026, item 4 resolvido), mas a senha antiga **continua no histórico de commits** do repositório público.

*Falta só um passo*: trocar `ADMIN_AUTH` na Vercel (Production + Preview) por uma senha nova (formato `usuario:senha`) e fazer redeploy. Agora isso **não quebra o login**, porque o navegador não guarda mais a senha — ele só pergunta ao servidor.

Reescrever o histórico do git não é necessário: assim que a senha antiga deixa de ser válida, o que vazou não serve para nada.

### 2. Lista de convidados é pública
`data/families.json` fica dentro da pasta publicada, então responde **200** em `https://gustavo-e-lara.vercel.app/data/families.json` — nomes e status de todo mundo. O repo também é público.

*Correção sugerida*: mover os dados para um branch separado (`GITHUB_BRANCH=data` + `DATA_FILE`), que some do deploy sem mudar o código da API. Alternativa: tornar o repo privado.

### 3. RSVP não autentica — qualquer um pode responder pelos outros
`POST /api/rsvp` confia apenas no `id` do convite, sem nenhum segredo adicional. Como os `id`s estão no JSON público (item 2), dá para confirmar ou recusar presença no lugar de qualquer família. **Resolver o item 2 já derruba boa parte deste risco**, porque os `id`s deixam de ser listáveis.

*Correção completa (se valer o esforço)*: adicionar um token por família na URL do QR — mas isso **invalida todos os QR codes já entregues**, então provavelmente não compensa a esta altura.

### 4. ~~Login do admin é validado no cliente~~ — resolvido
O login agora chama `POST /api/admin` com `action: 'login'`, validado por `ADMIN_AUTH` + `timingSafeEqual`. Nenhuma credencial fica no JS público.

---
*Feito com amor, fé e muito código.* <code>&lt;/code&gt;</code>
