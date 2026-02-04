// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo company
  const company = await prisma.company.upsert({
    where: { slug: 'emergence-transit' },
    update: {},
    create: {
      name: 'EMERGENCE TRANSIT GUINEE',
      slug: 'emergence-transit',
      phone: '+224 628 359 711',
      address: 'Conakry, Guinée',
      email: 'contact@emergence-transit.com',
      nif: 'GN.TCC.2022.M2.06204',
    },
  });

  console.log(`✅ Company created: ${company.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin123!', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@emergence-transit.com' },
    update: {},
    create: {
      email: 'admin@emergence-transit.com',
      password: hashedPassword,
      name: 'Administrateur',
      role: 'DIRECTOR',
      emailVerified: true,
      isActive: true,
      companyId: company.id,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Create demo client
  const client = await prisma.client.upsert({
    where: { id: 'demo-client' },
    update: {},
    create: {
      id: 'demo-client',
      name: 'SOGECO SARL',
      nif: '7087525482L',
      phone: '+224 613 94 97 82',
      address: 'RATOMA-KIPÉ',
      city: 'Conakry',
      companyId: company.id,
    },
  });

  console.log(`✅ Client created: ${client.name}`);

  // Create demo shipment
  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber: 'TR-DEMO-001',
      companyId: company.id,
      createdById: admin.id,
      clientId: client.id,
      clientName: client.name,
      clientNif: client.nif,
      description: 'OIGNONS',
      hsCode: '07031000',
      packaging: 'Sac',
      packageCount: 2280,
      grossWeight: 57000,
      cifValue: 18240,
      cifCurrency: 'USD',
      exchangeRate: 8646.285,
      cifValueGnf: 157708238,
      blNumber: 'MEDU09243710',
      vesselName: 'MSC BANU III',
      voyageNumber: 'XA545A',
      portOfLoading: 'ANTWERP, BELGIUM',
      portOfDischarge: 'CONAKRY',
      supplierName: 'J.P. BEEMSTERBOER FOOD TRADERS BV',
      supplierCountry: 'NETHERLANDS',
      customsRegime: 'IM4',
      customsOffice: 'GNB02',
      customsOfficeName: 'BUREAU CONAKRY PORT',
      declarantCode: '0178',
      declarantName: 'MOB TRANSIT',
      dutyDD: 55197883,
      dutyRTL: 3154165,
      dutyTVA: 38890851,
      dutyPC: 788541,
      dutyCA: 394271,
      dutyBFU: 389083,
      totalDuties: 98814794,
      status: 'CUSTOMS_PAID',
      containers: {
        create: [
          { number: 'SEGU9759487', type: 'REEFER_40HR', grossWeight: 28500, packageCount: 1140, temperature: 8 },
          { number: 'SZLU9247571', type: 'REEFER_40HR', grossWeight: 28500, packageCount: 1140, temperature: 8 },
        ],
      },
      expenses: {
        create: [
          { type: 'PROVISION', category: 'AUTRE', description: 'Avance client SOGECO', amount: 150000000, paid: false },
          { type: 'DISBURSEMENT', category: 'DD', description: 'Droit de Douane', amount: 55197883, paid: true, paidAt: new Date() },
          { type: 'DISBURSEMENT', category: 'TVA', description: 'TVA', amount: 38890851, paid: true, paidAt: new Date() },
          { type: 'DISBURSEMENT', category: 'ACCONAGE', description: 'Acconage Terminal', amount: 2198354, paid: false },
          { type: 'DISBURSEMENT', category: 'BRANCHEMENT', description: 'Branchement Frigo', amount: 32657539, paid: false },
        ],
      },
      timeline: {
        create: [
          { action: 'Dossier créé', userName: admin.name },
          { action: 'Déclaration déposée', userName: admin.name, date: new Date(Date.now() - 86400000) },
          { action: 'Droits de douane payés', userName: admin.name, date: new Date() },
        ],
      },
    },
  });

  console.log(`✅ Demo shipment created: ${shipment.trackingNumber}`);

  console.log('\n🎉 Seeding completed!');
  console.log('\n📝 Demo credentials:');
  console.log('   Email: admin@emergence-transit.com');
  console.log('   Password: Admin123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
