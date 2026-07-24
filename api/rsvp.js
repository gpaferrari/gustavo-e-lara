import { getFamilies, mutateFamilies } from './_store.js';

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
      if (!id || !members) return res.status(400).json({ error: 'ID and members are required' });

      const result = await mutateFamilies(`rsvp: confirmação — ${id}`, (families) => {
        const idx = families.findIndex((f) => f.id === id);
        if (idx === -1) return { write: false, notFound: true };
        families[idx].members = members;
        families[idx].updatedAt = new Date().toISOString();
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
