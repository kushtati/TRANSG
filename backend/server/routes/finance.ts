// server/routes/finance.ts

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { log } from '../config/logger.js';
import { auth, requireAccountant } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Validation schemas
const createExpenseSchema = z.object({
  shipmentId: z.string(),
  type: z.enum(['PROVISION', 'DISBURSEMENT']),
  category: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  reference: z.string().optional(),
  supplier: z.string().optional(),
});

// ============================================
// GET /api/finance/expenses
// ============================================

router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const { shipmentId, category, paid, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      shipment: { companyId: req.user!.companyId },
    };

    if (shipmentId) where.shipmentId = shipmentId;
    if (category) where.category = category;
    if (paid !== undefined) where.paid = paid === 'true';

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          shipment: { select: { trackingNumber: true, clientName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        expenses,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    log.error('Get expenses error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/finance/summary
// ============================================

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const expenses = await prisma.expense.findMany({
      where: { shipment: { companyId } },
      select: { type: true, category: true, amount: true, paid: true },
    });

    let totalProvisions = 0;
    let totalDisbursements = 0;
    let paidDisbursements = 0;
    const byCategory: Record<string, number> = {};

    for (const e of expenses) {
      if (e.type === 'PROVISION') {
        totalProvisions += e.amount;
      } else {
        totalDisbursements += e.amount;
        if (e.paid) paidDisbursements += e.amount;
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      }
    }

    res.json({
      success: true,
      data: {
        totalProvisions,
        totalDisbursements,
        paidDisbursements,
        unpaidDisbursements: totalDisbursements - paidDisbursements,
        balance: totalProvisions - paidDisbursements,
        byCategory,
      },
    });
  } catch (error) {
    log.error('Get summary error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/finance/shipment/:shipmentId
// ============================================

router.get('/shipment/:shipmentId', async (req: Request, res: Response) => {
  try {
    const shipment = await prisma.shipment.findFirst({
      where: { id: req.params.shipmentId, companyId: req.user!.companyId },
      include: { expenses: true },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé',
      });
    }

    let provisions = 0;
    let disbursements = 0;
    let paid = 0;

    for (const e of shipment.expenses) {
      if (e.type === 'PROVISION') {
        provisions += e.amount;
      } else {
        disbursements += e.amount;
        if (e.paid) paid += e.amount;
      }
    }

    res.json({
      success: true,
      data: {
        provisions,
        disbursements,
        paid,
        unpaid: disbursements - paid,
        balance: provisions - paid,
        expenses: shipment.expenses,
      },
    });
  } catch (error) {
    log.error('Get shipment finance error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/finance/expenses
// ============================================

router.post('/expenses', requireAccountant, async (req: Request, res: Response) => {
  try {
    const data = createExpenseSchema.parse(req.body);

    // Verify shipment belongs to company
    const shipment = await prisma.shipment.findFirst({
      where: { id: data.shipmentId, companyId: req.user!.companyId },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé',
      });
    }

    const expense = await prisma.expense.create({
      data: {
        shipmentId: data.shipmentId,
        type: data.type,
        category: data.category as any,
        description: data.description,
        amount: data.amount,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        reference: data.reference,
        supplier: data.supplier,
      },
    });

    log.audit('Expense created', { expenseId: expense.id, shipmentId: shipment.id });

    res.status(201).json({ success: true, data: { expense } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    log.error('Create expense error', error);
    res.status(500).json({ success: false, message: 'Erreur de création' });
  }
});

// ============================================
// PATCH /api/finance/expenses/:id
// ============================================

router.patch('/expenses/:id', requireAccountant, async (req: Request, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        shipment: { companyId: req.user!.companyId },
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Dépense non trouvée',
      });
    }

    const updateData: any = { ...req.body };
    
    // If marking as paid, set paidAt
    if (req.body.paid === true && !expense.paid) {
      updateData.paidAt = new Date();
    }

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: updateData,
    });

    log.audit('Expense updated', { expenseId: expense.id });

    res.json({ success: true, data: { expense: updated } });
  } catch (error) {
    log.error('Update expense error', error);
    res.status(500).json({ success: false, message: 'Erreur de mise à jour' });
  }
});

// ============================================
// POST /api/finance/expenses/:id/pay
// ============================================

router.post('/expenses/:id/pay', requireAccountant, async (req: Request, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        shipment: { companyId: req.user!.companyId },
      },
      include: { shipment: { include: { expenses: true } } },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Dépense non trouvée',
      });
    }

    if (expense.paid) {
      return res.status(400).json({
        success: false,
        message: 'Dépense déjà payée',
      });
    }

    // Check balance for disbursements
    if (expense.type === 'DISBURSEMENT') {
      let provisions = 0;
      let paidDisbursements = 0;

      for (const e of expense.shipment.expenses) {
        if (e.type === 'PROVISION') {
          provisions += e.amount;
        } else if (e.paid) {
          paidDisbursements += e.amount;
        }
      }

      const balance = provisions - paidDisbursements;

      if (balance < expense.amount) {
        return res.status(400).json({
          success: false,
          message: `Solde insuffisant (${balance.toLocaleString()} GNF disponible)`,
        });
      }
    }

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { paid: true, paidAt: new Date() },
    });

    log.audit('Expense paid', { expenseId: expense.id, amount: expense.amount });

    res.json({ success: true, data: { expense: updated } });
  } catch (error) {
    log.error('Pay expense error', error);
    res.status(500).json({ success: false, message: 'Erreur de paiement' });
  }
});

// ============================================
// DELETE /api/finance/expenses/:id
// ============================================

router.delete('/expenses/:id', requireAccountant, async (req: Request, res: Response) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        shipment: { companyId: req.user!.companyId },
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Dépense non trouvée',
      });
    }

    if (expense.paid) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une dépense payée',
      });
    }

    await prisma.expense.delete({ where: { id: expense.id } });

    log.audit('Expense deleted', { expenseId: expense.id });

    res.json({ success: true });
  } catch (error) {
    log.error('Delete expense error', error);
    res.status(500).json({ success: false, message: 'Erreur de suppression' });
  }
});

export default router;
