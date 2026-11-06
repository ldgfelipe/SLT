'use client';

import React, { useRef, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Upload,
  X,
  ListChecks,
} from 'lucide-react';
import { importContactsCsv, listMailLists } from '@/app/actions/mail-data';
import { useEffect } from 'react';

interface ImportWorkspaceProps {
  clientId: string;
}

const SAMPLE_COLUMNS = [
  'email, nombre, empresa, giro, empleados, cargo, telefono, sitio_web, region, fuente',
  'juan@abarrotes.com, Juan Pérez, Abarrotes del Valle, Abarrotes, 5, Dueño, 55 1234 5678, abarrotesvalle.com.mx, CDMX, google_maps',
].join('\n');

export function ImportWorkspace({ clientId }: ImportWorkspaceProps) {
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [lists, setLists] = useState<Array<{ id: string; name: string; contact_count?: number }>>([]);
  const [targetListId, setTargetListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<string>('');
  const [importing, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMailLists(clientId).then((res) => {
      if (res.success) setLists(res.lists as any);
    });
  }, [clientId]);

  const handleFile = async (file: File | null) => {
    if (!file || importing) return;
    setError('');
    setResult('');
    setFileName(file.name);

    if (file.size > 2_000_000) {
      setError('El archivo supera 2 MB. Divide el CSV en partes.');
      return;
    }

    const text = await file.text();
    if (!text.trim()) {
      setError('El archivo está vacío.');
      return;
    }
    setCsvText(text);
  };

  const handlePaste = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCsvText(event.target.value);
    if (event.target.value.trim()) {
      setFileName('Pega manual');
    }
  };

  const importNow = () => {
    setError('');
    setResult('');

    if (!csvText.trim()) {
      setError('Carga un archivo o pega el contenido del CSV.');
      return;
    }

    if (!targetListId && !newListName.trim()) {
      setError('Elige una lista destino o escribe el nombre de una nueva.');
      return;
    }

    startTransition(async () => {
      const res = await importContactsCsv(clientId, {
        csv: csvText,
        listaId: targetListId || null,
        nuevaLista: targetListId ? null : newListName.trim(),
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setResult(
        `Importación completada: ${res.inserted} agregados, ${res.duplicates} duplicados omitidos, ${res.invalid} inválidos.` +
          (res.listaNombre ? ` Lista: "${res.listaNombre}".` : '')
      );
      setCsvText('');
      setFileName('');
      if (inputRef.current) inputRef.current.value = '';
      // Refrescar listas
      listMailLists(clientId).then((r) => {
        if (r.success) setLists(r.lists as any);
      });
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-100 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Importar CSV</h1>
          <p className="mt-1 text-xs text-slate-400">
            Carga empresas/contactos al Mail Center. Las columnas se detectan automáticamente.
          </p>
        </div>
      </div>

      {(error || result) && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${
            error
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {error ? (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          {error || result}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0c1f3d] p-5 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              1. Archivo
            </h2>
            <div
              onClick={() => inputRef.current?.click()}
              className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 bg-[#0a1931] px-6 py-8 text-center transition hover:border-[#00d4ff]/40"
            >
              {fileName ? (
                <>
                  <FileSpreadsheet className="h-9 w-9 text-[#00d4ff]" />
                  <p className="text-xs font-semibold text-white">{fileName}</p>
                  <p className="text-[10px] text-slate-500">
                    {csvText.split('\n').length.toLocaleString('es-MX')} líneas detectadas
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileName('');
                      setCsvText('');
                      if (inputRef.current) inputRef.current.value = '';
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-300"
                  >
                    <X className="h-3 w-3" /> Quitar archivo
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-9 w-9 text-slate-600" />
                  <p className="text-xs font-semibold text-slate-300">
                    Haz clic o arrastra tu CSV aquí
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Encabezados en la primera fila. Máx. 2 MB.
                  </p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. O pega el contenido
            </h2>
            <textarea
              value={csvText}
              onChange={handlePaste}
              rows={5}
              placeholder="email, nombre, empresa…"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1931] px-3 py-2 font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#00d4ff]"
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              3. Destino
            </h2>
            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Lista existente
            </label>
            <select
              value={targetListId}
              onChange={(e) => setTargetListId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#00d4ff]"
            >
              <option value="">— Sin lista (solo crear contactos) —</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.contact_count?.toLocaleString('es-MX') ?? 0})
                </option>
              ))}
            </select>

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              O crear lista nueva
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                disabled={Boolean(targetListId)}
                placeholder="Ej. Prospectos Octubre"
                className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#00d4ff] disabled:opacity-40"
              />
              <ListChecks className="h-4 w-4 text-slate-600" />
            </div>

            <button
              onClick={importNow}
              disabled={importing || !csvText.trim()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4ff] px-4 py-3 text-sm font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-40"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Importar contactos
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d]/60 p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Columnas reconocidas
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              <code className="text-[#00d4ff]">email</code> (obligatoria),{' '}
              <code className="text-slate-300">nombre</code>,{' '}
              <code className="text-slate-300">apellidos</code>,{' '}
              <code className="text-slate-300">empresa</code>,{' '}
              <code className="text-slate-300">giro</code>,{' '}
              <code className="text-slate-300">empleados</code>,{' '}
              <code className="text-slate-300">cargo</code>,{' '}
              <code className="text-slate-300">telefono</code>,{' '}
              <code className="text-slate-300">sitio_web</code>,{' '}
              <code className="text-slate-300">region</code>,{' '}
              <code className="text-slate-300">fuente</code>.
              El resto va a campos personalizados.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-white/5 bg-black/30 p-2 font-mono text-[9px] text-slate-500">
              {SAMPLE_COLUMNS}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
