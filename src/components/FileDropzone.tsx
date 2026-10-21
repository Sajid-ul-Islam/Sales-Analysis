"use client";

import React, { useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Split,
  FileCheck2,
  X,
  Play,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Truck
} from 'lucide-react';

export interface FileDropzoneProps {
  orderFiles: File[];
  setOrderFiles: React.Dispatch<React.SetStateAction<File[]>>;
  returnFile: File | null;
  setReturnFile: React.Dispatch<React.SetStateAction<File | null>>;
  partialFile: File | null;
  setPartialFile: React.Dispatch<React.SetStateAction<File | null>>;
  exchangeFile?: File | null;
  setExchangeFile?: React.Dispatch<React.SetStateAction<File | null>>;
  pathaoDeliveryFile?: File | null;
  setPathaoDeliveryFile?: React.Dispatch<React.SetStateAction<File | null>>;
  excludeAugust: boolean;
  setExcludeAugust: (v: boolean) => void;
  excludePOS: boolean;
  setExcludePOS: (v: boolean) => void;
  onProcess: (customFiles?: {
    orders?: File[];
    returns?: File | null;
    partials?: File | null;
    exchanges?: File | null;
    pathaoDelivery?: File | null;
  }) => void;
  onLoadPreloadedData: () => void;
  isProcessing: boolean;
  rawOrdersCount?: number;
  dataSourceName?: string;
}

export function FileDropzone({
  orderFiles,
  setOrderFiles,
  returnFile,
  setReturnFile,
  partialFile,
  setPartialFile,
  exchangeFile,
  setExchangeFile,
  pathaoDeliveryFile,
  setPathaoDeliveryFile,
  excludeAugust,
  setExcludeAugust,
  excludePOS,
  setExcludePOS,
  onProcess,
  onLoadPreloadedData,
  isProcessing,
  rawOrdersCount,
  dataSourceName
}: FileDropzoneProps) {
  const inputOrdersRef = useRef<HTMLInputElement>(null);
  const inputPathaoRef = useRef<HTMLInputElement>(null);
  const inputReturnsRef = useRef<HTMLInputElement>(null);
  const inputPartialsRef = useRef<HTMLInputElement>(null);
  const inputExchangesRef = useRef<HTMLInputElement>(null);

  const [dragActive1, setDragActive1] = React.useState(false);
  const [dragActivePathao, setDragActivePathao] = React.useState(false);
  const [dragActive2, setDragActive2] = React.useState(false);
  const [dragActive3, setDragActive3] = React.useState(false);
  const [dragActive4, setDragActive4] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(Boolean(rawOrdersCount && rawOrdersCount > 0));

  const handleOrdersAdded = (incoming: File[]) => {
    const updated = [...orderFiles, ...incoming];
    setOrderFiles(updated);
    onProcess({ orders: updated });
  };

  const handlePathaoAdded = (file: File) => {
    if (setPathaoDeliveryFile) setPathaoDeliveryFile(file);
    onProcess({ pathaoDelivery: file });
  };

  const handleReturnAdded = (file: File) => {
    setReturnFile(file);
    onProcess({ returns: file });
  };

  const handlePartialAdded = (file: File) => {
    setPartialFile(file);
    onProcess({ partials: file });
  };

  const handleExchangeAdded = (file: File) => {
    if (setExchangeFile) setExchangeFile(file);
    onProcess({ exchanges: file });
  };

  if (isCollapsed) {
    return (
      <section className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border px-4 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-900/50 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-navy-deep dark:text-white">
              {dataSourceName || 'Verified Master Ledger'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ({rawOrdersCount?.toLocaleString()} orders loaded)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Ready
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadPreloadedData}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-deepBlack-sidebar hover:bg-slate-100 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-deepBlack-border text-xs font-bold transition-all shadow-2xs"
            title="Reload verified master baseline"
          >
            Reset Baseline
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload / Replace Files ▾</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border p-5 sm:p-6 shadow-xs flex flex-col gap-5">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-deepBlack-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
              Multi-Tier Ingestion & Automated Reconciliation
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              Two-Tier Status Priority
            </span>
          </div>
          <h2 className="font-headline text-base sm:text-lg font-bold text-navy-deep dark:text-white">
            Upload Store Spreadsheets & Courier Manifests
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-indigo-700 dark:text-indigo-400">Primary Truth:</span> Pathao Delivery Data contains all delivery statuses (Delivered, Returns, Partials, Exchanges).
            <span className="font-bold text-slate-700 dark:text-slate-300 ml-1.5">Optional Fallback:</span> Separate return, partial, and exchange files are only needed if overriding courier records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadPreloadedData}
            className="px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-primary border border-orange-200/60 dark:border-orange-900/60 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Load Master Baseline</span>
          </button>
          {rawOrdersCount && rawOrdersCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-deepBlack-sidebar hover:bg-slate-200 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-deepBlack-border text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <span>Collapse ▴</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 5 Dropzones Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* Dropzone 1: Order Files */}
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            inputOrdersRef.current?.click();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive1(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setDragActive1(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive1(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive1(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleOrdersAdded(Array.from(e.dataTransfer.files));
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
            dragActive1
              ? 'border-primary bg-orange-100/70 dark:bg-orange-950/40 scale-[1.02] shadow-md ring-2 ring-primary/20'
              : 'border-slate-300 dark:border-deepBlack-border hover:border-primary hover:bg-orange-50/40 dark:hover:bg-deepBlack-hover bg-slate-50/50 dark:bg-deepBlack-sidebar'
          }`}
        >
          <input
            type="file"
            ref={inputOrdersRef}
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleOrdersAdded(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="hidden"
            id="orderFilesInput"
          />
          <div className="w-10 h-10 rounded-full bg-white dark:bg-deepBlack-elevated shadow-2xs border border-slate-200/60 dark:border-deepBlack-border flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform pointer-events-none">
            <FileSpreadsheet className="w-4.5 h-4.5 text-primary" />
          </div>
          <span className="font-headline text-xs font-bold text-slate-900 dark:text-white mb-0.5 pointer-events-none">
            1. Dispatched Orders
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mb-2.5 pointer-events-none">
            {dragActive1 ? 'Release to upload orders!' : 'Store orders (.xlsx / .csv)'}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputOrdersRef.current?.click();
            }}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-primary hover:text-white hover:border-primary transition-colors cursor-pointer"
          >
            Browse Orders
          </button>

          {/* Files List Preview */}
          {orderFiles.length > 0 && (
            <div className="mt-2.5 w-full space-y-1.5 max-h-24 overflow-y-auto">
              {orderFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1 bg-white dark:bg-deepBlack-card rounded border border-slate-200 dark:border-deepBlack-border text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">{f.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const updated = orderFiles.filter((_, idx) => idx !== i);
                      setOrderFiles(updated);
                      onProcess({ orders: updated });
                    }}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <span className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide pointer-events-none">
            {orderFiles.length > 0 ? `${orderFiles.length} file(s) active` : '0 files attached'}
          </span>
        </div>

        {/* Dropzone 2: Pathao Master Delivery Report (PRIMARY CHECK) */}
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            inputPathaoRef.current?.click();
          }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActivePathao(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setDragActivePathao(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActivePathao(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActivePathao(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handlePathaoAdded(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
            dragActivePathao
              ? 'border-indigo-600 bg-indigo-100/70 dark:bg-indigo-950/40 scale-[1.02] shadow-md ring-2 ring-indigo-600/20'
              : pathaoDeliveryFile
                ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                : 'border-indigo-300/80 dark:border-indigo-900/60 hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 bg-slate-50/50 dark:bg-deepBlack-sidebar'
          }`}
        >
          <div className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-extrabold tracking-wider uppercase shadow-2xs">
            Primary Truth
          </div>
          <input
            type="file"
            ref={inputPathaoRef}
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handlePathaoAdded(e.target.files[0]);
                e.target.value = '';
              }
            }}
            className="hidden"
            id="pathaoDeliveryInput"
          />
          <div className="w-10 h-10 rounded-full bg-white dark:bg-deepBlack-elevated shadow-2xs border border-indigo-200/80 dark:border-indigo-900/60 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform pointer-events-none">
            <Truck className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="font-headline text-xs font-bold text-slate-900 dark:text-white mb-0.5 pointer-events-none">
            2. Pathao Delivery Data
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mb-2.5 pointer-events-none">
            {dragActivePathao ? 'Release to upload Pathao report!' : 'All-in-one manifest (.csv / .xlsx). Auto-extracts returns & partials.'}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputPathaoRef.current?.click();
            }}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-deepBlack-elevated border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 shadow-2xs hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors cursor-pointer"
          >
            Browse Pathao CSV/XLSX
          </button>

          {/* Pathao File Status */}
          {pathaoDeliveryFile && (
            <div className="mt-2.5 w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-deepBlack-card rounded border border-indigo-200 dark:border-indigo-800 shadow-2xs text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">{pathaoDeliveryFile.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPathaoDeliveryFile?.(null);
                  onProcess({ pathaoDelivery: null });
                }}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide pointer-events-none">
            {pathaoDeliveryFile ? 'Active (All Statuses Covered)' : '0 files attached'}
          </span>
        </div>

        {/* Dropzone 3: Return Manifest (FALLBACK) */}
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            inputReturnsRef.current?.click();
          }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive2(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setDragActive2(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive2(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive2(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleReturnAdded(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
            dragActive2
              ? 'border-rose-500 bg-rose-100/70 dark:bg-rose-950/40 scale-[1.02] shadow-md ring-2 ring-rose-500/20'
              : 'border-slate-300 dark:border-deepBlack-border hover:border-rose-500 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 bg-slate-50/50 dark:bg-deepBlack-sidebar'
          }`}
        >
          <div className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-deepBlack-elevated text-slate-600 dark:text-slate-400 text-[8px] font-bold tracking-wider uppercase border border-slate-300/60 dark:border-deepBlack-border">
            Optional Fallback
          </div>
          <input
            type="file"
            ref={inputReturnsRef}
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleReturnAdded(e.target.files[0]);
                e.target.value = '';
              }
            }}
            className="hidden"
            id="returnsInput"
          />
          <div className="w-10 h-10 rounded-full bg-white dark:bg-deepBlack-elevated shadow-2xs border border-slate-200/60 dark:border-deepBlack-border flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform pointer-events-none">
            <FileCheck2 className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
          </div>
          <span className="font-headline text-xs font-bold text-slate-900 dark:text-white mb-0.5 pointer-events-none">
            3. Separate Returns (Optional)
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mb-2.5 pointer-events-none">
            {dragActive2 ? 'Release to upload returns!' : 'Optional return manifest (.xlsx / .csv)'}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputReturnsRef.current?.click();
            }}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors cursor-pointer"
          >
            Browse Returns
          </button>

          {/* Return File Status */}
          {returnFile && (
            <div className="mt-2.5 w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-deepBlack-card rounded border border-rose-200 dark:border-rose-900/60 shadow-2xs text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">{returnFile.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReturnFile(null);
                  onProcess({ returns: null });
                }}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide pointer-events-none">
            {returnFile ? '1 file loaded & active' : '0 files attached'}
          </span>
        </div>

        {/* Dropzone 4: Partial Deliveries (FALLBACK) */}
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            inputPartialsRef.current?.click();
          }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive3(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setDragActive3(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive3(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive3(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handlePartialAdded(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
            dragActive3
              ? 'border-amber-600 bg-amber-100/70 dark:bg-amber-950/40 scale-[1.02] shadow-md ring-2 ring-amber-600/20'
              : 'border-slate-300 dark:border-deepBlack-border hover:border-amber-600 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 bg-slate-50/50 dark:bg-deepBlack-sidebar'
          }`}
        >
          <div className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-deepBlack-elevated text-slate-600 dark:text-slate-400 text-[8px] font-bold tracking-wider uppercase border border-slate-300/60 dark:border-deepBlack-border">
            Fallback
          </div>
          <input
            type="file"
            ref={inputPartialsRef}
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handlePartialAdded(e.target.files[0]);
                e.target.value = '';
              }
            }}
            className="hidden"
            id="partialsInput"
          />
          <div className="w-10 h-10 rounded-full bg-white dark:bg-deepBlack-elevated shadow-2xs border border-slate-200/60 dark:border-deepBlack-border flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform pointer-events-none">
            <Split className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="font-headline text-xs font-bold text-slate-900 dark:text-white mb-0.5 pointer-events-none">
            4. Partial Orders
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mb-2.5 pointer-events-none">
            {dragActive3 ? 'Release to upload partials!' : 'COD settlement (Partial Orders.xlsx)'}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputPartialsRef.current?.click();
            }}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors cursor-pointer"
          >
            Browse Partials
          </button>

          {/* Partial File Status */}
          {partialFile && (
            <div className="mt-2.5 w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-deepBlack-card rounded border border-amber-200 dark:border-amber-900/60 shadow-2xs text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">{partialFile.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPartialFile(null);
                  onProcess({ partials: null });
                }}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide pointer-events-none">
            {partialFile ? '1 file loaded & active' : '0 files attached'}
          </span>
        </div>

        {/* Dropzone 5: Exchanged Orders (FALLBACK) */}
        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            inputExchangesRef.current?.click();
          }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive4(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setDragActive4(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive4(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive4(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleExchangeAdded(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all group cursor-pointer ${
            dragActive4
              ? 'border-purple-500 bg-purple-100/70 dark:bg-purple-950/40 scale-[1.02] shadow-md ring-2 ring-purple-500/20'
              : 'border-slate-300 dark:border-deepBlack-border hover:border-purple-500 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 bg-slate-50/50 dark:bg-deepBlack-sidebar'
          }`}
        >
          <div className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-deepBlack-elevated text-slate-600 dark:text-slate-400 text-[8px] font-bold tracking-wider uppercase border border-slate-300/60 dark:border-deepBlack-border">
            Fallback
          </div>
          <input
            type="file"
            ref={inputExchangesRef}
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0] && setExchangeFile) {
                handleExchangeAdded(e.target.files[0]);
                e.target.value = '';
              }
            }}
            className="hidden"
            id="exchangeFileInput"
          />
          <div className="w-10 h-10 rounded-full bg-white dark:bg-deepBlack-elevated shadow-2xs border border-slate-200/60 dark:border-deepBlack-border flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform pointer-events-none">
            <RefreshCw className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="font-headline text-xs font-bold text-slate-900 dark:text-white mb-0.5 pointer-events-none">
            5. Exchanged Orders
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mb-2.5 pointer-events-none">
            {dragActive4 ? 'Release to upload exchanges!' : 'Size swap log (Exchanged.xlsx)'}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputExchangesRef.current?.click();
            }}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors cursor-pointer"
          >
            Browse Exchanges
          </button>

          {/* Exchange File Status */}
          {exchangeFile && (
            <div className="mt-2.5 w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-deepBlack-card rounded border border-purple-200 dark:border-purple-900/60 shadow-2xs text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">{exchangeFile.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExchangeFile?.(null);
                  onProcess({ exchanges: null });
                }}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide pointer-events-none">
            {exchangeFile ? '1 file loaded & active' : '0 files attached'}
          </span>
        </div>
      </div>

      {/* Filter Controls & Process Button */}
      <div className="bg-white dark:bg-deepBlack-card rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200/80 dark:border-deepBlack-border shadow-2xs">
        <div className="flex items-center gap-5 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeAugust}
              onChange={(e) => setExcludeAugust(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Exclude August Pre-Period Dates</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludePOS}
              onChange={(e) => setExcludePOS(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Exclude Outlet / POS Orders (Online Only)</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => onProcess()}
          disabled={isProcessing || (orderFiles.length === 0 && !returnFile && !partialFile && !exchangeFile && !pathaoDeliveryFile && (rawOrdersCount || 0) === 0)}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-headline text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-primary/20 transition-all active:scale-95"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing Reconciliations...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Process & Calculate Sales Ledger</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
