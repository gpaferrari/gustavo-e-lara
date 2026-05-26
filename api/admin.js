import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const allFamilies = await kv.get('families_index') || [];
      return res.status(200).json(allFamilies);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar convites' });
    }
  }

  if (req.method === 'POST') {
    const { familyName, members, auth } = req.body;
    
    // Simple auth check
    if (auth !== 'GueLara:1104') {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!familyName || !members) return res.status(400).json({ error: 'Data incomplete' });

    try {
      const id = randomUUID().split('-')[0];
      const newFamily = {
        id,
        familyName,
        members: members.map(name => ({ name: name.trim(), status: 'pending' })),
        createdAt: new Date().toISOString()
      };

      await kv.set(`family:${id}`, newFamily);

      // Add to index
      const allFamilies = await kv.get('families_index') || [];
      allFamilies.push(newFamily);
      await kv.set('families_index', allFamilies);

      return res.status(201).json(newFamily);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao criar convite' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
