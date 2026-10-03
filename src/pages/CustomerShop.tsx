import { useShallow } from 'zustand/react/shallow';
import { useState, useMemo, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  QrCode,
  Trash2,
  ArrowLeft,
  Search,
  Store,
  Tag,
  ChevronRight,
  PackageSearch,
  MapPin,
  Clock,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Send,
  HelpCircle,
  MessageCircle,
  Map,
  ChevronDown
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "../store/useStore";
import { CartItem, Product } from "../types";
import { cn } from "../lib/utils";

export default function CustomerShop() {
  const {
    products,
    categories,
    getBaseCurrency,
    inventory,
    branches,
    catalogConfig,
    storeConfig
  } = useStore(useShallow((state) => ({ products: state.products, categories: state.categories, getBaseCurrency: state.getBaseCurrency, inventory: state.inventory, branches: state.branches, catalogConfig: state.catalogConfig, storeConfig: state.storeConfig })));
  const baseCurrency = getBaseCurrency();
  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const stockByProductBranch = useMemo(() => {
    const map = new Map<string, number>();
    for (const level of inventory || []) {
      const key = level.productId + '::' + level.branchId;
      map.set(key, (map.get(key) || 0) + level.quantity);
    }
    return map;
  }, [inventory]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("Todos");
  const [isLoading, setIsLoading] = useState(false);

  const visibleBranches = useMemo(() => {
    if (!catalogConfig.visibleBranches || catalogConfig.visibleBranches.length === 0) return branches;
    const allowed = new Set(catalogConfig.visibleBranches);
    return branches.filter(b => allowed.has(b.id));
  }, [branches, catalogConfig.visibleBranches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Sync selected branch if it disappears from visible list, or is initially empty
  useEffect(() => {
    if (!selectedBranchId || !visibleBranches.some(b => b.id === selectedBranchId)) {
      if (visibleBranches.length > 0) {
        setSelectedBranchId(visibleBranches[0].id);
      }
    }
  }, [visibleBranches, selectedBranchId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const shopCategories = useMemo(() => {
    return categories.filter(c => c.name.toLowerCase() !== 'test');
  }, [categories]);

  const [activeTab, setActiveTab] = useState<'catalog' | 'store' | 'contact' | 'faq'>('catalog');

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products
      .filter((p) => {
        const cat = categoryById.get(p.categoryId);
        const isTestCategory = cat && cat.name.toLowerCase() === 'test';
        if (isTestCategory) return false;

        const matchesCategory =
          activeCategoryId === "Todos" || p.categoryId === activeCategoryId;
        const matchesSearch =
          !query ||
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
      })
      .map((product) => {
        const totalStock = stockByProductBranch.get(product.id + '::' + selectedBranchId) || 0;
        return { ...product, totalStock };
      })
      .sort((a, b) => {
        // In-stock products first
        const aHasStock = a.totalStock > 0 ? 1 : 0;
        const bHasStock = b.totalStock > 0 ? 1 : 0;
        if (aHasStock !== bHasStock) {
          return bHasStock - aHasStock;
        }
        // Then by name
        return a.name.localeCompare(b.name);
      });
  }, [
    products,
    activeCategoryId,
    searchQuery,
    inventory,
    selectedBranchId,
    categories,
  ]);

  const formatMoney = (amount: number, currency = baseCurrency) => {
    // If currency is base, no conversion needed. 
    // If not, we divide by the rate (e.g. Price in CUP / 320 = Price in USD)
    const converted = currency.isBase ? amount : amount / (currency.rateToBase || 1);
    const formatted = converted.toLocaleString("es-CU", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    return `${currency.symbol} ${formatted}`;
  };

  const allCurrencies = useStore.getState().currencies;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item,
        );
      }
      const price = product.price || 0;
      return [...prev, { id: crypto.randomUUID(), product, quantity: 1, price, total: price }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            return { ...item, quantity: Math.max(0, item.quantity + delta) };
          }
          return item;
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCreateOrder = () => {
    const simplifiedCart = cart.map(item => ({
      id: item.product.id,
      q: item.quantity
    }));
    const payload = `APP_ORDER:${JSON.stringify({ i: simplifiedCart })}`;
    setOrderCode(payload);
    setCart([]);
  };

  if (orderCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2 tracking-tight">
            ¡Tu pedido está listo!
          </h1>
          <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
            Muestra este código QR al cajero para procesar tu compra de inmediato.
          </p>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex justify-center inline-block">
            <QRCodeSVG value={orderCode} size={220} level="H" />
          </div>

          {catalogConfig?.whatsappNumber && (
            <button
              onClick={() => {
                const text = `¡Hola! Tengo un pedido nuevo (QR generado en tienda).\nCódigo de pedido: ${orderCode}`;
                window.open(`https://wa.me/${String(catalogConfig.whatsappNumber || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-full mb-3 py-3.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm active:scale-95 flex justify-center items-center gap-2"
            >
              Enviar por WhatsApp
            </button>
          )}

          <button
            onClick={() => {
              setOrderCode(null);
              setIsCartOpen(false);
            }}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors shadow-sm active:scale-95"
          >
            Nueva Orden
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Sleek Header */}
      <header className="bg-white sticky top-0 z-20 border-b border-slate-200 px-4 sm:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-none">Catálogo Digital</h1>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Tienda en Línea</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setCart([]); 
            }}
            className="hidden sm:block px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
          >
            {visibleBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-white border border-slate-200 p-2.5 rounded-lg hover:bg-slate-50 transition-colors shadow-sm active:scale-95 text-slate-700"
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto w-full max-w-7xl mx-auto p-4 sm:p-8">
        
        {/* Main Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-slate-200 scrollbar-hide">
          <button
            onClick={() => setActiveTab('catalog')}
            className={cn(
              "px-5 py-2.5 rounded-t-lg whitespace-nowrap text-sm font-semibold transition-all border-b-2",
              activeTab === 'catalog'
                ? "border-slate-900 text-slate-900 bg-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Catálogo
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={cn(
              "px-5 py-2.5 rounded-t-lg whitespace-nowrap text-sm font-semibold transition-all border-b-2",
              activeTab === 'store'
                ? "border-slate-900 text-slate-900 bg-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Tienda Física
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={cn(
              "px-5 py-2.5 rounded-t-lg whitespace-nowrap text-sm font-semibold transition-all border-b-2",
              activeTab === 'contact'
                ? "border-slate-900 text-slate-900 bg-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Contacto
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={cn(
              "px-5 py-2.5 rounded-t-lg whitespace-nowrap text-sm font-semibold transition-all border-b-2",
              activeTab === 'faq'
                ? "border-slate-900 text-slate-900 bg-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            Preguntas Frecuentes
          </button>
        </div>

        {activeTab === 'catalog' && (
          <>
            {/* Mobile Branch Selector */}
            <div className="sm:hidden mb-6">
              <label className="block text-xs font-medium text-slate-500 mb-2">Seleccionar Sucursal</label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setCart([]); 
                }}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-900 shadow-sm"
              >
                {visibleBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Hero Section & Search */}
            <div 
              className="rounded-2xl p-6 sm:p-10 text-white mb-8 relative overflow-hidden"
              style={{ backgroundColor: catalogConfig.themeColor || '#1e293b' }}
            >
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3 whitespace-pre-wrap">
                  {catalogConfig.bannerText || 'Descubre Nuestros Productos'}
                </h2>
                <p className="text-white/80 text-sm font-medium mb-8 max-w-md">
                  Explora nuestro catálogo y encuentra exactamente lo que necesitas, con disponibilidad en tiempo real.
                </p>
                
                <div className="relative w-full max-w-2xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-white rounded-xl outline-none text-sm text-slate-900 placeholder:text-slate-400 shadow-sm border-0 focus:ring-2 focus:ring-white/50"
                  />
                </div>
              </div>
            </div>

            {/* Categories Navigation */}
            <div className="mb-8">
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                <button
                  onClick={() => setActiveCategoryId("Todos")}
                  className={cn(
                    "px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all",
                    activeCategoryId === "Todos"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Todos los productos
                </button>
                {shopCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={cn(
                      "px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all",
                      activeCategoryId === cat.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <PackageSearch className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight mb-1">No se encontraron productos</h3>
                <p className="text-sm text-slate-500">Intenta ajustar tu búsqueda o seleccionar otra categoría.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.totalStock <= 0;
                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                    >
                      <div className="relative w-full aspect-[4/5] rounded-xl bg-slate-100 mb-4 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                           loading="lazy" decoding="async" />
                        ) : (
                          <>
                            <div className={cn("absolute inset-0 opacity-10 transition-transform duration-700 group-hover:scale-105", product.color)}></div>
                            <span className="relative z-10 text-4xl font-semibold text-slate-400 opacity-50">
                              {product.name.charAt(0)}
                            </span>
                          </>
                        )}
                        {isOutOfStock && (
                          <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-sm text-slate-500 text-[11px] font-bold uppercase tracking-wider py-2 text-center">
                            Agotado
                          </div>
                        )}
                        {!isOutOfStock && product.totalStock > 0 && product.totalStock <= 5 && (
                          <div className="absolute top-2 right-2 bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                            Solo {product.totalStock}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col">
                        <div className="mb-2">
                          <p className="text-[11px] text-slate-500 font-medium mb-1">
                            {categoryById.get(product.categoryId)?.name || "General"}
                          </p>
                          <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                            {product.name}
                          </h3>
                        </div>
                        
                        {catalogConfig.showPrices && (
                          <div className="mt-auto space-y-1 mb-4">
                            {allCurrencies.map((currency, idx) => (
                              <div key={currency.code} className="flex items-center gap-1.5">
                                <span className={cn(
                                  "font-semibold",
                                  currency.isBase ? "text-slate-900 text-sm" : "text-slate-500 text-xs"
                                )}>
                                  {formatMoney(product.price, currency)}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400">{currency.code}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!catalogConfig.showPrices && (
                          <div className="mt-auto mb-4">
                            <span className="text-xs font-medium text-emerald-600">Disponible</span>
                          </div>
                        )}
                        
                        <button
                          onClick={() => !isOutOfStock && addToCart(product)}
                          disabled={isOutOfStock}
                          className={cn(
                            "w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all",
                            isOutOfStock
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-white border border-slate-200 text-slate-900 hover:border-slate-900 active:bg-slate-50"
                          )}
                        >
                          {isOutOfStock ? (
                            "Agotado"
                          ) : (
                            "Agregar al carrito"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {activeTab === 'store' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="h-48 sm:h-64 bg-slate-100 relative">
                 <img src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&h=400&fit=crop" className="w-full h-full object-cover" alt="Store front"  loading="lazy" decoding="async" />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
                 <h2 className="absolute bottom-6 left-6 text-2xl sm:text-3xl font-bold text-white">Nuestra Tienda</h2>
              </div>
              <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <MapPin className="w-6 h-6 text-slate-900 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Dirección</h3>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{storeConfig.address || 'Dirección no configurada'}</p>
                      {storeConfig.latitude && storeConfig.longitude && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${storeConfig.latitude},${storeConfig.longitude}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="mt-2 inline-block text-sm text-indigo-600 font-medium hover:underline"
                        >
                          Cómo llegar
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Clock className="w-6 h-6 text-slate-900 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Horario</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">Lunes - Sábado: 9:00 AM - 6:00 PM<br/>Domingo: Cerrado</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Phone className="w-6 h-6 text-slate-900 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Contacto</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Tel: {storeConfig.phone || 'No configurado'}<br/>
                        Email: info@mitienda.com
                      </p>
                      {catalogConfig?.whatsappNumber && (
                         <a 
                           href={`https://wa.me/${String(catalogConfig.whatsappNumber || '').replace(/[^0-9]/g, '')}`}
                           target="_blank"
                           rel="noreferrer"
                           className="inline-flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium hover:underline"
                         >
                           <MessageCircle className="w-4 h-4" /> Escríbenos por WhatsApp
                         </a>
                      )}
                    </div>
                  </div>
                  <div className="pt-4 flex gap-4">
                     <a href="#" className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-900 hover:text-white transition-colors">
                       <Instagram className="w-5 h-5" />
                     </a>
                     <a href="#" className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-900 hover:text-white transition-colors">
                       <Facebook className="w-5 h-5" />
                     </a>
                  </div>
                </div>
                <div className="bg-slate-100 rounded-xl overflow-hidden min-h-[250px] relative flex items-center justify-center border border-slate-200">
                   {storeConfig.latitude && storeConfig.longitude ? (
                     <iframe 
                       width="100%" 
                       height="100%" 
                       frameBorder="0" 
                       scrolling="no" 
                       marginHeight={0} 
                       marginWidth={0} 
                       src={`https://maps.google.com/maps?q=${storeConfig.latitude},${storeConfig.longitude}&z=15&output=embed`}
                     ></iframe>
                   ) : (
                     <div className="text-center p-4 text-slate-500">
                       <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
                       <p className="text-sm font-medium">Mapa no configurado</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
               <div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Ponte en contacto</h2>
                 <p className="text-slate-600 text-sm mb-8 leading-relaxed">¿Tienes alguna pregunta o necesitas ayuda? Escríbenos y te responderemos lo antes posible.</p>
                 
                 <div className="space-y-5 mb-8">
                   <div className="flex items-center gap-4 text-slate-700">
                     <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                       <Phone className="w-5 h-5 text-slate-400" />
                     </div>
                     <span className="text-sm font-medium">{storeConfig.phone || 'No configurado'}</span>
                   </div>
                   <div className="flex items-center gap-4 text-slate-700">
                     <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                       <Mail className="w-5 h-5 text-slate-400" />
                     </div>
                     <span className="text-sm font-medium">contacto@mitienda.com</span>
                   </div>
                   <div className="flex items-center gap-4 text-slate-700">
                     <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                       <MapPin className="w-5 h-5 text-slate-400" />
                     </div>
                     <span className="text-sm font-medium">{storeConfig.address || 'No configurada'}</span>
                   </div>
                   {catalogConfig.whatsappNumber && (
                     <div className="flex items-center gap-4 text-emerald-700">
                       <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                         <MessageCircle className="w-5 h-5 text-emerald-500" />
                       </div>
                       <span className="text-sm font-medium">WhatsApp Disponible</span>
                     </div>
                   )}
                 </div>
               </div>

               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre</label>
                   <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all" placeholder="Tu nombre" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono</label>
                   <input type="tel" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all" placeholder="+53..." />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo Electrónico</label>
                   <input type="email" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all" placeholder="correo@ejemplo.com" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensaje</label>
                   <textarea rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none transition-all" placeholder="¿En qué podemos ayudarte?"></textarea>
                 </div>
                 <button className="w-full py-3.5 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                   <Send className="w-4 h-4" /> Enviar Mensaje
                 </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-300 pb-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Preguntas Frecuentes</h2>
              <p className="text-slate-500 text-sm">Resuelve tus dudas rápidamente con nuestra base de conocimiento.</p>
            </div>
            
            <div className="space-y-4">
              {[
                { q: '¿Aceptan Transfermóvil?', a: 'Sí, aceptamos pagos a través de Transfermóvil. Al momento de generar tu pedido, te indicaremos los pasos para realizar la transferencia de forma segura.' },
                { q: '¿Aceptan EnZona?', a: 'Sí, también aceptamos EnZona como método de pago válido para tus compras.' },
                { q: '¿Hay garantía en los productos?', a: 'Todos nuestros productos cuentan con garantía contra defectos de fábrica. El tiempo de garantía varía según el producto, generalmente entre 15 días y 3 meses. Conserva tu comprobante.' },
                { q: '¿Reservan productos?', a: 'Sí, podemos reservar un producto hasta por 24 horas una vez generado el código de pedido. Después de este tiempo, si no se ha completado el pago en la tienda, el producto vuelve al inventario.' },
                { q: '¿Actualizan precios diariamente?', a: 'Los precios se mantienen estables, pero pueden sufrir ligeros ajustes de acuerdo a la tasa de cambio vigente. Siempre verás el precio final y actualizado en la tienda web.' },
              ].map((faq, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-slate-300 transition-colors">
                   <h3 className="font-semibold text-slate-900 text-base mb-2 flex items-start gap-3">
                     <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                     {faq.q}
                   </h3>
                   <p className="text-slate-600 text-sm pl-8 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Checkout Button for Mobile */}
      {itemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm sm:hidden z-20">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white p-4 rounded-xl font-semibold text-sm shadow-2xl flex items-center justify-between active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span>{itemCount} Productos</span>
            </div>
            <div className="flex items-center gap-2">
              {catalogConfig.showPrices && <span>{formatMoney(total)}</span>}
              <ChevronRight className="w-4 h-4 opacity-50" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-700" />
                </button>
                <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Tu Pedido</h2>
              </div>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold">
                {itemCount} items
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                    <ShoppingCart className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">Tu carrito está vacío</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div
                      className={cn("w-16 h-16 rounded-lg flex items-center justify-center shrink-0 overflow-hidden opacity-80", !item.product.image && item.product.color)}
                    >
                      {item.product.image ? (
                        <img 
                          src={item.product.image} 
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                         loading="lazy" decoding="async" />
                      ) : (
                        <span className="font-bold text-xl text-slate-900 opacity-50">
                          {item.product.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="font-semibold text-slate-900 text-sm leading-snug mb-1 line-clamp-2">
                        {item.product.name}
                      </h4>
                      {catalogConfig.showPrices && (
                        <div className="font-semibold text-slate-900 text-sm mt-auto">
                          {formatMoney(item.product.price)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => updateQty(item.id, -item.quantity)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 mt-2">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors shadow-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-semibold text-sm w-6 text-center text-slate-700">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-md transition-colors shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200 p-6 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                {catalogConfig.showPrices && (
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-sm font-medium text-slate-500">
                      Total Estimado
                    </span>
                    <span className="text-2xl font-semibold text-slate-900 tracking-tight">
                      {formatMoney(total)}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleCreateOrder}
                  className="w-full bg-slate-900 text-white font-semibold text-sm py-4 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 shadow-lg active:scale-95"
                >
                  <QrCode className="w-5 h-5" />
                  Generar Código de Pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
