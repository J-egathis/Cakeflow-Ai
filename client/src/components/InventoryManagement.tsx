import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '../types';
import { inventoryApi, getSocket } from '../services/api';
import {
  Package, Plus, RefreshCw, Edit2, Trash2,
  AlertTriangle, CheckCircle, DollarSign, Utensils,
  RotateCcw, Flame, Scale, ArrowUpRight, ArrowDownRight, X, Search, Check
} from 'lucide-react';

interface LinkedFoodEntry {
  productId: number | null;
  name: string;
  price: number;
}

interface SoldBreakdownEntry {
  count: number;
  revenue: number;
}

interface InventoryItem {
  _id: string;
  id?: number;
  name: string;
  initialQuantity: number;
  quantity: number;
  unit: string;
  minThreshold: number;
  purchaseCost: number;
  linkedProductId: number | null;
  linkedProductName: string;
  linkedProducts?: LinkedFoodEntry[] | string;
  expectedUnits: number;
  soldUnits: number;
  salesRevenue: number;
  soldBreakdown?: Record<string, SoldBreakdownEntry> | string;
  wastageCost: number;
  lastUpdated: string;
}

interface InventoryManagementProps {
  allProducts: Product[];
  addToast: (message: string, type?: 'info' | 'success' | 'danger') => void;
}

const parseJsonSafe = <T,>(val: any, fallback: T): T => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val as T;
};

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ allProducts, addToast }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form states
  const [name, setName] = useState<string>('');
  const [initialQuantity, setInitialQuantity] = useState<string>('10');
  const [quantity, setQuantity] = useState<string>('10');
  const [unit, setUnit] = useState<string>('kg');

  const initialDefaultUnits = [
    { value: 'kg', label: 'kg (Kilograms)' },
    { value: 'g', label: 'g (Grams)' },
    { value: 'L', label: 'L (Liters)' },
    { value: 'ml', label: 'ml (Milliliters)' },
    { value: 'pcs', label: 'pcs (Pieces)' },
    { value: 'packets', label: 'packets (Packets)' },
    { value: 'boxes', label: 'boxes (Boxes)' },
    { value: 'bags', label: 'bags (Bags)' },
    { value: 'bottles', label: 'bottles (Bottles)' },
    { value: 'trays', label: 'trays (Trays)' },
    { value: 'cans', label: 'cans (Cans)' },
    { value: 'dozen', label: 'dozen (Dozen)' },
  ];

  const [unitOptions, setUnitOptions] = useState<Array<{ value: string; label: string }>>(() => {
    try {
      const savedV1 = localStorage.getItem('inventory_units_list_v1');
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const legacyCustom = localStorage.getItem('custom_inventory_units');
      if (legacyCustom) {
        const legacyArr: string[] = JSON.parse(legacyCustom);
        const merged = [...initialDefaultUnits];
        legacyArr.forEach(cu => {
          if (cu && !merged.some(m => m.value.toLowerCase() === cu.toLowerCase())) {
            merged.push({ value: cu, label: cu });
          }
        });
        localStorage.setItem('inventory_units_list_v1', JSON.stringify(merged));
        return merged;
      }
    } catch {}
    return initialDefaultUnits;
  });

  const saveUnitOptions = (nextList: Array<{ value: string; label: string }>) => {
    setUnitOptions(nextList);
    try {
      localStorage.setItem('inventory_units_list_v1', JSON.stringify(nextList));
    } catch {}
  };

  const [showAddUnitInput, setShowAddUnitInput] = useState<boolean>(false);
  const [newUnitInput, setNewUnitInput] = useState<string>('');
  const [showManageUnitsModal, setShowManageUnitsModal] = useState<boolean>(false);
  const [manageNewUnitName, setManageNewUnitName] = useState<string>('');
  const [editingUnitIndex, setEditingUnitIndex] = useState<number | null>(null);
  const [editingUnitText, setEditingUnitText] = useState<string>('');

  const [minThreshold, setMinThreshold] = useState<string>('2');
  const [purchaseCost, setPurchaseCost] = useState<string>('500');
  const [selectedFoods, setSelectedFoods] = useState<LinkedFoodEntry[]>([]);
  const [foodSearch, setFoodSearch] = useState<string>('');
  const [customFoodInput, setCustomFoodInput] = useState<string>('');
  const [expectedUnits, setExpectedUnits] = useState<string>('200');
  const [soldUnits, setSoldUnits] = useState<string>('0');
  const [salesRevenue, setSalesRevenue] = useState<string>('0');

  const handleAddCustomUnit = (rawText?: string) => {
    const trimmed = (rawText !== undefined ? rawText : newUnitInput).trim();
    if (!trimmed) return;
    const existing = unitOptions.find(
      u => u.value.toLowerCase() === trimmed.toLowerCase() || u.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (!existing) {
      const updated = [...unitOptions, { value: trimmed, label: trimmed }];
      saveUnitOptions(updated);
      setUnit(trimmed);
    } else {
      setUnit(existing.value);
    }
    setNewUnitInput('');
    setManageNewUnitName('');
    setShowAddUnitInput(false);
    addToast(`✅ Added unit "${trimmed}"`, 'success');
  };

  const handleRenameUnit = async (index: number) => {
    const trimmed = editingUnitText.trim();
    if (!trimmed) return;
    const oldOption = unitOptions[index];
    if (!oldOption) return;

    const newVal = trimmed.includes('(') ? trimmed.split('(')[0].trim() || trimmed : trimmed;
    const updated = unitOptions.map((u, i) =>
      i === index ? { value: newVal, label: trimmed } : u
    );
    saveUnitOptions(updated);

    if (unit === oldOption.value || unit === oldOption.label) {
      setUnit(newVal);
    }

    // Update any inventory items using the old unit name
    const affectedItems = items.filter(it => it.unit === oldOption.value || it.unit === oldOption.label);
    for (const it of affectedItems) {
      try {
        await inventoryApi.update(it._id, { unit: newVal });
      } catch {}
    }
    if (affectedItems.length > 0) {
      fetchInventory(true);
    }

    setEditingUnitIndex(null);
    setEditingUnitText('');
    addToast(`✏️ Unit updated to "${trimmed}"`, 'success');
  };

  const handleDeleteUnit = (index: number) => {
    const target = unitOptions[index];
    if (!target) return;
    if (unitOptions.length <= 1) {
      alert('At least one unit must remain in the list.');
      return;
    }
    const updated = unitOptions.filter((_, i) => i !== index);
    saveUnitOptions(updated);
    if (unit === target.value) {
      setUnit(updated[0]?.value || 'kg');
    }
    if (editingUnitIndex === index) {
      setEditingUnitIndex(null);
      setEditingUnitText('');
    }
    addToast(`🗑️ Deleted unit "${target.label}"`, 'danger');
  };

  const fetchInventory = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await inventoryApi.getAll();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    const socket = getSocket();
    const handleInvUpdate = () => {
      fetchInventory(true);
    };
    socket.on('inventory_updated', handleInvUpdate);
    socket.on('order_updated', handleInvUpdate);

    return () => {
      socket.off('inventory_updated', handleInvUpdate);
      socket.off('order_updated', handleInvUpdate);
    };
  }, []);

  const getItemLinkedFoods = (item: InventoryItem): LinkedFoodEntry[] => {
    const parsed = parseJsonSafe<LinkedFoodEntry[]>(item.linkedProducts, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(p => p && p.name);
    }
    if (item.linkedProductName) {
      return item.linkedProductName
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map((n, idx) => {
          const matchProd = allProducts.find(p => p.name.toLowerCase() === n.toLowerCase());
          return {
            productId: matchProd ? Number(matchProd._id) : (idx === 0 && item.linkedProductId ? Number(item.linkedProductId) : null),
            name: n,
            price: matchProd ? Number(matchProd.price) : 0
          };
        });
    }
    return [];
  };

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setInitialQuantity('10');
    setQuantity('10');
    setUnit('kg');
    setShowAddUnitInput(false);
    setNewUnitInput('');
    setMinThreshold('2');
    setPurchaseCost('500');
    setSelectedFoods([]);
    setFoodSearch('');
    setCustomFoodInput('');
    setExpectedUnits('200');
    setSoldUnits('0');
    setSalesRevenue('0');
    setShowModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setInitialQuantity(String(item.initialQuantity || item.quantity || 0));
    setQuantity(String(item.quantity || 0));
    const itemUnit = item.unit || 'kg';
    setUnit(itemUnit);
    if (
      itemUnit &&
      !unitOptions.some(u => u.value.toLowerCase() === itemUnit.toLowerCase() || u.label.toLowerCase() === itemUnit.toLowerCase())
    ) {
      saveUnitOptions([...unitOptions, { value: itemUnit, label: itemUnit }]);
    }
    setShowAddUnitInput(false);
    setNewUnitInput('');
    setMinThreshold(String(item.minThreshold || 1));
    setPurchaseCost(String(item.purchaseCost || 0));
    setSelectedFoods(getItemLinkedFoods(item));
    setFoodSearch('');
    setCustomFoodInput('');
    setExpectedUnits(String(item.expectedUnits || 0));
    setSoldUnits(String(item.soldUnits || 0));
    setSalesRevenue(String(item.salesRevenue || 0));
    setShowModal(true);
  };

  const toggleProductInSelection = (product: Product) => {
    const prodIdNum = Number(product._id);
    const exists = selectedFoods.some(
      f => (f.productId && f.productId === prodIdNum) || f.name.toLowerCase() === product.name.toLowerCase()
    );

    if (exists) {
      setSelectedFoods(prev =>
        prev.filter(f => !((f.productId && f.productId === prodIdNum) || f.name.toLowerCase() === product.name.toLowerCase()))
      );
    } else {
      const nextList = [
        ...selectedFoods,
        { productId: prodIdNum || null, name: product.name, price: Number(product.price) || 0 }
      ];
      setSelectedFoods(nextList);
      if (!name.trim() && nextList.length === 1) {
        setName(`${product.name} Raw Material`);
      }
    }
  };

  const handleAddCustomFoodName = () => {
    const trimmed = customFoodInput.trim();
    if (!trimmed) return;
    const exists = selectedFoods.some(f => f.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const matchProd = allProducts.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
      const nextList = [
        ...selectedFoods,
        {
          productId: matchProd ? Number(matchProd._id) : null,
          name: matchProd ? matchProd.name : trimmed,
          price: matchProd ? Number(matchProd.price) : 0
        }
      ];
      setSelectedFoods(nextList);
      if (!name.trim() && nextList.length === 1) {
        setName(`${trimmed} Raw Material`);
      }
    }
    setCustomFoodInput('');
  };

  const removeSelectedFood = (foodName: string) => {
    setSelectedFoods(prev => prev.filter(f => f.name.toLowerCase() !== foodName.toLowerCase()));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter the raw material name (e.g., Dosa Batter / Chappati Flour)');
      return;
    }

    setSaving(true);
    try {
      let resolvedUnit = unit || 'kg';
      if (showAddUnitInput && newUnitInput.trim()) {
        const trimmedUnit = newUnitInput.trim();
        resolvedUnit = trimmedUnit;
        if (
          !unitOptions.some(u => u.value.toLowerCase() === trimmedUnit.toLowerCase() || u.label.toLowerCase() === trimmedUnit.toLowerCase())
        ) {
          saveUnitOptions([...unitOptions, { value: trimmedUnit, label: trimmedUnit }]);
        }
        setUnit(trimmedUnit);
        setShowAddUnitInput(false);
        setNewUnitInput('');
      }

      const joinedNames = selectedFoods.map(f => f.name).join(', ');
      const firstId = selectedFoods.length > 0 ? selectedFoods[0].productId : null;

      const payload = {
        name: name.trim(),
        initialQuantity: parseFloat(initialQuantity) || 0,
        quantity: editingItem ? (parseFloat(quantity) || 0) : (parseFloat(initialQuantity) || 0),
        unit: resolvedUnit,
        minThreshold: parseFloat(minThreshold) || 1,
        purchaseCost: parseFloat(purchaseCost) || 0,
        linkedProductId: firstId,
        linkedProductName: joinedNames,
        linkedProducts: selectedFoods,
        expectedUnits: parseInt(expectedUnits) || 0,
        ...(editingItem ? {
          soldUnits: parseInt(soldUnits) || 0,
          salesRevenue: parseFloat(salesRevenue) || 0
        } : {})
      };

      if (editingItem) {
        await inventoryApi.update(editingItem._id, payload);
        addToast(`✅ Inventory "${payload.name}" updated with ${selectedFoods.length} linked food item(s)!`, 'success');
      } else {
        await inventoryApi.create(payload);
        addToast(`📦 New Inventory "${payload.name}" added and linked to ${selectedFoods.length || 0} food item(s)!`, 'success');
      }

      setShowModal(false);
      fetchInventory(true);
    } catch (err: any) {
      alert(err.message || 'Failed to save inventory item');
    } finally {
      setSaving(false);
    }
  };

  const handleNewBatch = async (item: InventoryItem) => {
    const targetBatchQty = item.initialQuantity > 0 ? item.initialQuantity : item.quantity;
    const confirmReset = window.confirm(
      `Start a fresh batch for "${item.name}" (${targetBatchQty} ${item.unit})?\n\nThis will refill stock to ${targetBatchQty} ${item.unit} and reset Sold Count & Item Breakdown to 0 for the new batch.`
    );
    if (!confirmReset) return;

    try {
      await inventoryApi.update(item._id, { action: 'new_batch' });
      addToast(`🔁 Fresh batch started for "${item.name}" (${targetBatchQty} ${item.unit})!`, 'success');
      fetchInventory(true);
    } catch (err: any) {
      alert(err.message || 'Failed to reset batch');
    }
  };

  const handleSyncToday = async (item: InventoryItem) => {
    try {
      await inventoryApi.update(item._id, { action: 'sync_today' });
      addToast(`🔄 Synced today's Ready & Paid orders for "${item.name}"!`, 'success');
      fetchInventory(true);
    } catch (err: any) {
      alert(err.message || 'Failed to sync today orders');
    }
  };

  const handleMarkWastage = async (item: InventoryItem) => {
    if (item.quantity <= 0) {
      alert('Remaining stock is already 0.');
      return;
    }
    const initQ = item.initialQuantity > 0 ? item.initialQuantity : item.quantity;
    const wastedVal = initQ > 0 ? ((item.quantity / initQ) * (item.purchaseCost || 0)) : 0;
    const confirmWaste = window.confirm(
      `Mark remaining ${item.quantity.toFixed(2)} ${item.unit} of "${item.name}" as Wastage / Loss (₹${wastedVal.toFixed(2)})?`
    );
    if (!confirmWaste) return;

    try {
      await inventoryApi.update(item._id, { action: 'mark_wastage' });
      addToast(`⚠️ Remaining ${item.quantity.toFixed(2)} ${item.unit} marked as Wastage Loss (₹${wastedVal.toFixed(2)}).`, 'danger');
      fetchInventory(true);
    } catch (err: any) {
      alert(err.message || 'Failed to mark wastage');
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}" from Inventory?`)) return;
    try {
      await inventoryApi.remove(item._id);
      setItems(prev => prev.filter(i => i._id !== item._id));
      addToast(`🗑️ Removed "${item.name}" from Inventory.`, 'danger');
    } catch (err: any) {
      alert(err.message || 'Failed to delete inventory item');
    }
  };

  // Overall Financial Summary Calculations
  const totalInvestment = items.reduce((sum, i) => sum + (Number(i.purchaseCost) || 0), 0);
  const totalSalesRevenue = items.reduce((sum, i) => sum + (Number(i.salesRevenue) || 0), 0);
  const totalWastage = items.reduce((sum, i) => sum + (Number(i.wastageCost) || 0), 0);
  const totalSoldItemsCount = items.reduce((sum, i) => sum + (Number(i.soldUnits) || 0), 0);

  // Cost of the portion of raw material actually used so far
  const totalUsedMaterialCost = items.reduce((sum, i) => {
    const cost = Number(i.purchaseCost) || 0;
    const exp = Number(i.expectedUnits) || 0;
    const sold = Number(i.soldUnits) || 0;
    if (exp > 0 && cost > 0) {
      return sum + (cost / exp) * sold;
    }
    return sum;
  }, 0);

  const earnedProfitOnSold = totalSalesRevenue - totalUsedMaterialCost - totalWastage;
  const netBatchProfitLoss = totalSalesRevenue - totalInvestment;

  // Live preview inside modal
  const modalInitQty = parseFloat(initialQuantity) || 0;
  const modalCost = parseFloat(purchaseCost) || 0;
  const modalExpUnits = parseInt(expectedUnits) || 0;
  const modalUsagePerUnit = (modalInitQty > 0 && modalExpUnits > 0) ? (modalInitQty / modalExpUnits) : 0;
  const modalCostPerUnit = (modalCost > 0 && modalExpUnits > 0) ? (modalCost / modalExpUnits) : 0;

  const filteredMenuProducts = allProducts.filter(p => {
    if (!foodSearch.trim()) return true;
    const q = foodSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
  });

  return (
    <div id="inventoryManagementPage" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#D1D5DB] p-4 sm:p-6 rounded-3xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5 w-full xl:w-auto min-w-0">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0">
            <Package size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base sm:text-xl font-black text-[#111827] flex items-center gap-2 flex-wrap">
                <span>Smart Inventory & Profit / Loss Tracker</span>
                <span className="text-[11px] sm:text-xs bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30 px-2.5 py-0.5 rounded-full font-extrabold">
                  Multi-Food Link & Auto Breakdown
                </span>
              </h2>
              <button
                onClick={() => fetchInventory()}
                className="sm:hidden p-2 rounded-xl bg-[#F9FAFB] hover:bg-violet-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] transition-colors cursor-pointer shrink-0"
                title="Refresh Inventory"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-[#4C1D95]' : ''} />
              </button>
            </div>
            <p className="text-xs text-[#4B5563] mt-1 font-medium">
              Link 1 or multiple food items (4–5+ items) to a single raw material batch and track item-wise sales & profit in real time.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            onClick={() => fetchInventory()}
            className="hidden sm:flex p-2.5 rounded-xl bg-[#F9FAFB] hover:bg-violet-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] transition-colors cursor-pointer shrink-0"
            title="Refresh Inventory"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#4C1D95]' : ''} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingUnitIndex(null);
              setEditingUnitText('');
              setShowManageUnitsModal(true);
            }}
            className="flex-1 sm:flex-none bg-violet-50 hover:bg-violet-100 text-[#4C1D95] border border-violet-200 font-extrabold text-xs px-4 py-3 sm:py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            title="Rename or Delete Inventory Units"
          >
            <Scale size={15} />
            <span>Manage Units</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-none bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs px-5 py-3 sm:py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#4C1D95]/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus size={15} />
            <span>Add Material / Stock</span>
          </button>
        </div>
      </div>

      {/* Top Financial & Stock Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D1D5DB] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#4B5563]">
            <span>Total Stock Cost</span>
            <span className="p-2 rounded-xl bg-violet-50 text-[#4C1D95] shrink-0"><DollarSign size={15} /></span>
          </div>
          <p className="text-2xl font-black text-[#111827] mt-2">₹{totalInvestment.toFixed(2)}</p>
          <p className="text-[11px] text-[#4B5563] mt-1 font-semibold">
            Used Material Cost: <span className="text-[#111827] font-bold">₹{totalUsedMaterialCost.toFixed(2)}</span>
          </p>
        </div>

        <div className="bg-white border border-[#D1D5DB] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#4B5563]">
            <span>Inventory Sales Revenue</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0"><Utensils size={15} /></span>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">₹{totalSalesRevenue.toFixed(2)}</p>
          <p className="text-[11px] text-[#4B5563] mt-1 font-semibold">
            Total Linked Items Sold: <span className="text-[#4C1D95] font-extrabold">{totalSoldItemsCount} Sold</span>
          </p>
        </div>

        <div className="bg-white border border-[#D1D5DB] p-4 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#4B5563]">
            <span>Sold Items Profit</span>
            <span className={`p-2 rounded-xl shrink-0 ${earnedProfitOnSold >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {earnedProfitOnSold >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            </span>
          </div>
          <p className={`text-2xl font-black mt-2 ${earnedProfitOnSold >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {earnedProfitOnSold >= 0 ? '+' : '-'}₹{Math.abs(earnedProfitOnSold).toFixed(2)}
          </p>
          <p className="text-[11px] text-[#4B5563] mt-1 font-semibold">
            Sales (₹{totalSalesRevenue.toFixed(0)}) − Used Cost (₹{totalUsedMaterialCost.toFixed(0)})
          </p>
        </div>

        <div className={`border p-4 rounded-2xl shadow-xs flex flex-col justify-between ${
          totalInvestment === 0 && totalSalesRevenue === 0
            ? 'bg-white border-[#D1D5DB]'
            : netBatchProfitLoss >= 0
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-rose-50/60 border-rose-300'
        }`}>
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#111827]">
            <span>Overall Batch Profit / Loss</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
              totalInvestment === 0 && totalSalesRevenue === 0
                ? 'bg-neutral-200 text-neutral-700'
                : netBatchProfitLoss >= 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
            }`}>
              {totalInvestment === 0 && totalSalesRevenue === 0
                ? 'NO COST SET'
                : netBatchProfitLoss >= 0
                  ? 'NET PROFIT'
                  : 'TO RECOVER'}
            </span>
          </div>
          <p className={`text-2xl font-black mt-2 ${
            totalInvestment === 0 && totalSalesRevenue === 0
              ? 'text-[#111827]'
              : netBatchProfitLoss >= 0
                ? 'text-emerald-700'
                : 'text-rose-700'
          }`}>
            {netBatchProfitLoss >= 0 ? '+' : '-'}₹{Math.abs(netBatchProfitLoss).toFixed(2)}
          </p>
          <p className="text-[11px] text-[#4B5563] mt-1 font-semibold">
            {totalInvestment === 0 && totalSalesRevenue === 0
              ? 'Add material purchase cost to track net recovery'
              : netBatchProfitLoss >= 0
                ? 'Full stock investment recovered + Net Profit!'
                : `Need ₹${Math.abs(netBatchProfitLoss).toFixed(2)} more sales to recover stock cost`}
          </p>
        </div>
      </div>

      {/* Inventory Items List */}
      {items.length === 0 ? (
        <div className="bg-white border border-[#D1D5DB] rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-[#4C1D95] flex items-center justify-center mx-auto">
            <Package size={28} />
          </div>
          <h3 className="text-base font-black text-[#111827]">No Raw Materials Added Yet</h3>
          <p className="text-xs text-[#4B5563] max-w-md mx-auto">
            Click <strong>"Add Material / Stock"</strong> to add a raw material, link 1 or multiple food items to it, and track item-wise sales & profit.
          </p>
          <button
            onClick={openAddModal}
            className="bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus size={15} />
            <span>Add First Raw Material</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {items.map((item) => {
            const initQty = Number(item.initialQuantity) || Number(item.quantity) || 0;
            const remQty = Number(item.quantity) || 0;
            const usedQty = Math.max(0, Number((initQty - remQty).toFixed(3)));
            const expUnits = Number(item.expectedUnits) || 0;
            const soldCount = Number(item.soldUnits) || 0;
            const remainingUnits = expUnits > 0 ? Math.max(0, expUnits - soldCount) : 0;
            const usagePerItem = (initQty > 0 && expUnits > 0) ? (initQty / expUnits) : 0;

            const cost = Number(item.purchaseCost) || 0;
            const revenue = Number(item.salesRevenue) || 0;
            const wastage = Number(item.wastageCost) || 0;
            const costPerUnit = (cost > 0 && expUnits > 0) ? (cost / expUnits) : 0;
            const usedMaterialCost = costPerUnit * soldCount;
            const soldItemsProfit = revenue - usedMaterialCost - wastage;
            const netBatchDiff = revenue - cost;
            const isNeutral = cost === 0 && revenue === 0;
            const isLowStock = remQty <= (Number(item.minThreshold) || 0);
            const stockPercent = initQty > 0 ? Math.min(100, Math.max(0, Math.round((remQty / initQty) * 100))) : 0;

            const linkedFoodsList = getItemLinkedFoods(item);
            const rawBreakdown = parseJsonSafe<Record<string, SoldBreakdownEntry>>(item.soldBreakdown, {});

            // Merge linked foods with any recorded breakdown entries so every linked food is visible
            const breakdownRows: Array<{ name: string; count: number; revenue: number }> = [];
            const seenNames = new Set<string>();

            for (const lf of linkedFoodsList) {
              const keyLower = lf.name.toLowerCase();
              if (seenNames.has(keyLower)) continue;
              seenNames.add(keyLower);

              // Find matching key in rawBreakdown (case-insensitive)
              const matchedKey = Object.keys(rawBreakdown).find(k => k.toLowerCase() === keyLower);
              const entry = matchedKey ? rawBreakdown[matchedKey] : null;
              breakdownRows.push({
                name: lf.name,
                count: entry ? Number(entry.count) || 0 : (linkedFoodsList.length === 1 ? soldCount : 0),
                revenue: entry ? Number(entry.revenue) || 0 : (linkedFoodsList.length === 1 ? revenue : 0)
              });
            }

            for (const [k, v] of Object.entries(rawBreakdown)) {
              if (!seenNames.has(k.toLowerCase())) {
                seenNames.add(k.toLowerCase());
                breakdownRows.push({
                  name: k,
                  count: Number(v?.count) || 0,
                  revenue: Number(v?.revenue) || 0
                });
              }
            }

            return (
              <div
                key={item._id}
                className="bg-white border border-[#D1D5DB] rounded-3xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3"
              >
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-[#111827]">{item.name}</h3>
                      {isLowStock && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1 shrink-0">
                          <AlertTriangle size={11} />
                          <span>LOW STOCK</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#4B5563] font-semibold mt-0.5">
                      {usagePerItem > 0
                        ? `1 Food Item uses ${usagePerItem >= 1 ? usagePerItem.toFixed(2) : (usagePerItem * (item.unit === 'kg' ? 1000 : 1)).toFixed(0)}${item.unit === 'kg' && usagePerItem < 1 ? 'g' : ' ' + item.unit} • Raw Cost: ₹${costPerUnit.toFixed(2)} / item`
                        : `Total Batch: ${initQty} ${item.unit} • Purchase Cost: ₹${cost.toFixed(2)}`}
                    </p>
                  </div>

                  {/* Quick Edit / Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl bg-[#F9FAFB] hover:bg-violet-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] transition-colors cursor-pointer"
                      title="Edit Material & Linked Foods"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-xl bg-[#F9FAFB] hover:bg-rose-50 text-[#4B5563] hover:text-rose-600 border border-[#D1D5DB] transition-colors cursor-pointer"
                      title="Delete Material"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar for Stock */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-extrabold">
                    <span className="text-[#4B5563]">
                      Used: <strong className="text-[#111827]">{usedQty} {item.unit}</strong> / {initQty} {item.unit}
                    </span>
                    <span className={isLowStock ? 'text-rose-600' : 'text-emerald-700'}>
                      Balance: {remQty.toFixed(2)} {item.unit} ({stockPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
                    <div
                      className={`h-full transition-all duration-500 ${isLowStock ? 'bg-rose-500' : 'bg-[#4C1D95]'}`}
                      style={{ width: `${stockPercent}%` }}
                    />
                  </div>
                </div>

                {/* 3-Box Metrics: Stock Balance | Sold Count | Profit & Loss */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
                  {/* Box 1: Stock Breakdown */}
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-2.5 flex flex-col justify-between h-full">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#4B5563] mb-1.5">
                      <Scale size={13} className="text-[#4C1D95] shrink-0" />
                      <span className="truncate">Stock Balance</span>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-[#4B5563]">Added:</span>
                        <span className="font-bold text-[#111827]">{initQty} {item.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#4B5563]">Used:</span>
                        <span className="font-bold text-[#4C1D95]">{usedQty} {item.unit}</span>
                      </div>
                      <div className="flex justify-between border-t border-neutral-200 pt-1 mt-1">
                        <span className="font-bold text-[#111827]">Balance:</span>
                        <span className={`font-black ${isLowStock ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {remQty.toFixed(2)} {item.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Box 2: Food Sold Count */}
                  <div className="bg-violet-50/60 border border-violet-200 rounded-2xl p-2.5 flex flex-col justify-between h-full">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#4C1D95] mb-1.5">
                      <Flame size={13} className="shrink-0" />
                      <span className="truncate">Sales & Capacity</span>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-[#4B5563]">Total Capacity:</span>
                        <span className="font-bold text-[#111827]">{expUnits > 0 ? `${expUnits} pcs` : 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-[#4C1D95]">Sold Now:</span>
                        <span className="font-black text-[#4C1D95]">{soldCount} Sold</span>
                      </div>
                      <div className="flex justify-between border-t border-violet-200 pt-1 mt-1">
                        <span className="text-[#4B5563] font-bold">Remaining:</span>
                        <span className="font-extrabold text-emerald-700">
                          {expUnits > 0 ? `${remainingUnits} Left` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Box 3: Profit & Loss */}
                  <div className={`border rounded-2xl p-2.5 flex flex-col justify-between h-full ${
                    isNeutral
                      ? 'bg-[#F9FAFB] border-[#E5E7EB]'
                      : netBatchDiff >= 0
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : 'bg-rose-50/70 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold mb-1.5">
                      <span className="text-[#111827] truncate">Profit / Loss</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        isNeutral
                          ? 'bg-neutral-200 text-neutral-700'
                          : netBatchDiff >= 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                      }`}>
                        {isNeutral ? 'NO COST' : netBatchDiff >= 0 ? 'PROFIT' : 'LOSS'}
                      </span>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-[#4B5563]">Cost / Sales:</span>
                        <span className="font-bold text-[#111827]">₹{cost.toFixed(0)} / ₹{revenue.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#4B5563]">Sold Margin:</span>
                        <span className={`font-extrabold ${soldItemsProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {soldItemsProfit >= 0 ? '+' : '-'}₹{Math.abs(soldItemsProfit).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-neutral-300 pt-1 mt-1">
                        <span className="font-bold text-[#111827]">Batch Net:</span>
                        <span className={`font-black ${
                          isNeutral ? 'text-[#111827]' : netBatchDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {netBatchDiff >= 0 ? '+' : '-'}₹{Math.abs(netBatchDiff).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Item-Wise Sales Breakdown Box (Shows how many of each linked food sold) */}
                {breakdownRows.length > 0 && (
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-[#4B5563]">
                      <span className="flex items-center gap-1.5">
                        <Utensils size={12} className="text-[#4C1D95]" />
                        <span>Item-Wise Sales Breakdown ({breakdownRows.length} Linked Food{breakdownRows.length > 1 ? 's' : ''})</span>
                      </span>
                      <span className="text-[#4C1D95] font-black">Total: {soldCount} Sold</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {breakdownRows.map((row, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${
                            row.count > 0
                              ? 'bg-white border-violet-200 shadow-2xs'
                              : 'bg-neutral-50 border-neutral-200 opacity-75'
                          }`}
                        >
                          <span className="font-bold text-[#111827] truncate pr-2">{row.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              row.count > 0 ? 'bg-[#4C1D95] text-white' : 'bg-neutral-200 text-neutral-600'
                            }`}>
                              {row.count} Sold
                            </span>
                            {row.revenue > 0 && (
                              <span className="font-extrabold text-emerald-700 text-[11px]">
                                ₹{row.revenue.toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Bottom Action Buttons (Responsive Grid on Phone, Single Row on Desktop) */}
                <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-2 pt-2 border-t border-[#E5E7EB] w-full">
                  <button
                    onClick={() => handleSyncToday(item)}
                    className="col-span-1 sm:flex-auto justify-center px-2 sm:px-2.5 py-2 sm:py-1.5 rounded-xl bg-violet-50 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white text-[10px] tracking-tight font-extrabold flex items-center gap-1 transition-colors cursor-pointer border border-violet-200 whitespace-nowrap"
                    title="Count any Ready/Paid orders from today that weren't counted yet"
                  >
                    <RefreshCw size={11} className="shrink-0" />
                    <span className="truncate">Sync Today's Ready/Paid</span>
                  </button>

                  <button
                    onClick={() => handleNewBatch(item)}
                    className="col-span-1 sm:flex-auto justify-center px-2 sm:px-2.5 py-2 sm:py-1.5 rounded-xl bg-[#F9FAFB] hover:bg-emerald-600 text-[#111827] hover:text-white text-[10px] tracking-tight font-extrabold flex items-center gap-1 transition-colors cursor-pointer border border-[#D1D5DB] whitespace-nowrap"
                    title="Refill stock and reset Sold Count to 0 for a new batch"
                  >
                    <RotateCcw size={11} className="shrink-0" />
                    <span className="truncate">New Batch / Refill</span>
                  </button>

                  <button
                    onClick={() => handleMarkWastage(item)}
                    disabled={remQty <= 0}
                    className={`col-span-2 sm:flex-auto justify-center px-2.5 py-2 sm:py-1.5 rounded-xl text-[10px] tracking-tight font-extrabold flex items-center transition-colors border whitespace-nowrap ${
                      remQty > 0
                        ? 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border-rose-200 cursor-pointer'
                        : 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                    }`}
                    title="Mark leftover stock as spoiled/wasted at end of day"
                  >
                    <span>{remQty > 0 ? 'Mark Remaining as Wastage' : 'No Stock Left'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Inventory Modal — Rendered in document.body Portal for 100% Full-Screen Center Alignment */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#D1D5DB] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden text-[#111827] my-auto">
            {/* Modal Header */}
            <div className="bg-[#4C1D95] text-white px-6 py-4 flex justify-between items-center relative shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 shrink-0">
                  <Package size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white">
                    {editingItem ? `Edit "${editingItem.name}"` : 'Add Raw Material & Link Menu Items'}
                  </h3>
                  <p className="text-[11px] text-violet-100 font-semibold">
                    Select 1 or multiple foods (4–5+ items) made from this raw material
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* 1. Multi-Select Menu Food Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-extrabold text-[#111827] leading-snug">
                    1. Link Menu Food Items (Select 1 or Multiple Foods)
                  </label>
                  <span className="inline-flex items-center justify-center text-[11px] font-black text-[#4C1D95] bg-violet-100 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    {selectedFoods.length} Selected
                  </span>
                </div>

                {/* Selected Food Chips */}
                {selectedFoods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-violet-50/70 border border-violet-200">
                    {selectedFoods.map((sf, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#4C1D95] text-white text-xs font-bold shadow-2xs"
                      >
                        <span>{sf.name}</span>
                        {sf.price > 0 && <span className="text-violet-200 text-[10px]">(₹{sf.price})</span>}
                        <button
                          type="button"
                          onClick={() => removeSelectedFood(sf.name)}
                          className="hover:bg-white/20 rounded-full p-0.5 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search & Multi-Checkbox Menu List */}
                <div className="border border-[#D1D5DB] rounded-2xl overflow-hidden bg-[#F9FAFB]">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E5E7EB] bg-white">
                    <Search size={14} className="text-[#4B5563] shrink-0" />
                    <input
                      type="text"
                      value={foodSearch}
                      onChange={(e) => setFoodSearch(e.target.value)}
                      placeholder="Search menu items to tick & link (e.g. Vada, Dosa, Cake)..."
                      className="w-full text-xs font-semibold text-[#111827] focus:outline-none"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredMenuProducts.map((p) => {
                      const isChecked = selectedFoods.some(
                        f => (f.productId && f.productId === Number(p._id)) || f.name.toLowerCase() === p.name.toLowerCase()
                      );
                      return (
                        <button
                          type="button"
                          key={p._id}
                          onClick={() => toggleProductInSelection(p)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer border ${
                            isChecked
                              ? 'bg-violet-100 border-[#4C1D95] text-[#4C1D95]'
                              : 'bg-white border-[#E5E7EB] text-[#111827] hover:border-violet-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isChecked ? 'bg-[#4C1D95] border-[#4C1D95] text-white' : 'border-neutral-300 bg-white'
                            }`}>
                              {isChecked && <Check size={11} />}
                            </div>
                            <span className="truncate">{p.name}</span>
                          </div>
                          <span className="text-[10px] font-extrabold text-[#4B5563] shrink-0">₹{p.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Custom Food Name Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFoodInput}
                    onChange={(e) => setCustomFoodInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomFoodName();
                      }
                    }}
                    placeholder="Or type custom Food Name & click Add..."
                    className="flex-1 h-9 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomFoodName}
                    className="px-3.5 h-9 rounded-xl bg-violet-100 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white text-xs font-extrabold transition-colors cursor-pointer shrink-0"
                  >
                    + Add Food
                  </button>
                </div>
              </div>

              {/* 2. Raw Material Name */}
              <div>
                <label className="block text-xs font-extrabold text-[#111827] mb-1.5">
                  2. Raw Material Name (e.g. Vada Batter / Chappati Flour) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Vada Batter / Dosa Maavu"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                />
              </div>

              {/* 3. Total Stock Quantity, Unit, and Total Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#111827] mb-1.5">
                    Total Stock *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={initialQuantity}
                    onChange={(e) => {
                      setInitialQuantity(e.target.value);
                      if (!editingItem) setQuantity(e.target.value);
                    }}
                    placeholder="10"
                    className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-extrabold text-[#111827]">
                      Unit
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddUnitInput(prev => !prev)}
                        className="text-[10px] font-extrabold text-[#4C1D95] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {showAddUnitInput ? 'Cancel' : '+ Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUnitIndex(null);
                          setEditingUnitText('');
                          setShowManageUnitsModal(true);
                        }}
                        className="text-[10px] font-extrabold text-[#4B5563] hover:text-[#4C1D95] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        Edit/Delete
                      </button>
                    </div>
                  </div>
                  {showAddUnitInput ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={newUnitInput}
                        onChange={(e) => setNewUnitInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomUnit();
                          }
                        }}
                        placeholder="e.g. tins, jars..."
                        className="w-full h-10 px-2.5 rounded-xl border border-[#4C1D95] bg-white text-xs font-bold text-[#111827] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomUnit()}
                        className="h-10 px-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold flex items-center justify-center shrink-0 cursor-pointer"
                        title="Save new unit"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={unit}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setShowAddUnitInput(true);
                        } else if (e.target.value === '__manage_units__') {
                          setEditingUnitIndex(null);
                          setEditingUnitText('');
                          setShowManageUnitsModal(true);
                        } else {
                          setUnit(e.target.value);
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                    >
                      {unitOptions.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="__add_new__">➕ Add New Unit...</option>
                      <option value="__manage_units__">⚙️ Edit / Delete Units...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#111827] mb-1.5">
                    Total Cost (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                    placeholder="500"
                    className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                </div>
              </div>

              {/* 4. Expected Output Count & Low Stock Alert */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#111827] mb-1.5">
                    Expected Food Count (pcs)
                  </label>
                  <input
                    type="number"
                    value={expectedUnits}
                    onChange={(e) => setExpectedUnits(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#111827] mb-1.5">
                    Low Stock Alert ({unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    placeholder="2"
                    className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                </div>
              </div>

              {/* Extra manual override fields when editing */}
              {editingItem && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E5E7EB]">
                  <div>
                    <label className="block text-[11px] font-extrabold text-[#4B5563] mb-1.5">
                      Balance ({unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-[#4B5563] mb-1.5">
                      Sold Count (pcs)
                    </label>
                    <input
                      type="number"
                      value={soldUnits}
                      onChange={(e) => setSoldUnits(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-[#4B5563] mb-1.5">
                      Sales Revenue (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={salesRevenue}
                      onChange={(e) => setSalesRevenue(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827]"
                    />
                  </div>
                </div>
              )}

              {/* Live Calculation Preview Box */}
              {modalInitQty > 0 && modalExpUnits > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3.5 text-xs space-y-1">
                  <div className="font-black text-[#4C1D95] flex items-center gap-1.5">
                    <CheckCircle size={14} />
                    <span>Smart Recipe Calculation Preview:</span>
                  </div>
                  <p className="text-[#111827] font-semibold">
                    • <strong>Each Linked Food Item</strong> uses{' '}
                    <strong>
                      {modalUsagePerUnit >= 1
                        ? `${modalUsagePerUnit.toFixed(2)} ${unit}`
                        : unit === 'kg'
                        ? `${(modalUsagePerUnit * 1000).toFixed(0)}g (${modalUsagePerUnit.toFixed(3)} kg)`
                        : `${modalUsagePerUnit.toFixed(3)} ${unit}`}
                    </strong>
                  </p>
                  <p className="text-[#111827] font-semibold">
                    • Raw Cost per item: <strong>₹{modalCostPerUnit.toFixed(2)}</strong>
                    {selectedFoods.length > 0 && (
                      <>
                        {' '}| Linked to <strong>{selectedFoods.length} Food Item(s)</strong> ({selectedFoods.map(f => f.name).join(', ')})
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#4B5563] hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save & Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Units (Add / Rename / Delete) Modal */}
      {showManageUnitsModal && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#D1D5DB] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-[#111827] my-auto">
            {/* Header */}
            <div className="bg-[#4C1D95] text-white px-5 py-4 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 border border-white/20 shrink-0">
                  <Scale size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                    Manage Inventory Units
                  </h3>
                  <p className="text-[11px] text-violet-100 font-semibold">
                    Add, rename, or delete stock measurement units
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManageUnitsModal(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add New Unit Row */}
              <div>
                <label className="block text-xs font-extrabold text-[#111827] mb-1.5">
                  Add New Unit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manageNewUnitName}
                    onChange={(e) => setManageNewUnitName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomUnit(manageNewUnitName);
                      }
                    }}
                    placeholder="e.g. tins, crates, bundles..."
                    className="flex-1 h-10 px-3 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomUnit(manageNewUnitName)}
                    className="h-10 px-4 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Add Unit</span>
                  </button>
                </div>
              </div>

              {/* Existing Units List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#111827]">
                    All Units ({unitOptions.length})
                  </span>
                  <span className="text-[10px] font-bold text-[#4B5563]">
                    Click Edit to rename or Trash to delete
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto border border-[#E5E7EB] rounded-2xl divide-y divide-[#F3F4F6] bg-[#F9FAFB]">
                  {unitOptions.map((opt, idx) => (
                    <div
                      key={`${opt.value}-${idx}`}
                      className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white hover:bg-violet-50/40 transition-colors"
                    >
                      {editingUnitIndex === idx ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            autoFocus
                            value={editingUnitText}
                            onChange={(e) => setEditingUnitText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRenameUnit(idx);
                              } else if (e.key === 'Escape') {
                                setEditingUnitIndex(null);
                                setEditingUnitText('');
                              }
                            }}
                            className="flex-1 h-8 px-2.5 rounded-lg border border-[#4C1D95] bg-white text-xs font-bold text-[#111827] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameUnit(idx)}
                            className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                            title="Save unit name"
                          >
                            <Check size={13} />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUnitIndex(null);
                              setEditingUnitText('');
                            }}
                            className="h-8 px-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[#4B5563] text-[11px] font-bold cursor-pointer shrink-0"
                            title="Cancel"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-violet-100 text-[#4C1D95] text-[11px] font-black shrink-0">
                              {opt.value}
                            </span>
                            <span className="text-xs font-bold text-[#111827] truncate">
                              {opt.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUnitIndex(idx);
                                setEditingUnitText(opt.label);
                              }}
                              className="p-1.5 rounded-lg bg-[#F9FAFB] hover:bg-violet-100 text-[#4B5563] hover:text-[#4C1D95] border border-[#E5E7EB] transition-colors cursor-pointer"
                              title={`Rename "${opt.label}"`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUnit(idx)}
                              className="p-1.5 rounded-lg bg-[#F9FAFB] hover:bg-rose-100 text-[#4B5563] hover:text-rose-600 border border-[#E5E7EB] transition-colors cursor-pointer"
                              title={`Delete "${opt.label}"`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowManageUnitsModal(false)}
                  className="px-5 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
