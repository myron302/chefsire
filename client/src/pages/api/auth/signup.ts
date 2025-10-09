// client/src/pages/api/auth/signup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../server/storage'; // Path to your storage.ts
import bcrypt from 'bcryptjs'; // For secure password hashing

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST (form submits)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get form data
  const { name, email, password } = req.body;

  // Basic checks
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Hash password (secure it!)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user via storage (uses your DB)
    const newUser = await storage.createUser({
      name,
      email,
      password: hashedPassword,
      username: email.split('@')[0], // Simple username (e.g., from john@example.com -> john)
      isActive: true,
      // Add defaults from your schema if needed, e.g.:
      // avatarUrl: null,
      // bio: '',
      // postsCount: 0,
      // followersCount: 0,
      // followingCount: 0,
      // isChef: false,
    });

    // Hide password from response
    const { password: _, ...safeUser } = newUser;

    // Success!
    res.status(201).json({ user: safeUser });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
