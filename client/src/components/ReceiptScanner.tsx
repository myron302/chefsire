import React, { useState } from "react";
import Tesseract from "tesseract.js";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, Cloud, Cpu } from "lucide-react";
import { parseReceiptText, ParsedItem } from "@/lib/receiptParsing";

type Props = {
  onClose: () => void;
  onAddToPantry: (items: ParsedItem[]) => Promise<void> | void;
  onAddToShopping: (items: ParsedItem[]) => void;
};

const USE_CLOUD = (import.meta as any).env?.VITE_USE_CLOUD_OCR === "true";

export default function ReceiptScanner({ onClose, onAddToPantry, onAddToShopping }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCloud, setUseCloud] = useState<boolean>(USE_CLOUD);

  const handleFile = (f: File | null) => {
    setFile(f);
    setOcrText("");
    setItems([]);
    setError(null);
  };

  const runLocalOcr = async (blob: Blob) => {
    const result = await Tesseract.recognize(blob, "eng");
    return result.data.text || "";
  };

  const runCloudOcr = async (blob: Blob) => {
    const fd = new FormData();
    fd.append("file", blob, (file && file.name) || "receipt.jpg");
    const res = await fetch("/api/ocr/receipt", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Cloud OCR request failed");
    const data = await res.json();
    return (data?.text as string) || "";
  };

  const runOcr = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = useCloud ? await runCloudOcr(file) : await runLocalOcr(file);
      setOcrText(text);
      const parsed = parseReceiptText(text);
      setItems(parsed);
    } catch (e) {
      console.error(e);
      setError("OCR failed. Try a clearer photo or different lighting.");
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<ParsedItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-3xl rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">Receipt Scanner (OCR)</h3>
            <div className="text-xs text-gray-600 flex items-center gap-1">
              {useCloud ? <Cloud className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
              {useCloud ? "Cloud OCR" : "Local OCR"}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* OCR mode toggle (only if env defaulted to something; you can hide this if you want fixed mode) */}
          <div className="flex items-center gap-2 text-sm">
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={useCloud}
                onChange={() => setUseCloud((v) => !v)}
              />
              <span>Use Cloud OCR (Google Vision)</span>
            </label>
          </div>

          {/* Upload */}
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload receipt image (JPG/PNG)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {file && <span className="text-sm text-gray-600 truncate max-w-[60%]">{file.name}</span>}
            <button
              disabled={!file || busy}
              onClick={runOcr}
              className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {busy ? "Processing..." : "Extract Items"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Results */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">Review and edit before importing:</div>
              <div className="border rounded overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-gray-50 px-3 py-2 text-sm font-medium">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-2">Category</div>
                </div>
                <div className="divide-y">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2">
                      <input
                        className="col-span-6 border rounded px-2 py-1 text-sm"
                        value={it.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                      />
                      <input
                        type="number"
                        step={0.5}
                        min={0}
                        className="col-span-2 border rounded px-2 py-1 text-sm"
                        value={it.quantity ?? 1}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      />
                      <input
                        className="col-span-2 border rounded px-2 py-1 text-sm"
                        value={it.unit ?? "piece"}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      />
                      <input
                        className="col-span-2 border rounded px-2 py-1 text-sm"
                        value={it.category ?? "pantry"}
                        onChange={(e) => updateItem(idx, { category: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onAddToShopping(items)}
                  className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Add All → Shopping List
                </button>
                <button
                  onClick={async () => {
                    await onAddToPantry(items);
                    onClose();
                  }}
                  className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Add All → Pantry
                </button>
              </div>
            </div>
          )}

          {/* (Optional) Raw OCR text for debugging */}
          {ocrText && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-700 mb-1">Show OCR text (debug)</summary>
              <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded border max-h-48 overflow-auto">
{ocrText}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
