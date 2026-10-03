import { Branch, Category, Product, InventoryLevel, User, FiscalConfig, BankCard, Currency } from '../types';

// Initial store data kept separate from store behavior.
export const INITIAL_USERS: User[] = [
  {
    id: 'admin-1',
    name: 'Administrador Cristian',
    email: 'cristianmarco2003@gmail.com',
    role: 'admin',
    password: '03111166702',
    baseSalary: 0,
    salesGoal: 0,
    branchId: '',
    allowedBranches: [],
    permissions: ['pos_access', 'reports_access', 'inventory_access', 'admin_access', 'cash_audit'],
    isActive: true
  },
  {
    id: 'employee-1',
    name: 'Trabajador',
    email: 'trabajador@gmail.com',
    role: 'employee',
    password: '03111166702',
    baseSalary: 0,
    salesGoal: 0,
    branchId: '',
    allowedBranches: [],
    permissions: ['pos_access'],
    isActive: true
  }
];

export const INITIAL_BRANCHES: Branch[] = [];

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_INVENTORY: InventoryLevel[] = [];

export const INITIAL_BANK_CARDS: BankCard[] = [];

export const INITIAL_FISCAL_CONFIGS: FiscalConfig[] = [
  { id: crypto.randomUUID(), type: 'B01', name: 'Crédito Fiscal', prefix: 'B01', current: 1, limit: 1000, active: true },
  { id: crypto.randomUUID(), type: 'B02', name: 'Consumo', prefix: 'B02', current: 1, limit: 10000, active: true },
];

export const BASE_CURRENCY_CODE = import.meta.env.VITE_BASE_CURRENCY || 'CUP';

export const INITIAL_CURRENCIES: Currency[] = [
  { 
    code: 'CUP', 
    name: 'Peso Cubano', 
    symbol: '$', 
    rateToBase: 1, 
    isBase: true 
  },
  { 
    code: 'USD', 
    name: 'Dólar Estadounidense', 
    symbol: '$', 
    rateToBase: 320, 
    isBase: false 
  },
  { 
    code: 'EUR', 
    name: 'Euro', 
    symbol: '€', 
    rateToBase: 350, 
    isBase: false 
  }
];


