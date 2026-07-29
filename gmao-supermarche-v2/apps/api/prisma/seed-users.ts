const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

(async () => {
  // 1. Nullify user references in tickets, plans
  await p.ticket.updateMany({ where: {}, data: { createdById: null, assignedMaintenancierId: null, closedById: null } });
  await p.preventivePlan.updateMany({ where: {}, data: { assignedMaintenancierId: null } });

  // 2. Delete all non-admin users
  await p.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } });
  console.log('Cleared all non-admin users');

  // 3. Ensure admin exists
  const adminPwd = await bcrypt.hash('admin123', 10);
  await p.user.upsert({
    where: { email: 'admin@gmao.local' },
    update: {},
    create: { nom: 'Admin GMAO', email: 'admin@gmao.local', password: adminPwd, role: 'SUPER_ADMIN' },
  });
  console.log('Admin: admin@gmao.local / admin123');

  // 4. Create maintenanciers (universal)
  const mPwd = await bcrypt.hash('maintenancier123', 10);
  const maintIds = [];
  for (let i = 1; i <= 2; i++) {
    const u = await p.user.create({
      data: { nom: `Maintenancier ${i}`, email: `maintenancier${i}@gmao.local`, password: mPwd, role: 'MAINTENANCIER' },
    });
    maintIds.push(u.id);
    console.log(`  M${i}: maintenancier${i}@gmao.local / maintenancier123`);
  }

  // 5. Create demandeurs (tied to localisations)
  const dPwd = await bcrypt.hash('demandeur123', 10);
  const localisations = await p.localisation.findMany({ include: { supermarket: { select: { code: true } } } });

  // Group by supermarket, take 1 localisation per supermarket
  const smMap = new Map();
  for (const loc of localisations) {
    if (!smMap.has(loc.supermarketId)) smMap.set(loc.supermarketId, []);
    smMap.get(loc.supermarketId).push(loc);
  }

  let dCount = 0;
  for (const [smId, locs] of smMap) {
    const sm = locs[0].supermarket;
    for (let i = 0; i < Math.min(1, locs.length); i++) {
      dCount++;
      await p.user.create({
        data: {
          nom: `Demandeur ${dCount}`,
          email: `demandeur${dCount}@gmao.local`,
          password: dPwd,
          role: 'USER',
          supermarketId: smId,
          localisationId: locs[i].id,
        },
      });
      console.log(`  D${dCount}: demandeur${dCount}@gmao.local / demandeur123 -> ${locs[i].nom} (${sm.code})`);
    }
  }

  // Remaining supermarkets with no locs
  const allSm = await p.supermarket.findMany();
  for (const sm of allSm) {
    if (!smMap.has(sm.id)) {
      dCount++;
      await p.user.create({
        data: {
          nom: `Demandeur ${dCount}`,
          email: `demandeur${dCount}@gmao.local`,
          password: dPwd,
          role: 'USER',
          supermarketId: sm.id,
        },
      });
      console.log(`  D${dCount}: demandeur${dCount}@gmao.local / demandeur123 -> ${sm.code} (no loc)`);
    }
  }

  // 6. Re-assign maintenancier to existing tickets
  const ticketCount = await p.ticket.count();
  if (ticketCount > 0 && maintIds.length > 0) {
    await p.ticket.updateMany({ where: {}, data: { assignedMaintenancierId: maintIds[0] } });
    console.log(`Re-assigned ${ticketCount} tickets to Maintenancier 1`);
  }

  // 7. Re-assign preventive plans
  const planCount = await p.preventivePlan.count();
  if (planCount > 0 && maintIds.length > 0) {
    await p.preventivePlan.updateMany({ where: {}, data: { assignedMaintenancierId: maintIds[0] } });
    console.log(`Re-assigned ${planCount} preventive plans to Maintenancier 1`);
  }

  console.log(`\n✅ ${dCount} demandeurs, 2 maintenanciers`);
  await p.$disconnect();
})();
