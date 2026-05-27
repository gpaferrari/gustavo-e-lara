import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  // Enhanced check: support both Vercel KV (REST) and standard Redis (URL)
  const isKVConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  const isRedisConfigured = process.env.REDIS_URL;

  if (!isKVConfigured && !isRedisConfigured) {
    console.error('Database configuration missing!');
    return res.status(500).json({ 
      error: 'Configuração do banco de dados pendente.',
      details: 'Não encontramos KV_REST_API_URL nem REDIS_URL nas variáveis de ambiente.' 
    });
  }

  if (req.method === 'GET') {
    try {
      const allFamilies = await kv.get('families_index');
      return res.status(200).json(Array.isArray(allFamilies) ? allFamilies : []);
    } catch (error) {
      console.error('Database GET Error:', error);
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

      await kv.set(`family:${id}`, newFamily);

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
      console.error('Database POST Error:', error);
      return res.status(500).json({ error: 'Erro ao salvar no banco', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
