import { createClient } from 'redis';
import { randomUUID } from 'crypto';

// Reusable client singleton
let redisClient;

const getRedisClient = async () => {
  if (redisClient) return redisClient;
  
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) throw new Error('REDIS_URL or KV_URL missing');

  redisClient = createClient({ url });
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  await redisClient.connect();
  return redisClient;
};

export default async function handler(req, res) {
  let client;
  try {
    client = await getRedisClient();
  } catch (error) {
    console.error('Connection Error:', error);
    return res.status(500).json({ error: 'Erro de conexão com o banco', details: error.message });
  }

  if (req.method === 'GET') {
    try {
      const data = await client.get('families_index');
      return res.status(200).json(data ? JSON.parse(data) : []);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar dados' });
    }
  }

  if (req.method === 'POST') {
    const { familyName, members, auth } = req.body;
    if (auth !== 'GueLara:1104') return res.status(401).json({ error: 'Não autorizado' });
    if (!familyName || !members) return res.status(400).json({ error: 'Dados incompletos' });

    try {
      const id = randomUUID().split('-')[0];
      const newFamily = {
        id,
        familyName,
        members: members.map(name => ({ name: name.trim(), status: 'pending' })),
        createdAt: new Date().toISOString()
      };

      await client.set(`family:${id}`, JSON.stringify(newFamily));

      const rawIndex = await client.get('families_index');
      const allFamilies = rawIndex ? JSON.parse(rawIndex) : [];
      allFamilies.push(newFamily);
      await client.set('families_index', JSON.stringify(allFamilies));

      return res.status(201).json(newFamily);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao salvar' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
