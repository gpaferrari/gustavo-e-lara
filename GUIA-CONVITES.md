# Guia Prático — Gerenciar Convites e RSVP

Manual de operação do dia a dia: criar convite, corrigir convite cujo QR já foi entregue, apagar e testar sem estragar os dados reais.

Para a arquitetura do sistema, veja [DOCUMENTACAO.md](DOCUMENTACAO.md).

---

## ⚠️ A regra de ouro

O painel admin e a página de RSVP escrevem **direto no GitHub**. Toda vez que um convidado confirma presença, nasce um commit no `master` que você não tem no computador.

> **Sempre `git pull` antes de editar `data/families.json` na mão.**
> Commitar por cima do arquivo local **apaga confirmações reais** de convidados.

Isso não é hipotético: durante a criação deste guia, um único RSVP de teste já deixou o clone local 1 commit atrás. O `scripts/novo-convite.js` faz esse `pull` sozinho — a edição manual não.

---

## 🧭 Qual caminho usar?

| Situação | Use |
|---|---|
| Convite novo, ninguém recebeu QR ainda | **`/admin.html`** — mais prático |
| Convidado diz "abri o QR e não aparece meu nome" | **`scripts/novo-convite.js --id`** |
| Precisa de um `id` específico por qualquer motivo | **`scripts/novo-convite.js --id`** |
| Editar nomes, marcar criança, ver estatísticas | **`/admin.html`** |
| Ajuste pontual, você já está no editor | **Editar o JSON na mão** |

**Por que o admin não serve para QR já entregue**: o `POST /api/admin` sempre gera um `id` novo e aleatório (`randomUUID().split('-')[0]`). Se o QR já foi impresso ou enviado, um `id` novo **invalida o QR** — o convidado abre e cai em "convite não encontrado".

---

## 🔧 Cenário 1 — "Abri o QR e não aparece meu nome"

O caso mais comum. O convite existe (o `id` do QR é válido), mas está sem os integrantes cadastrados.

1. Peça ao convidado o **link que ele abriu**, ou leia o `id` do QR:
   `https://gustavo-e-lara.vercel.app/rsvp.html?id=`**`081d3b22`**
2. Rode com esse `id`:

```powershell
node scripts/novo-convite.js --id 081d3b22 "Padrinhos - Natália e João" "Natália" "João" --push
```

3. Peça pra ele atualizar a página. O `--push` já publica, e a API lê do GitHub em tempo real — **não precisa esperar redeploy da Vercel**.

O `id` do QR é preservado, então o QR impresso continua valendo.

---

## ➕ Cenário 2 — Convite novo pela linha de comando

```powershell
node scripts/novo-convite.js "Família Silva" "João Silva" "Enzo:c"
```

Sufixo **`:c`** marca criança (-5 anos, não pagante), igual ao admin. O script imprime o **ID e o link** prontos para gerar o QR.

Sem `--push` ele apenas edita o arquivo e mostra os comandos de git, para você revisar antes.

### Flags

| Flag | O que faz |
|---|---|
| `--id <id>` | Usa este `id` em vez de sortear. Se o convite já existir, **atualiza**. |
| `--push` | Commita e envia para o GitHub automaticamente. |
| `--force` | Autoriza sobrescrever membros que **já responderam**. |
| `--dry-run` | Mostra o resultado sem gravar nada. |

### A trava de segurança

Se o convite já tem gente que respondeu "Vou" / "Não vou", o script **recusa** e mostra quem:

```
✖ O convite 2c482c09 ("ZZ Teste") já tem resposta de: Fulano (yes), Cricri (no).
  Sobrescrever apagaria essas respostas. Use --force se for isso mesmo.
```

Só passe `--force` se for realmente para descartar aquelas respostas.

---

## ✍️ Cenário 3 — Editar o JSON na mão

Funciona igual: a API só lê `data/families.json`. Serve tanto pelo GitHub web quanto no editor local.

```powershell
git pull --ff-only          # obrigatório, sempre
# edite data/families.json
git add data/families.json; git commit -m "convite: Familia Silva"; git push
```

Formato de uma família (campos exatos — `status` e `isChild` são obrigatórios em cada membro):

```json
{
  "id": "081d3b22",
  "familyName": "Padrinhos - Natália e João",
  "members": [
    { "name": "Natália", "status": "pending", "isChild": false },
    { "name": "João",    "status": "pending", "isChild": true  }
  ],
  "createdAt": "2026-08-01T22:12:58.038Z"
}
```

`status` aceita: `pending` (não respondeu), `yes` (vai) e `no` (não vai).

Pelo GitHub web, o arquivo fica em:
`https://github.com/gpaferrari/gustavo-e-lara/blob/master/data/families.json`

---

## 🗑️ Cenário 4 — Apagar um convite

Pelo admin é um clique (botão de excluir no card). Na mão:

```powershell
git pull --ff-only
node -e "const fs=require('fs');const p='data/families.json';const f=JSON.parse(fs.readFileSync(p,'utf8'));const i=f.findIndex(x=>x.id==='COLOQUE_O_ID');if(i===-1){console.log('nao existe');process.exit(0);}console.log('removendo:',f[i].familyName);f.splice(i,1);fs.writeFileSync(p,JSON.stringify(f,null,2)+'\n');console.log('total agora:',f.length)"
git add data/families.json; git commit -m "chore: remover convite X"; git push
```

Apagou sem querer? Nada é perdido de verdade — o histórico do arquivo tem tudo:
`https://github.com/gpaferrari/gustavo-e-lara/commits/master/data/families.json`

---

## 🧪 Como testar sem estragar nada

### Opção A — `--dry-run` (não grava nada)

```powershell
node scripts/novo-convite.js --dry-run "Família Teste" "Fulano" "Cricri:c"
```

### Opção B — arquivo de teste separado

A variável `DATA_FILE` redireciona o script para outro arquivo:

```powershell
Copy-Item data/families.json "$env:TEMP\teste.json"
$env:DATA_FILE = "$env:TEMP\teste.json"
node scripts/novo-convite.js "Família Teste" "Fulano"
Remove-Item Env:\DATA_FILE      # IMPORTANTE: volta a apontar para o arquivo real
```

### Opção C — teste ponta a ponta em produção

Procedimento validado em 01/08/2026, do jeito que foi executado:

```powershell
# 1. criar
node scripts/novo-convite.js "ZZ Teste - APAGAR" "Fulano Teste" "Cricri Teste:c" --push
#    → anote o ID que ele imprimir

# 2. conferir que está no ar (espera-se HTTP 200 com os dados)
curl.exe -s "https://gustavo-e-lara.vercel.app/api/rsvp?id=SEU_ID"

# 3. simular a confirmação de um convidado
curl.exe -s -X POST "https://gustavo-e-lara.vercel.app/api/rsvp" -H "Content-Type: application/json" -d '{\"id\":\"SEU_ID\",\"members\":[{\"name\":\"Fulano Teste\",\"status\":\"yes\",\"isChild\":false}]}'

# 4. apagar (veja o Cenário 4) e confirmar que sumiu — espera-se HTTP 404
curl.exe -s "https://gustavo-e-lara.vercel.app/api/rsvp?id=SEU_ID"
```

Use um nome bem óbvio como `ZZ Teste - APAGAR` para não confundir com convidado real, e apague logo em seguida.

---

## 🔍 Conferir o estado atual

```powershell
# lista completa direto de produção
curl.exe -s "https://gustavo-e-lara.vercel.app/api/admin"

# um convite específico
curl.exe -s "https://gustavo-e-lara.vercel.app/api/rsvp?id=081d3b22"
```

Ou simplesmente abra o `/admin.html`, que mostra tudo com as estatísticas.

---

## 🚑 Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Convidado vê "convite não encontrado" | O `id` do QR não existe no JSON | Cenário 1, com o `id` do QR dele |
| Confirmação do convidado sumiu | Alguém commitou por cima com o local desatualizado | Recupere pelo histórico do arquivo no GitHub |
| `git push` rejeitado | Chegou RSVP enquanto você editava | `git pull --ff-only` e tente de novo |
| Site retorna erro 500 | JSON inválido (vírgula sobrando, aspas faltando) | Valide com `node -e "require('./data/families.json')"` e corrija |
| Script diz que está "atrás do GitHub" e falha | Você tem alteração local não commitada | Commite ou descarte, depois rode de novo |

---

## 🔒 Antes de escalar os convites

Existem pendências de segurança conhecidas — nenhuma quebra o sistema hoje, mas vale resolver antes de distribuir o restante dos convites. Estão registradas em [DOCUMENTACAO.md](DOCUMENTACAO.md), seção "Pendências de Segurança". A mais urgente é a **senha do admin exposta** em `js/admin.js`.

---
*Feito com amor, fé e muito código.* <code>&lt;/code&gt;</code>
