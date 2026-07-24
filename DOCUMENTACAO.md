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
- **Acesso Seguro**: Login protegido (Usuário: `GueLara` | Senha: `1104`).
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
1. **Adicionar Novos Convidados**: Acesse `/admin.html`, faça login e use o formulário "Novo Convite".
2. **Gerar Convites Físicos**: No painel admin, use o botão "QR" em cada card, baixe a imagem e anexe ao convite impresso.
3. **Deploy de Mudanças**: Sempre que houver alteração no código ou dependências (`package.json`), rode `vercel --prod`.

---
*Feito com amor, fé e muito código.* <code>&lt;/code&gt;</code>
