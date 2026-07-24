/*
 * Armazenamento durável usando o próprio repositório do GitHub como "banco".
 *
 * Por que GitHub e não Redis?
 *   O free-tier de Redis apaga bancos ociosos — o que derrubou a lista antes.
 *   Aqui os dados vivem em `data/families.json` no repo: nunca expira por
 *   inatividade e cada escrita vira um commit (histórico = backup automático).
 *
 * Variáveis de ambiente necessárias (configurar na Vercel):
 *   GITHUB_TOKEN   → Personal Access Token (fine-grained) com Contents: Read+Write
 *   GITHUB_REPO    → "gpaferrari/gustavo-e-lara"
 *   GITHUB_BRANCH  → "master" (opcional, padrão master)
 *   DATA_FILE      → "data/families.json" (opcional)
 */

const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'master';
const FILE_PATH = process.env.DATA_FILE || 'data/families.json';
const TOKEN = process.env.GITHUB_TOKEN;

const apiUrl = () => `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(FILE_PATH).replace(/%2F/g, '/')}`;

const authHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gustavo-e-lara-wedding',
});

const assertConfig = () => {
  if (!TOKEN || !REPO) {
    throw new Error('Config do banco ausente: defina GITHUB_TOKEN e GITHUB_REPO na Vercel.');
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lê o arquivo atual do GitHub. Retorna { families, sha }. Se o arquivo ainda
// não existe, retorna lista vazia e sha nulo (a primeira escrita cria o arquivo).
const githubRead = async () => {
  assertConfig();
  const res = await fetch(`${apiUrl()}?ref=${encodeURIComponent(BRANCH)}`, { headers: authHeaders() });
  if (res.status === 404) return { families: [], sha: null };
  if (!res.ok) {
    const err = new Error(`GitHub read ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const raw = Buffer.from(json.content, 'base64').toString('utf8');
  let families = [];
  try { families = JSON.parse(raw); } catch { families = []; }
  if (!Array.isArray(families)) families = [];
  return { families, sha: json.sha };
};

const githubWrite = async (families, sha, message) => {
  assertConfig();
  const body = {
    message,
    content: Buffer.from(JSON.stringify(families, null, 2)).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(apiUrl(), {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`GitHub write ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// Apenas leitura (usado no GET).
export const getFamilies = async () => (await githubRead()).families;

/*
 * Leitura-modificação-escrita atômica com retry.
 * `mutator(families)` recebe o array atual, pode alterá-lo in-place e deve
 * retornar um objeto de resultado. Se `write` for false, nada é commitado
 * (ex.: família não encontrada). Em caso de conflito de concorrência (409,
 * duas confirmações ao mesmo tempo) relê e tenta de novo.
 */
export const mutateFamilies = async (message, mutator, retries = 4) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { families, sha } = await githubRead();
    const result = mutator(families) || {};
    if (result.write === false) return result;
    try {
      await githubWrite(families, sha, message);
      return result;
    } catch (err) {
      lastErr = err;
      if (err.status === 409 && attempt < retries) {
        await sleep(150 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Conflito de escrita: tentativas esgotadas.');
};
