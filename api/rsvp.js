import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
      const family = await kv.get(`family:${id}`);
      if (!family) return res.status(404).json({ error: 'Convite não encontrado' });
      return res.status(200).json(family);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar dados' });
    }
  }

  if (req.method === 'POST') {
    const { id, members } = req.body;
    if (!id || !members) return res.status(400).json({ error: 'ID and members are required' });

    try {
      const family = await kv.get(`family:${id}`);
      if (!family) return res.status(404).json({ error: 'Convite não encontrado' });

      // members is now expected to be [{ name: string, status: 'confirmed' | 'declined' | 'pending' }]
      family.members = members;
      family.updatedAt = new Date().toISOString();

      await kv.set(`family:${id}`, family);
      
      // Update index
      const allFamilies = await kv.get('families_index') || [];
      const index = allFamilies.findIndex(f => f.id === id);
      if (index !== -1) {
        allFamilies[index].members = members;
        allFamilies[index].lastUpdate = family.updatedAt;
        await kv.set('families_index', allFamilies);
      }

      return res.status(200).json({ message: 'Presença atualizada com sucesso!' });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao salvar confirmação' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
