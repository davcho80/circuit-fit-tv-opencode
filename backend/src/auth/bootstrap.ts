// ============================================================
// Bootstrap admin — exécuté au démarrage si la table User est vide
// Configure via ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD dans .env
// ============================================================

import argon2 from 'argon2';
import { prisma } from '../db.js';
import { config } from '../config.js';

export async function bootstrapAdmin(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;

  if (!config.adminEmail || !config.adminInitialPassword) {
    console.warn(
      '[bootstrap] Aucun utilisateur en base. Définir ADMIN_EMAIL et ADMIN_INITIAL_PASSWORD pour créer l\'admin initial.',
    );
    return;
  }

  const passwordHash = await argon2.hash(config.adminInitialPassword);
  await prisma.user.create({
    data: {
      email:              config.adminEmail,
      passwordHash,
      role:               'ADMIN',
      mustChangePassword: true,
    },
  });

  console.log(`[bootstrap] Compte admin créé : ${config.adminEmail} (mot de passe à changer au premier login)`);
}
