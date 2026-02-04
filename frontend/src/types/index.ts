// src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  company: Company;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
}

export type Role = 'DIRECTOR' | 'ACCOUNTANT' | 'AGENT' | 'CLIENT';

export interface Shipment {
  id: string;
  trackingNumber: string;
  blNumber?: string;
  doNumber?: string;
  declarationNumber?: string;
  liquidationNumber?: string;
  quittanceNumber?: string;
  ddiNumber?: string;
  baeNumber?: string;
  bsNumber?: string;
  clientName: string;
  clientNif?: string;
  clientPhone?: string;
  clientAddress?: string;
  description: string;
  hsCode?: string;
  packaging?: string;
  packageCount?: number;
  grossWeight?: number;
  netWeight?: number;
  cifValue?: number;
  cifCurrency?: string;
  exchangeRate?: number;
  cifValueGnf?: number;
  fobValue?: number;
  freightValue?: number;
  insuranceValue?: number;
  containers: Container[];
  vesselName?: string;
  voyageNumber?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  eta?: string;
  ata?: string;
  manifestNumber?: string;
  manifestYear?: number;
  supplierName?: string;
  supplierCountry?: string;
  customsRegime?: CustomsRegime;
  customsOffice?: string;
  customsOfficeName?: string;
  declarantCode?: string;
  declarantName?: string;
  circuit?: Circuit;
  dutyDD?: number;
  dutyRTL?: number;
  dutyTVA?: number;
  dutyPC?: number;
  dutyCA?: number;
  dutyBFU?: number;
  totalDuties?: number;
  deliveryPlace?: string;
  deliveryDate?: string;
  deliveryDriver?: string;
  deliveryPhone?: string;
  deliveryTruck?: string;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
  documents: Document[];
  expenses: Expense[];
  timeline?: TimelineEvent[];
  createdBy: { id: string; name: string };
}

export interface Container {
  id: string;
  number: string;
  type: ContainerType;
  sealNumber?: string;
  grossWeight?: number;
  packageCount?: number;
  description?: string;
  temperature?: number;
}

export type ContainerType = 
  | 'DRY_20' | 'DRY_40' | 'DRY_40HC'
  | 'REEFER_20' | 'REEFER_40' | 'REEFER_40HR'
  | 'OPEN_TOP_20' | 'OPEN_TOP_40'
  | 'FLAT_RACK_20' | 'FLAT_RACK_40';

export type CustomsRegime = 'IM4' | 'IM5' | 'IM6' | 'IM7' | 'EX1' | 'EX2' | 'TR';
export type Circuit = 'GREEN' | 'YELLOW' | 'RED';

export type ShipmentStatus = 
  | 'DRAFT' | 'PENDING' | 'ARRIVED' | 'DDI_OBTAINED'
  | 'DECLARATION_FILED' | 'LIQUIDATION_ISSUED' | 'CUSTOMS_PAID'
  | 'BAE_ISSUED' | 'TERMINAL_PAID' | 'DO_RELEASED'
  | 'EXIT_NOTE_ISSUED' | 'IN_DELIVERY' | 'DELIVERED'
  | 'INVOICED' | 'CLOSED' | 'ARCHIVED';

export interface Document {
  id: string;
  type: DocumentType;
  name: string;
  url: string;
  reference?: string;
  issueDate?: string;
  createdAt: string;
}

export type DocumentType = 
  | 'BL' | 'INVOICE' | 'PACKING_LIST' | 'DDI'
  | 'PHYTO_CERT' | 'ORIGIN_CERT' | 'EUR1'
  | 'TRANSIT_ORDER' | 'DECLARATION' | 'LIQUIDATION'
  | 'QUITTANCE' | 'BAE' | 'DO' | 'EXIT_NOTE'
  | 'EIR' | 'TERMINAL_INVOICE' | 'TERMINAL_RECEIPT'
  | 'MSC_INVOICE' | 'DELIVERY_NOTE' | 'CUSTOMS_INVOICE' | 'OTHER';

export interface Expense {
  id: string;
  type: ExpenseType;
  category: ExpenseCategory;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  reference?: string;
  supplier?: string;
  paid: boolean;
  paidAt?: string;
  createdAt: string;
}

export type ExpenseType = 'PROVISION' | 'DISBURSEMENT';

export type ExpenseCategory = 
  | 'DD' | 'TVA' | 'RTL' | 'PC' | 'CA' | 'BFU' | 'DDI_FEE'
  | 'ACCONAGE' | 'BRANCHEMENT' | 'SURESTARIES' | 'MANUTENTION'
  | 'PASSAGE_TERRE' | 'RELEVAGE' | 'SECURITE_TERMINAL'
  | 'DO_FEE' | 'SEAWAY_BILL' | 'MANIFEST_FEE' | 'CONTAINER_DAMAGE'
  | 'SECURITE_MSC' | 'SURCHARGE' | 'PAC' | 'ADP_FEE'
  | 'TRANSPORT' | 'TRANSPORT_ADD'
  | 'HONORAIRES' | 'COMMISSION'
  | 'ASSURANCE' | 'MAGASINAGE' | 'SCANNER' | 'ESCORTE' | 'AUTRE';

export interface TimelineEvent {
  id: string;
  action: string;
  description?: string;
  date: string;
  userName?: string;
}

export interface DashboardStats {
  shipments: {
    total: number;
    pending: number;
    inProgress: number;
    delivered: number;
    thisMonth: number;
  };
  finance: {
    totalProvisions: number;
    totalDisbursements: number;
    balance: number;
    unpaid: number;
  };
  containers: {
    total: number;
    atPort: number;
    inTransit: number;
    delivered: number;
  };
  recentShipments: Shipment[];
  alerts: Array<{
    id: string;
    type: string;
    message: string;
    shipmentId?: string;
  }>;
}
