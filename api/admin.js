import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  // Check if KV is configured
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error('KV Environment variables are missing!');
    return res.status(500).json({ 
      error: 'Configuração do banco de dados pendente.',
      details: 'As chaves KV_REST_API_URL ou TOKEN não foram encontradas.' 
    });
  }

  if (req.method === 'GET') {
    try {
      const allFamilies = await kv.get('families_index');
      // Ensure we return an array even if the index is empty or null
      return res.status(200).json(Array.isArray(allFamilies) ? allFamilies : []);
    } catch (error) {
      console.error('KV GET Error:', error);
      return res.status(500).json({ error: 'Erro ao buscar convites', details: error.message });
    }
  }

  if (req.method === 'POST') {
    const { familyName, members, auth } = req.body;
    
    if (auth !== 'GueLara:1104') {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!familyName || !members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Dados incompletos ou formato inválido' });
    }

    try {
      const id = randomUUID().split('-')[0];
      const newFamily = {
        id,
        familyName,
        members: members.map(name => ({ name: name.trim(), status: 'pending' })),
        createdAt: new Date().toISOString()
      };

      // Set family data
      await kv.set(`family:${id}`, newFamily);

      // Update index
      let allFamilies = [];
      try {
        const existingIndex = await kv.get('families_index');
        allFamilies = Array.isArray(existingIndex) ? existingIndex : [];
      } catch (e) {
        allFamilies = [];
      }
      
      allFamilies.push(newFamily);
      await kv.set('families_index', allFamilies);

      return res.status(201).json(newFamily);
    } catch (error) {
      console.error('KV POST Error:', error);
      return res.status(500).json({ error: 'Erro ao salvar no banco', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
