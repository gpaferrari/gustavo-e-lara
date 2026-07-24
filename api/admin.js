import { randomUUID, timingSafeEqual } from 'crypto';
import { getFamilies, mutateFamilies } from './_store.js';

// Credencial do admin lida de variável de ambiente (defina ADMIN_AUTH na Vercel).
// Nunca cai num valor padrão: se não estiver configurada, toda escrita é negada.
const ADMIN_AUTH = process.env.ADMIN_AUTH;

const isAuthorized = (provided) => {
  if (!ADMIN_AUTH || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_AUTH);
  return a.length === b.length && timingSafeEqual(a, b);
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const families = await getFamilies();
      return res.status(200).json(families);
    }

    if (req.method === 'POST') {
      const { familyName, members, auth } = req.body;
      if (!isAuthorized(auth)) return res.status(401).json({ error: 'Não autorizado' });
      if (!familyName || !members) return res.status(400).json({ error: 'Dados incompletos' });

      const newFamily = {
        id: randomUUID().split('-')[0],
        familyName,
        members: members.map((m) => ({
          name: (typeof m === 'string' ? m : m.name).trim(),
          status: 'pending',
          isChild: typeof m === 'object' ? !!m.isChild : false,
        })),
        createdAt: new Date().toISOString(),
      };

      await mutateFamilies(`convite: novo — ${familyName}`, (families) => {
        families.push(newFamily);
        return { write: true };
      });

      return res.status(201).json(newFamily);
    }

    if (req.method === 'PUT') {
      const { id, familyName, members, auth } = req.body;
      if (!isAuthorized(auth)) return res.status(401).json({ error: 'Não autorizado' });
      if (!id || !familyName || !members) return res.status(400).json({ error: 'Dados incompletos' });

      const result = await mutateFamilies(`convite: editar — ${familyName}`, (families) => {
        const idx = families.findIndex((f) => f.id === id);
        if (idx === -1) return { write: false, notFound: true };
        families[idx] = { ...families[idx], id, familyName, members, updatedAt: new Date().toISOString() };
        return { write: true, family: families[idx] };
      });

      if (result.notFound) return res.status(404).json({ error: 'Convite não encontrado' });
      return res.status(200).json(result.family);
    }

    if (req.method === 'DELETE') {
      const { id, auth } = req.body;
      if (!isAuthorized(auth)) return res.status(401).json({ error: 'Não autorizado' });
      if (!id) return res.status(400).json({ error: 'ID ausente' });

      const result = await mutateFamilies(`convite: excluir — ${id}`, (families) => {
        const idx = families.findIndex((f) => f.id === id);
        if (idx === -1) return { write: false, notFound: true };
        families.splice(idx, 1);
        return { write: true };
      });

      if (result.notFound) return res.status(404).json({ error: 'Convite não encontrado' });
      return res.status(200).json({ message: 'Excluído com sucesso' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'Erro no banco de dados', details: error.message });
  }
}
