import { createClient } from 'redis';

let redisClient;

const getRedisClient = async () => {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) throw new Error('REDIS_URL or KV_URL missing');
  redisClient = createClient({ url });
  await redisClient.connect();
  return redisClient;
};

export default async function handler(req, res) {
  const { id } = req.query;
  let client;

  try {
    client = await getRedisClient();
  } catch (error) {
    return res.status(500).json({ error: 'Erro de conexão' });
  }

  if (req.method === 'GET') {
    if (!id) return res.status(400).json({ error: 'ID is required' });
    try {
      const data = await client.get(`family:${id}`);
      if (!data) return res.status(404).json({ error: 'Convite não encontrado' });
      return res.status(200).json(JSON.parse(data));
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar dados' });
    }
  }

  if (req.method === 'POST') {
    const { id, members } = req.body;
    if (!id || !members) return res.status(400).json({ error: 'ID and members are required' });

    try {
      const data = await client.get(`family:${id}`);
      if (!data) return res.status(404).json({ error: 'Convite não encontrado' });

      const family = JSON.parse(data);
      family.members = members;
      family.updatedAt = new Date().toISOString();

      await client.set(`family:${id}`, JSON.stringify(family));
      
      const rawIndex = await client.get('families_index');
      const allFamilies = rawIndex ? JSON.parse(rawIndex) : [];
      const index = allFamilies.findIndex(f => f.id === id);
      if (index !== -1) {
        allFamilies[index].members = members;
        allFamilies[index].lastUpdate = family.updatedAt;
        await client.set('families_index', JSON.stringify(allFamilies));
      }

      return res.status(200).json({ message: 'Sucesso!' });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao salvar' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
