import { useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Download, FileArchive, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Card, Modal } from './ui';
import { useToast } from './Toast';
import { useStore } from '../store/store';
import type { CollectionKey, DB, Item } from '../store/types';
import { today } from '../lib/format';
import { MAX_UPLOAD } from '../lib/validate';
import { track } from '../lib/analytics';
import type { ImportPlan } from '../lib/portability';

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Exportar todos los datos en formatos abiertos. */
export function ExportCard() {
  const { db } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<'' | 'xlsx' | 'zip'>('');
  const base = `${slug(db.settings.company.name)}-datos-${today()}`;

  const run = async (kind: 'xlsx' | 'zip') => {
    setBusy(kind);
    try {
      const lib = await import('../lib/portability');
      const blob = kind === 'xlsx' ? await lib.buildXlsx(db) : await lib.buildZip(db);
      saveBlob(blob, `${base}.${kind}`);
      track('data_exported', { format: kind });
      toast({
        title: kind === 'xlsx' ? 'Excel exportado' : 'Paquete completo exportado',
        description: (
          <>
            Se descargó <em>{base}.{kind}</em> en tu carpeta de descargas.
          </>
        ),
      });
    } catch (e) {
      alert('No se pudo exportar: ' + String((e as Error)?.message ?? e));
    } finally {
      setBusy('');
    }
  };

  const counts: [string, number][] = [
    ['clientes', db.clients.length],
    ['vehículos', db.vehicles.length],
    ['conductores', db.drivers.length],
    ['viajes', db.trips.length],
    ['gastos', db.expenses.length],
    ['cotizaciones', db.quotes.length],
    ['comprobantes', db.proofs.length],
  ];

  return (
    <Card title="Exportar todos tus datos" extra={<span className="small faint">Tus datos son tuyos: llévatelos cuando quieras</span>}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Descarga toda la información de tu empresa en formatos abiertos, para usarla en Excel o cargarla en cualquier otro sistema:{' '}
        {counts.map(([k, n]) => `${n} ${k}`).join(' · ')}.
      </p>
      <div className="grid k2">
        <div className="export-tile">
          <div className="dot-ico green">
            <FileSpreadsheet size={18} />
          </div>
          <div className="grow">
            <b>Excel (.xlsx)</b> <span className="badge green plain">Recomendado</span>
            <p>Una hoja por módulo con encabezados claros, hoja “Léeme” y diccionario de columnas. Se abre en Excel, Google Sheets o LibreOffice y también sirve para volver a importar.</p>
            <button className="btn primary sm" disabled={!!busy} onClick={() => run('xlsx')}>
              {busy === 'xlsx' ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Descargar Excel
            </button>
          </div>
        </div>
        <div className="export-tile">
          <div className="dot-ico">
            <FileArchive size={18} />
          </div>
          <div className="grow">
            <b>Paquete completo (.zip)</b>
            <p>Un CSV por módulo, las firmas y fotos de cada comprobante de entrega, tu logo y una copia exacta en JSON. Ideal para una migración completa a otro software.</p>
            <button className="btn sm" disabled={!!busy} onClick={() => run('zip')}>
              {busy === 'zip' ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Descargar paquete
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Importar datos desde Excel (plantilla o archivo exportado) con vista previa antes de aplicar. */
export function ImportCard() {
  const { db, upsertMany, replaceDB } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<(ImportPlan & { file: string }) | null>(null);

  const template = async () => {
    const lib = await import('../lib/portability');
    saveBlob(await lib.buildXlsx(db, { template: true }), 'plantilla-importacion.xlsx');
  };

  const read = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) return alert('El archivo debe ser un Excel (.xlsx).');
    if (file.size > MAX_UPLOAD.excel) return alert('El archivo pesa más de 10 MB. Divídelo en partes más pequeñas.');
    setBusy(true);
    try {
      const lib = await import('../lib/portability');
      setPlan({ ...(await lib.planImport(file, db)), file: file.name });
    } catch (e) {
      alert('No se pudo leer el archivo. Asegúrate de que sea un Excel (.xlsx) con el formato de la plantilla.\n\n' + String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!plan) return;
    const snapshot: DB = db;
    for (const [k, items] of Object.entries(plan.changes)) {
      if (items?.length) upsertMany(k as CollectionKey, items as Item<CollectionKey>[]);
    }
    const created = plan.reports.reduce((s, r) => s + r.created, 0);
    const updated = plan.reports.reduce((s, r) => s + r.updated, 0);
    track('data_imported', { created, updated });
    const skipped = plan.reports.reduce((s, r) => s + r.errors.length, 0);
    setPlan(null);
    toast({
      title: 'Importación completada',
      description: (
        <>
          <em>{created}</em> {created === 1 ? 'registro nuevo' : 'registros nuevos'} y <em>{updated}</em> {updated === 1 ? 'actualizado' : 'actualizados'}
          {skipped ? (
            <>
              ; <em>{skipped}</em> {skipped === 1 ? 'fila con errores no se importó' : 'filas con errores no se importaron'}
            </>
          ) : null}
          . Ya los puedes ver en cada módulo.
        </>
      ),
      duration: 12000,
      actions: [
        {
          label: 'Deshacer importación',
          kind: 'undo',
          onClick: () => {
            replaceDB(snapshot);
            toast({ tone: 'info', title: 'Importación deshecha', description: 'Tus datos volvieron a como estaban antes de importar.' });
          },
        },
      ],
    });
  };

  const errorCount = plan?.reports.reduce((s, r) => s + r.errors.length, 0) ?? 0;

  return (
    <Card title="Importar datos desde Excel" extra={<span className="small faint">Para empresas que vienen de otro sistema o de planillas</span>}>
      <ol className="steps">
        <li>
          Descarga la <b>plantilla</b> (o exporta tus datos actuales y edítalos).
        </li>
        <li>
          Copia la información de tu sistema anterior en las hojas: <b>Clientes, Conductores, Vehículos, Tarifas, Viajes y Gastos</b>.
        </li>
        <li>Sube el archivo: verás un resumen y los errores antes de confirmar. Nada se modifica hasta que aceptes.</li>
      </ol>
      <div className="row wrap">
        <button className="btn" onClick={template}>
          <Download size={15} /> Descargar plantilla
        </button>
        <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Subir Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) read(f);
            e.target.value = '';
          }}
        />
      </div>

      <Modal
        open={!!plan}
        onClose={() => setPlan(null)}
        title="Revisar importación"
        width={680}
        footer={
          <>
            <button className="btn" onClick={() => setPlan(null)}>
              Cancelar
            </button>
            <button className="btn primary" disabled={!plan?.total} onClick={apply}>
              <ArrowRightLeft size={15} /> {plan?.total === 1 ? 'Importar 1 registro' : `Importar ${plan?.total ?? 0} registros`}
            </button>
          </>
        }
      >
        {plan && (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Archivo <b>{plan.file}</b>. Los registros que ya existen (mismo ID, RUT, patente o N° de viaje) se actualizan; el resto se crea.
            </p>
            {plan.reports.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <h3>No se encontraron hojas para importar</h3>
                <p>El archivo debe tener hojas llamadas Clientes, Conductores, Vehículos, Tarifas, Viajes o Gastos. Descarga la plantilla para ver el formato.</p>
              </div>
            ) : (
              <div className="table-wrap"><table className="table">
                <thead>
                  <tr>
                    <th>Hoja</th>
                    <th className="right">Nuevos</th>
                    <th className="right">Actualizados</th>
                    <th className="right">Sin cambios</th>
                    <th className="right">Con errores</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.reports.map((r) => (
                    <tr key={r.sheet}>
                      <td className="cell-title">{r.sheet}</td>
                      <td className="right tnum">{r.created}</td>
                      <td className="right tnum">{r.updated}</td>
                      <td className="right tnum faint">{r.unchanged}</td>
                      <td className={`right tnum ${r.errors.length ? 'neg strong' : ''}`}>{r.errors.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
            {plan.ignoredSheets.length > 0 && (
              <p className="small faint">Hojas no reconocidas (se ignoran): {plan.ignoredSheets.join(', ')}.</p>
            )}
            {errorCount > 0 ? (
              <div className="import-errors">
                <div className="row strong" style={{ color: 'var(--red)', gap: 6 }}>
                  <AlertTriangle size={15} /> {errorCount === 1 ? '1 fila tiene errores y no se importará' : `${errorCount} filas tienen errores y no se importarán`}
                </div>
                <p className="small muted" style={{ margin: '4px 0 8px' }}>
                  Puedes importar el resto ahora y luego corregir estas filas y volver a subir el archivo (no se duplicarán los registros ya importados).
                </p>
                <ul>
                  {plan.reports.flatMap((r) => r.errors.slice(0, 40).map((e) => <li key={`${r.sheet}-${e.row}`}><b>{r.sheet}, fila {e.row}:</b> {e.msg}</li>))}
                </ul>
              </div>
            ) : (
              plan.reports.length > 0 && (
                <div className="row small mt" style={{ color: 'var(--green)', gap: 6 }}>
                  <CheckCircle2 size={15} />{' '}
                  {plan.total > 0 ? 'Todo listo: no se encontraron errores.' : 'Sin errores. Tus datos ya están al día: no hay nada nuevo que importar.'}
                </div>
              )
            )}
          </>
        )}
      </Modal>
    </Card>
  );
}
