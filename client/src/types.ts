export interface Product {
  _id: string;
  name: string;
  category: 'Birthday Cakes' | 'Wedding Cakes' | 'Cup Cakes' | 'Pastries' | 'Brownies' | 'Cookies' | 'Veg Snacks' | 'Non-Veg Snacks' | 'Hot Drinks' | 'Cold Drinks' | 'Combos';
  price: number;
  image: string;
  estimatedPrepTime: number;
  isBestseller?: boolean;
  isTrending?: boolean;
  isOffer?: boolean;
  discountPrice?: number;
  isChefRecommended?: boolean;
  inStock: boolean;
}

export interface OrderItem {
  _id: string;
  product: Product;
  quantity: number;
  instructions: string;
  category: 'Cake' | 'Snack' | 'Drink';
  status: 'pending' | 'accepted' | 'preparing' | 'decorating' | 'quality_check' | 'ready' | 'delivered';
}

export interface Order {
  _id: string;
  tableNumber: number;
  customerName: string;
  items: OrderItem[];
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled';
  chefNotes?: string;
  rejectionReason?: 'Out of Stock' | 'Machine Issue' | 'Kitchen Busy' | 'Ingredient Missing' | '';
  estimatedCompletionTime?: string;
  totalAmount: number;
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod: 'Cash' | 'UPI' | 'Credit Card' | 'Debit Card' | 'Split';
  preparationTimerStartedAt?: string;
  createdAt: string;
}

export interface InventoryItem {
  _id: string;
  name: 'Flour' | 'Chocolate' | 'Cream' | 'Milk' | 'Sugar' | 'Eggs' | 'Butter' | 'Cheese';
  quantity: number;
  unit: string;
  minThreshold: number;
  lastUpdated: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'cake_chef' | 'snacks_chef' | 'waiter' | 'cashier' | 'customer';
  tableNumber?: number;
}

export type TableStatus = 
  | 'Available'
  | 'Occupied'
  | 'Ordering'
  | 'Order Confirmed'
  | 'Preparing'
  | 'Ready To Serve'
  | 'Serving'
  | 'Payment Pending'
  | 'Completed'
  | 'Cleaning';

export interface SmartTable {
  _id: string;
  tableNumber: number;
  qrCodeId: string;
  qrCodeDataUrl: string;
  securityToken: string;
  targetUrl: string;
  status: TableStatus;
  currentOrderId?: string;
  currentOrderNumber?: string;
  customerCount: number;
  currentBill: number;
  capacity: number;
  sessionStartedAt?: string;
  elapsedTimeMins?: number;
  estimatedRemainingMins?: number;
  orderProgress: number;
  paymentStatus: 'Unpaid' | 'Pending' | 'Paid';
  waiterAssigned: string;
  history?: Array<{
    orderId: string;
    customerName: string;
    totalAmount: number;
    completedAt: string;
  }>;
}

export interface AIPredictions {
  peakHour: string;
  aiPrepTimes: {
    Cake: number;
    Snack: number;
    Drink: number;
  };
  tomorrowDemand: {
    predictedOrders: number;
    confidence: string;
    demandFactor: string;
  };
  bestSellingForecast: {
    cake: string;
    snack: string;
  };
  inventoryForecast: Array<{
    name: string;
    currentStock: number;
    unit: string;
    dailyUsage: number;
    daysRemaining: number;
    status: 'Critical' | 'Warning' | 'Healthy';
  }>;
  autoMenuRecommendations: Array<{
    name: string;
    category: string;
    price: number;
    image: string;
  }>;
  smartCombos: Array<{
    name: string;
    items: string[];
    originalPrice: number;
    comboPrice: number;
    discount: number;
    reason: string;
  }>;
}
