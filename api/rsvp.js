import { getFamilies, mutateFamilies } from './_store.js';

const STATUSES = ['confirmed', 'declined', 'pending'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });

      const families = await getFamilies();
      const family = families.find((f) => f.id === id);
      if (!family) return res.status(404).json({ error: 'Convite não encontrado' });

      return res.status(200).json(family);
    }

    if (req.method === 'POST') {
      const { id, members } = req.body;
      if (!id || !Array.isArray(members)) return res.status(400).json({ error: 'ID and members are required' });

      // O convidado só escolhe a resposta. Nomes e "criança" vêm sempre do banco:
      // a rota é pública, então nada do que o navegador manda vira HTML no admin.
      const result = await mutateFamilies(`rsvp: confirmação — ${id}`, (families) => {
        const family = families.find((f) => f.id === id);
        if (!family) return { write: false, notFound: true };
        family.members = (family.members || []).map((stored, i) => {
          const sent = members[i]?.name === stored.name ? members[i] : members.find((m) => m?.name === stored.name);
          if (!sent || !STATUSES.includes(sent.status)) return stored;
          return { name: stored.name, isChild: !!stored.isChild, status: sent.status }; // respondeu pelo site: sai o "marcado por vocês"
        });
        family.updatedAt = new Date().toISOString();
        return { write: true };
      });

      if (result.notFound) return res.status(404).json({ error: 'Convite não encontrado' });
      return res.status(200).json({ message: 'Sucesso!' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('RSVP API error:', error);
    return res.status(500).json({ error: 'Erro no banco de dados', details: error.message });
  }
}
