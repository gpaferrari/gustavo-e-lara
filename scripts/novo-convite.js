#!/usr/bin/env node
/*
 * Cria ou corrige um convite em data/families.json pela linha de comando.
 *
 * Por que existe, se o admin já faz isso?
 *   O admin sempre sorteia um `id` novo. Quando o QR code JÁ foi impresso ou
 *   enviado, o convite precisa manter exatamente o `id` que está no QR — senão
 *   o convidado abre o link e cai em "convite não encontrado". Este script
 *   permite fixar o `id` (--id) para preencher os nomes de um convite que já
 *   circulou. Para convite novo, use o admin: é mais prático.
 *
 * Uso:
 *   node scripts/novo-convite.js "Família Silva" "João Silva" "Enzo:c"
 *   node scripts/novo-convite.js --id 081d3b22 "Padrinhos - Natália e João" "Natália" "João"
 *
 * Sufixo `:c` marca criança (-5 anos, não pagante), igual ao admin.
 *
 * Flags:
 *   --id <id>   usa este id em vez de sortear; se já existir, atualiza o convite
 *   --push      commita e dá push automaticamente ao final
 *   --force     autoriza sobrescrever membros que já responderam (Vou/Não vou)
 *   --dry-run   mostra o que faria, sem gravar nada
 *
 * Variável de ambiente:
 *   DATA_FILE   caminho do JSON (padrão: data/families.json)
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.resolve(REPO_ROOT, process.env.DATA_FILE || 'data/families.json');
const SITE = 'https://gustavo-e-lara.vercel.app';

const erro = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

/* ── Argumentos ─────────────────────────────────────── */

const parseArgs = (argv) => {
  const opts = { id: null, push: false, force: false, dryRun: false, livres: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') opts.id = argv[++i];
    else if (a.startsWith('--id=')) opts.id = a.slice(5);
    else if (a === '--push') opts.push = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) erro(`Flag desconhecida: ${a}`);
    else opts.livres.push(a);
  }
  return opts;
};

// "Enzo:c" → { name: 'Enzo', status: 'pending', isChild: true }
const parseMembro = (raw) => {
  const limpo = raw.trim();
  const isChild = limpo.toLowerCase().endsWith(':c');
  return {
    name: (isChild ? limpo.slice(0, -2) : limpo).trim(),
    status: 'pending',
    isChild,
  };
};

/* ── Git: o clone local fica velho sem avisar ────────── */

const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

/*
 * O admin e o RSVP escrevem direto no GitHub, então o arquivo local pode estar
 * atrás do remoto. Gravar por cima apagaria confirmações reais de convidados —
 * por isso sincronizamos antes de qualquer escrita.
 */
const sincronizar = () => {
  try {
    git('fetch', '-q', 'origin', 'master');
    const atras = Number(git('rev-list', '--count', 'HEAD..origin/master'));
    if (!atras) return;
    console.log(`↓ Local está ${atras} commit(s) atrás do GitHub. Sincronizando...`);
    git('pull', '--ff-only', '-q', 'origin', 'master');
    console.log('✓ Sincronizado.');
  } catch (err) {
    erro(
      'Não consegui sincronizar com o GitHub. Resolva antes de gravar, ou os dados\n' +
        '  do site podem ser sobrescritos. Detalhe: ' +
        (err.stderr || err.message || '').toString().trim()
    );
  }
};

const commitarEEnviar = (familia, criou) => {
  const acao = criou ? 'novo' : 'editar';
  git('add', path.relative(REPO_ROOT, DATA_FILE));
  git('commit', '-m', `convite: ${acao} — ${familia.familyName}`);
  git('push', '-q', 'origin', 'master');
  console.log('✓ Commitado e enviado para o GitHub.');
};

/* ── Execução ───────────────────────────────────────── */

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  const [familyName, ...membrosRaw] = opts.livres;

  if (!familyName) {
    console.log(`
Uso:
  node scripts/novo-convite.js "Família Silva" "João Silva" "Enzo:c"
  node scripts/novo-convite.js --id 081d3b22 "Padrinhos - Natália e João" "Natália" "João"

Flags: --id <id>  --push  --force  --dry-run
Sufixo ":c" marca criança (-5 anos).
`);
    process.exit(1);
  }

  const members = membrosRaw.map(parseMembro).filter((m) => m.name !== '');
  if (!members.length) erro('Informe ao menos um integrante da família.');

  if (!opts.dryRun) sincronizar();

  if (!fs.existsSync(DATA_FILE)) erro(`Arquivo não encontrado: ${DATA_FILE}`);
  const familias = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(familias)) erro('data/families.json não contém uma lista.');

  const id = opts.id || randomUUID().split('-')[0];
  const idx = familias.findIndex((f) => f.id === id);
  const criou = idx === -1;

  if (criou) {
    familias.push({ id, familyName, members, createdAt: new Date().toISOString() });
  } else {
    // Convite já existe: preenchendo os nomes de um QR que já circulou.
    // Só bloqueia se alguém já tiver respondido, para não apagar confirmação.
    const respondeu = (familias[idx].members || []).filter((m) => m.status && m.status !== 'pending');
    if (respondeu.length && !opts.force) {
      erro(
        `O convite ${id} ("${familias[idx].familyName}") já tem resposta de: ` +
          `${respondeu.map((m) => `${m.name} (${m.status})`).join(', ')}.\n` +
          '  Sobrescrever apagaria essas respostas. Use --force se for isso mesmo.'
      );
    }
    familias[idx] = { ...familias[idx], familyName, members, updatedAt: new Date().toISOString() };
  }

  const familia = criou ? familias[familias.length - 1] : familias[idx];
  const link = `${SITE}/rsvp.html?id=${id}`;

  if (opts.dryRun) {
    console.log(`\n[dry-run] ${criou ? 'Criaria' : 'Atualizaria'}:\n`);
    console.log(JSON.stringify(familia, null, 2));
    console.log(`\nLink: ${link}\n`);
    return;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(familias, null, 2) + '\n');

  console.log(`\n✓ Convite ${criou ? 'criado' : 'atualizado'}: ${familyName}`);
  console.log(`  ID:   ${id}`);
  console.log(`  Link: ${link}`);
  console.log(`  Quem: ${members.map((m) => m.name + (m.isChild ? ' (criança)' : '')).join(', ')}`);

  if (opts.push) {
    commitarEEnviar(familia, criou);
    console.log('  O link já funciona (a API lê do GitHub em tempo real).\n');
  } else {
    console.log('\nFalta enviar para o ar:');
    console.log('  git add data/families.json; git commit -m "convite: ' + familyName + '"; git push\n');
  }
};

main();
