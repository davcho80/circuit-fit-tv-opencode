// ============================================================
// Script de création / réinitialisation d'un compte admin
// Usage :
//   npm run create-admin -- admin@exemple.com "MonMotDePasse@2025!"
// ============================================================

import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import pg from 'pg';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> "<mot_de_passe>"');
  process.exit(1);
}

// Valider la politique de mot de passe
const pwErrors: string[] = [];
if (password.length < 8)         pwErrors.push('Minimum 8 caractères');
if (!/[A-Z]/.test(password))     pwErrors.push('Au moins une majuscule');
if (!/[a-z]/.test(password))     pwErrors.push('Au moins une minuscule');
if (!/[0-9]/.test(password))     pwErrors.push('Au moins un chiffre');
if (!/[^A-Za-z0-9]/.test(password)) pwErrors.push('Au moins un caractère spécial');

if (pwErrors.length > 0) {
  console.error('Mot de passe invalide :');
  pwErrors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  console.error('Variable DATABASE_URL manquante');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

try {
  await prisma.$connect();

  const passwordHash = await argon2.hash(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Mettre à jour le mot de passe et remettre mustChangePassword
    await prisma.user.update({
      where: { email },
      data:  { passwordHash, mustChangePassword: true, role: 'ADMIN' },
    });
    console.log(`✓ Compte mis à jour : ${email} (rôle ADMIN, mot de passe temporaire à changer)`);
  } else {
    await prisma.user.create({
      data: { email, passwordHash, role: 'ADMIN', mustChangePassword: true },
    });
    console.log(`✓ Compte admin créé : ${email} (mot de passe temporaire à changer au premier login)`);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
