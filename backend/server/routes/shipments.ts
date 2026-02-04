// server/routes/shipments.ts

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { log } from '../config/logger.js';
import { auth, requireAgent } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Validation schemas
const createShipmentSchema = z.object({
  clientName: z.string().min(1, 'Nom client requis'),
  clientNif: z.string().optional(),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  description: z.string().min(1, 'Description requise'),
  hsCode: z.string().optional(),
  packaging: z.string().optional(),
  packageCount: z.number().optional(),
  grossWeight: z.number().optional(),
  netWeight: z.number().optional(),
  cifValue: z.number().optional(),
  cifCurrency: z.string().optional(),
  fobValue: z.number().optional(),
  freightValue: z.number().optional(),
  insuranceValue: z.number().optional(),
  blNumber: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  eta: z.string().optional(),
  supplierName: z.string().optional(),
  supplierCountry: z.string().optional(),
  customsRegime: z.enum(['IM4', 'IM5', 'IM6', 'IM7', 'EX1', 'EX2', 'TR']).optional(),
  ddiNumber: z.string().optional(),
  containers: z.array(z.object({
    number: z.string(),
    type: z.string(),
    sealNumber: z.string().optional(),
    grossWeight: z.number().optional(),
    packageCount: z.number().optional(),
    description: z.string().optional(),
    temperature: z.number().optional(),
  })).optional(),
});

// Helper
const generateTrackingNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TR-${timestamp}-${random}`;
};

// ============================================
// GET /api/shipments
// ============================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { companyId: req.user!.companyId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search as string, mode: 'insensitive' } },
        { blNumber: { contains: search as string, mode: 'insensitive' } },
        { clientName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          containers: true,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { documents: true, expenses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        shipments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    log.error('Get shipments error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/shipments/stats
// ============================================

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const [total, pending, delivered, expenses] = await Promise.all([
      prisma.shipment.count({ where: { companyId } }),
      prisma.shipment.count({ where: { companyId, status: 'PENDING' } }),
      prisma.shipment.count({ where: { companyId, status: 'DELIVERED' } }),
      prisma.expense.groupBy({
        by: ['type', 'paid'],
        where: { shipment: { companyId } },
        _sum: { amount: true },
      }),
    ]);

    const inProgress = await prisma.shipment.count({
      where: {
        companyId,
        status: {
          in: ['ARRIVED', 'DDI_OBTAINED', 'DECLARATION_FILED', 'LIQUIDATION_ISSUED', 
               'CUSTOMS_PAID', 'BAE_ISSUED', 'TERMINAL_PAID', 'DO_RELEASED', 
               'EXIT_NOTE_ISSUED', 'IN_DELIVERY'],
        },
      },
    });

    // Calculate finance
    let totalProvisions = 0;
    let totalDisbursements = 0;
    let paidDisbursements = 0;

    for (const e of expenses) {
      const amount = e._sum.amount || 0;
      if (e.type === 'PROVISION') {
        totalProvisions += amount;
      } else {
        totalDisbursements += amount;
        if (e.paid) paidDisbursements += amount;
      }
    }

    const recentShipments = await prisma.shipment.findMany({
      where: { companyId },
      include: { containers: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      success: true,
      data: {
        stats: {
          shipments: { total, pending, inProgress, delivered, thisMonth: total },
          finance: {
            totalProvisions,
            totalDisbursements,
            balance: totalProvisions - paidDisbursements,
            unpaid: totalDisbursements - paidDisbursements,
          },
          containers: { total: 0, atPort: 0, inTransit: 0, delivered: 0 },
          recentShipments,
          alerts: [],
        },
      },
    });
  } catch (error) {
    log.error('Get stats error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/shipments/:id
// ============================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const shipment = await prisma.shipment.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        containers: true,
        documents: { orderBy: { createdAt: 'desc' } },
        expenses: { orderBy: { createdAt: 'desc' } },
        timeline: { orderBy: { date: 'desc' } },
        createdBy: { select: { id: true, name: true } },
        client: true,
      },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé',
      });
    }

    res.json({ success: true, data: { shipment } });
  } catch (error) {
    log.error('Get shipment error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/shipments
// ============================================

router.post('/', requireAgent, async (req: Request, res: Response) => {
  try {
    const data = createShipmentSchema.parse(req.body);
    const trackingNumber = generateTrackingNumber();

    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber,
        companyId: req.user!.companyId,
        createdById: req.user!.id,
        clientName: data.clientName,
        clientNif: data.clientNif,
        clientPhone: data.clientPhone,
        clientAddress: data.clientAddress,
        description: data.description,
        hsCode: data.hsCode,
        packaging: data.packaging,
        packageCount: data.packageCount,
        grossWeight: data.grossWeight,
        netWeight: data.netWeight,
        cifValue: data.cifValue,
        cifCurrency: data.cifCurrency || 'USD',
        fobValue: data.fobValue,
        freightValue: data.freightValue,
        insuranceValue: data.insuranceValue,
        blNumber: data.blNumber,
        vesselName: data.vesselName,
        voyageNumber: data.voyageNumber,
        portOfLoading: data.portOfLoading,
        portOfDischarge: data.portOfDischarge || 'CONAKRY',
        eta: data.eta ? new Date(data.eta) : undefined,
        supplierName: data.supplierName,
        supplierCountry: data.supplierCountry,
        customsRegime: data.customsRegime as any || 'IM4',
        ddiNumber: data.ddiNumber,
        containers: data.containers && data.containers.length > 0 ? {
          create: data.containers.map(c => ({
            number: c.number,
            type: c.type as any || 'DRY_40HC',
            sealNumber: c.sealNumber,
            grossWeight: c.grossWeight,
            packageCount: c.packageCount,
            description: c.description,
            temperature: c.temperature,
          })),
        } : undefined,
        timeline: {
          create: {
            action: 'Dossier créé',
            userId: req.user!.id,
            userName: req.user!.name,
          },
        },
      },
      include: { containers: true },
    });

    log.audit('Shipment created', { shipmentId: shipment.id, trackingNumber });

    res.status(201).json({ success: true, data: { shipment } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    log.error('Create shipment error', error);
    res.status(500).json({ success: false, message: 'Erreur de création' });
  }
});

// ============================================
// PATCH /api/shipments/:id
// ============================================

router.patch('/:id', requireAgent, async (req: Request, res: Response) => {
  try {
    const shipment = await prisma.shipment.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé',
      });
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        eta: req.body.eta ? new Date(req.body.eta) : undefined,
        ata: req.body.ata ? new Date(req.body.ata) : undefined,
        deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : undefined,
      },
      include: { containers: true },
    });

    // Add timeline event for status change
    if (req.body.status && req.body.status !== shipment.status) {
      await prisma.timelineEvent.create({
        data: {
          shipmentId: shipment.id,
          action: `Statut changé: ${req.body.status}`,
          userId: req.user!.id,
          userName: req.user!.name,
        },
      });
    }

    log.audit('Shipment updated', { shipmentId: shipment.id });

    res.json({ success: true, data: { shipment: updated } });
  } catch (error) {
    log.error('Update shipment error', error);
    res.status(500).json({ success: false, message: 'Erreur de mise à jour' });
  }
});

// ============================================
// DELETE /api/shipments/:id
// ============================================

router.delete('/:id', requireAgent, async (req: Request, res: Response) => {
  try {
    const shipment = await prisma.shipment.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé',
      });
    }

    // Archive instead of delete
    await prisma.shipment.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
    });

    log.audit('Shipment archived', { shipmentId: shipment.id });

    res.json({ success: true, message: 'Dossier archivé' });
  } catch (error) {
    log.error('Delete shipment error', error);
    res.status(500).json({ success: false, message: 'Erreur de suppression' });
  }
});

// ============================================
// POST /api/shipments/:id/documents
// ============================================

router.post('/:id/documents', requireAgent, async (req: Request, res: Response) => {
  try {
    const { name, type, url, reference, issueDate } = req.body;

    if (!name || !type || !url) {
      return res.status(400).json({
        success: false,
        message: 'Nom, type et URL requis',
      });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé',
      });
    }

    const document = await prisma.document.create({
      data: {
        shipmentId: shipment.id,
        name,
        type,
        url,
        reference,
        issueDate: issueDate ? new Date(issueDate) : undefined,
      },
    });

    log.audit('Document added', { shipmentId: shipment.id, documentId: document.id });

    res.status(201).json({ success: true, data: { document } });
  } catch (error) {
    log.error('Add document error', error);
    res.status(500).json({ success: false, message: 'Erreur d\'ajout' });
  }
});

// ============================================
// DELETE /api/shipments/:id/documents/:docId
// ============================================

router.delete('/:id/documents/:docId', requireAgent, async (req: Request, res: Response) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.docId,
        shipment: { id: req.params.id, companyId: req.user!.companyId },
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    await prisma.document.delete({ where: { id: document.id } });

    log.audit('Document deleted', { documentId: document.id });

    res.json({ success: true });
  } catch (error) {
    log.error('Delete document error', error);
    res.status(500).json({ success: false, message: 'Erreur de suppression' });
  }
});

export default router;
