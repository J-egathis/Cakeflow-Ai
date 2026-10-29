import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Receipt,
  QrCode,
  Utensils,
  PackageCheck,
  Package,
  DollarSign,
  Wallet,
  Plus
} from 'lucide-react';

export interface MobileRadialMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  receptionOrdersCount?: number;
  allProductsCount?: number;
}

const TABS = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'reception', label: 'Billing', Icon: Receipt, countKey: 'reception' },
  { id: 'tables', label: 'Tables & QR', Icon: QrCode },
  { id: 'foods', label: 'Food Menu', Icon: Utensils, countKey: 'foods' },
  { id: 'sold_unsold', label: 'Sold & Unsold', Icon: PackageCheck },
  { id: 'inventory', label: 'Inventory', Icon: Package },
  { id: 'accounts', label: 'Accounts', Icon: DollarSign },
  { id: 'expenses', label: 'Shop Expenses', Icon: Wallet }
];

const STEP = 15; // 15 degrees per item
const TOTAL_ITEMS = TABS.length; // 8 items
const CYCLE = TOTAL_ITEMS * STEP; // 120 degrees full loop
const MIN_ANGLE = -20; // Top limit for wrapping
const MAX_ANGLE = 105; // Bottom limit for wrapping
const RADIUS = 200; // 200px radius from FAB center

export const MobileRadialMenu: React.FC<MobileRadialMenuProps> = React.memo(({
  isOpen,
  onToggle,
  onClose,
  activeTab,
  onSelectTab,
  receptionOrdersCount = 0,
  allProductsCount = 0
}) => {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>(activeTab);
  const fabRef = useRef<HTMLButtonElement>(null);
  const justDraggedRef = useRef(false);
  const rotationRef = useRef(0);
  rotationRef.current = rotation;

  useEffect(() => {
    setSelectedTab(activeTab);
  }, [activeTab]);

  // Reset rotation when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setRotation(0);
    }
  }, [isOpen]);

  // Smooth Rotary Touch/Mouse Wheel Handler with Momentum & Zero-Lag rAF
  useEffect(() => {
    if (!isOpen) return;

    let dragging = false;
    let startAngle = 0;
    let startOffset = 0;
    let totalMoved = 0;
    let currentOffset = rotationRef.current;
    let rafId: number | null = null;
    let inertiaRaf: number | null = null;

    // Velocity tracking for smooth inertia fling
    let lastTime = 0;
    let lastAngle = 0;
    let velocity = 0;

    const getFabCenter = () => {
      if (fabRef.current) {
        const rect = fabRef.current.getBoundingClientRect();
        return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      }
      return { cx: window.innerWidth - 52, cy: window.innerHeight - 52 };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (inertiaRaf !== null) {
        cancelAnimationFrame(inertiaRaf);
        inertiaRaf = null;
      }

      const touch = e.touches[0];
      const { cx, cy } = getFabCenter();
      const dist = Math.hypot(touch.clientX - cx, touch.clientY - cy);
      if (dist < 32 || dist > 350) return;

      dragging = true;
      totalMoved = 0;
      velocity = 0;
      lastTime = performance.now();
      startAngle = Math.atan2(-(touch.clientX - cx), -(touch.clientY - cy)) * (180 / Math.PI);
      lastAngle = startAngle;
      startOffset = rotationRef.current;
      currentOffset = startOffset;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const { cx, cy } = getFabCenter();
      const currAngle = Math.atan2(-(touch.clientX - cx), -(touch.clientY - cy)) * (180 / Math.PI);
      let delta = currAngle - startAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      totalMoved += Math.abs(delta);
      if (totalMoved > 4) {
        justDraggedRef.current = true;
        if (e.cancelable) e.preventDefault();
      }

      // Velocity calculation
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      let dAngle = currAngle - lastAngle;
      if (dAngle > 180) dAngle -= 360;
      if (dAngle < -180) dAngle += 360;
      velocity = (dAngle / dt) * 16.6; // normalized to 60fps frame
      lastTime = now;
      lastAngle = currAngle;

      currentOffset = startOffset + delta;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setRotation(currentOffset);
          rafId = null;
        });
      }
    };

    const handleTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Inertia coasting if flung
      if (Math.abs(velocity) > 0.4) {
        let v = Math.max(-12, Math.min(12, velocity));
        const runInertia = () => {
          v *= 0.92;
          if (Math.abs(v) > 0.05) {
            currentOffset += v;
            setRotation(currentOffset);
            inertiaRaf = requestAnimationFrame(runInertia);
          } else {
            inertiaRaf = null;
          }
        };
        inertiaRaf = requestAnimationFrame(runInertia);
      }

      setTimeout(() => {
        justDraggedRef.current = false;
      }, 160);
    };

    // Desktop Mouse Drag Support
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (inertiaRaf !== null) {
        cancelAnimationFrame(inertiaRaf);
        inertiaRaf = null;
      }

      const { cx, cy } = getFabCenter();
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < 32 || dist > 350) return;

      dragging = true;
      totalMoved = 0;
      velocity = 0;
      lastTime = performance.now();
      startAngle = Math.atan2(-(e.clientX - cx), -(e.clientY - cy)) * (180 / Math.PI);
      lastAngle = startAngle;
      startOffset = rotationRef.current;
      currentOffset = startOffset;
      setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const { cx, cy } = getFabCenter();
      const currAngle = Math.atan2(-(e.clientX - cx), -(e.clientY - cy)) * (180 / Math.PI);
      let delta = currAngle - startAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      totalMoved += Math.abs(delta);
      if (totalMoved > 4) {
        justDraggedRef.current = true;
      }

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      let dAngle = currAngle - lastAngle;
      if (dAngle > 180) dAngle -= 360;
      if (dAngle < -180) dAngle += 360;
      velocity = (dAngle / dt) * 16.6;
      lastTime = now;
      lastAngle = currAngle;

      currentOffset = startOffset + delta;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setRotation(currentOffset);
          rafId = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (Math.abs(velocity) > 0.4) {
        let v = Math.max(-12, Math.min(12, velocity));
        const runInertia = () => {
          v *= 0.92;
          if (Math.abs(v) > 0.05) {
            currentOffset += v;
            setRotation(currentOffset);
            inertiaRaf = requestAnimationFrame(runInertia);
          } else {
            inertiaRaf = null;
          }
        };
        inertiaRaf = requestAnimationFrame(runInertia);
      }

      setTimeout(() => {
        justDraggedRef.current = false;
      }, 160);
    };

    const handleWheel = (e: WheelEvent) => {
      const { cx, cy } = getFabCenter();
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < 32 || dist > 350) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 9 : -9;
      setRotation(prev => prev + delta);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (inertiaRaf !== null) cancelAnimationFrame(inertiaRaf);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      {/* Backdrop when radial menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => {
            if (!justDraggedRef.current) onClose();
          }}
        />
      )}

      {/* Radial Arc Items + Main Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center">
        {/* Subtle orbital rotary track line */}
        <svg
          className="absolute pointer-events-none -z-10 overflow-visible transition-opacity duration-300"
          style={{
            width: 440,
            height: 440,
            left: -192,
            top: -192,
            opacity: isOpen ? 1 : 0,
          }}
          viewBox="0 0 440 440"
        >
          <path
            d="M 220,20 A 200,200 0 0,0 20,220"
            fill="none"
            stroke="rgba(109, 40, 217, 0.28)"
            strokeWidth="2"
            strokeDasharray="4 6"
          />
        </svg>

        {TABS.map((tab, idx) => {
          // Continuous Modular Infinite Loop Wrap:
          const baseAngle = -5 + idx * STEP;
          const rawAngle = baseAngle + rotation;
          let wrappedAngle = ((rawAngle - MIN_ANGLE) % CYCLE);
          if (wrappedAngle < 0) wrappedAngle += CYCLE;
          const angleDeg = wrappedAngle + MIN_ANGLE;

          const angleRad = (angleDeg * Math.PI) / 180;
          const x = -Math.round(RADIUS * Math.sin(angleRad));
          const y = -Math.round(RADIUS * Math.cos(angleRad));
          const isSelected = tab.id === selectedTab || tab.id === activeTab;
          const TabIcon = tab.Icon;

          // Smooth boundary fading for seamless infinite wrap
          let itemOpacity = isOpen ? 1 : 0;
          let itemScale = isOpen ? 1 : 0.2;

          if (isOpen) {
            if (angleDeg < -5) {
              const p = Math.max(0, Math.min(1, (angleDeg - MIN_ANGLE) / 15));
              itemOpacity = p;
              itemScale = 0.35 + 0.65 * p;
            } else if (angleDeg > 90) {
              const p = Math.max(0, Math.min(1, (MAX_ANGLE - angleDeg) / 15));
              itemOpacity = p;
              itemScale = 0.35 + 0.65 * p;
            }
          }

          const count = tab.countKey === 'reception'
            ? receptionOrdersCount
            : tab.countKey === 'foods'
            ? allProductsCount
            : 0;

          return (
            <div
              key={tab.id}
              style={{
                transform: isOpen
                  ? `translate3d(${x}px, ${y}px, 0) scale(${itemScale})`
                  : 'translate3d(0px, 0px, 0) scale(0.2)',
                opacity: itemOpacity,
                transition: isDragging
                  ? 'none'
                  : isOpen
                  ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out'
                  : `transform 0.22s ease-in ${(TOTAL_ITEMS - 1 - idx) * 15}ms, opacity 0.18s ease-in`,
                pointerEvents: isOpen && itemOpacity > 0.35 ? 'auto' : 'none'
              }}
              className="absolute w-10 h-10 flex items-center justify-center will-change-transform"
            >
              {/* Floating Menu Name Badge / Pill directly ABOVE the clicked/active button */}
              {isSelected && (
                <div
                  className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none z-30 transition-all duration-200 animate-fadeIn"
                  style={{
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="px-2.5 py-0.5 rounded-full bg-[#1E1B4B] text-white text-[10px] font-black shadow-lg shadow-violet-950/40 border border-violet-400/50 flex items-center gap-1 whitespace-nowrap">
                    <span>{tab.label}</span>
                  </div>
                  {/* Downward triangle pointer caret pointing to the button */}
                  <div className="w-0 h-0 border-x-3.5 border-x-transparent border-t-[5px] border-t-[#1E1B4B] mx-auto -mt-[1px]" />
                </div>
              )}

              <button
                type="button"
                title={tab.label}
                onClick={() => {
                  if (justDraggedRef.current) return;
                  setSelectedTab(tab.id);
                  onSelectTab(tab.id);
                  setTimeout(() => {
                    onClose();
                  }, 320);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.22)] cursor-pointer border select-none active:scale-95 transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#6D28D9] text-white border-white ring-2 ring-[#6D28D9]/40'
                    : 'bg-white text-[#1E293B] hover:bg-violet-50 hover:text-[#6D28D9] border-gray-100'
                }`}
              >
                <TabIcon size={17} strokeWidth={2.3} />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center border border-white shadow-xs">
                    {count}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Main Purple Floating Button (+ rotates into ×) */}
        <button
          ref={fabRef}
          type="button"
          aria-label="Toggle Navigation Menu"
          onClick={onToggle}
          className="relative z-10 w-14 h-14 rounded-full bg-[#6D28D9] hover:bg-[#5B21B6] active:scale-95 text-white shadow-[0_8px_25px_rgba(109,40,217,0.45)] flex items-center justify-center transition-all duration-300 cursor-pointer select-none"
        >
          <Plus
            size={26}
            strokeWidth={2.5}
            className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
          />
        </button>
      </div>
    </div>
  );
});
