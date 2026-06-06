export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body;
  if (password === 'wonka') {
    res.setHeader('Set-Cookie', 'apex_auth=wonka; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000');
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong password' });
}
