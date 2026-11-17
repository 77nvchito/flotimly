import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Check, Crown, Database, Download, FileSpreadsheet, ImagePlus, Pencil, Plus, RotateCcw, SlidersHorizontal, Tags, Trash2, Truck, Upload, Users } from 'lucide-react';
import { Badge, Card, Field, Modal, NumInput, PageHeader, Segmented, Select, StatusBadge, TextInput, Toggle, confirmDelete, useForm } from '../components/ui';
import { useStore } from '../store/store';
import { VEHICLE_TYPES, type BankAccount, type Company, type DB, type Params, type Tariff, type User } from '../store/types';
import { DEFAULT_CONDITIONS } from '../store/seed';
import { ExportCard, ImportCard } from '../components/DataPortability';
import { clp, today, uid } from '../lib/format';
import { MIN_PASSWORD, hashPassword, passwordProblem } from '../lib/security';
import { ROLES, ROLE_INFO } from '../lib/permissions';
import { track } from '../lib/analytics';
import { MAX_UPLOAD, formatRut, imageProblem, isEmail, isPhone, isRut, isWebsite, optional } from '../lib/validate';
import { PLAN_LIST, PROMO, bestValueKey, perVehicle, planInfo, promoPrice, usersLabel, vehiclesLabel } from '../lib/plans';

type Tab = 'empresa' | 'cotizaciones' | 'parametros' | 'tarifas' | 'usuarios' | 'plan' | 'datos';

export default function SettingsPage() {
  const TABS: Tab[] = ['empresa', 'cotizaciones', 'parametros', 'tarifas', 'usuarios', 'plan', 'datos'];
  const [params] = useSearchParams();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'empresa');
  return (
    <>
      <PageHeader title="Configuración" subtitle="Parámetros de cálculo, tarifas, usuarios y plan de tu cuenta" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'empresa', label: <><Building2 size={14} /> Empresa</> },
          { value: 'cotizaciones', label: <><FileSpreadsheet size={14} /> Cotizaciones</> },
          { value: 'parametros', label: <><SlidersHorizontal size={14} /> Parámetros</> },
          { value: 'tarifas', label: <><Tags size={14} /> Tarifas</> },
          { value: 'usuarios', label: <><Users size={14} /> Usuarios</> },
          { value: 'plan', label: <><Crown size={14} /> Plan</> },
          { value: 'datos', label: <><Database size={14} /> Datos</> },
        ]}
      />
      <div className="mt">
        {tab === 'empresa' && <CompanyTab />}
        {tab === 'cotizaciones' && <QuoteSettingsTab />}
        {tab === 'parametros' && <ParamsTab />}
        {tab === 'tarifas' && <TariffsTab />}
        {tab === 'usuarios' && <UsersTab />}
        {tab === 'plan' && <PlanTab />}
        {tab === 'datos' && <DataTab />}
      </div>
    </>
  );
}

function SaveBar({ dirty, onSave, invalid }: { dirty: boolean; onSave: () => void; invalid?: boolean }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="row mt" style={{ justifyContent: 'flex-end' }}>
      {invalid && <span className="small field-error">Revisa los campos marcados.</span>}
      {saved && !dirty && (
        <span className="small pos row" style={{ gap: 4 }}>
          <Check size={14} /> Guardado
        </span>
      )}
      <button
        className="btn primary"
        disabled={!dirty || invalid}
        onClick={() => {
          onSave();
          setSaved(true);
        }}
      >
        Guardar cambios
      </button>
    </div>
  );
}

function CompanyTab() {
  const { db, setSettings } = useStore();
  const { f, set } = useForm<Company>(db.settings.company);
  const dirty = JSON.stringify(f) !== JSON.stringify(db.settings.company);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');
  const err = {
    rut: optional(f.rut, isRut, 'RUT no válido (revisa el dígito verificador).'),
    phone: optional(f.phone, isPhone, 'Teléfono no válido.'),
    email: optional(f.email, isEmail, 'Correo no válido.'),
    website: optional(f.website, isWebsite, 'Sitio web no válido.'),
    brandColor: optional(f.brandColor, (c) => /^#[0-9a-f]{6}$/i.test(c), 'Usa un color como #0b2a52.'),
  };
  const invalid = Object.values(err).some(Boolean);
  return (
    <div className="stack">
      <Card title="Marca en tus documentos" extra={<span className="small faint">Tus cotizaciones y comprobantes llevan tu logo y tu color, no los de Flotimly</span>}>
        <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
          <div
            className="photo-add"
            style={{ width: 220, height: 110, aspectRatio: 'auto', background: '#fff' }}
            onClick={() => fileRef.current?.click()}
            title="Subir logo"
          >
            {f.logo ? (
              <img src={f.logo} alt="Logo" style={{ maxWidth: 200, maxHeight: 90, objectFit: 'contain' }} />
            ) : (
              <div>
                <ImagePlus size={22} />
                <div>Subir logo (PNG o JPG)</div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const problem = imageProblem(file);
              setLogoError(problem ?? '');
              if (problem) return;
              try {
                set('logo')(await logoToPng(file));
              } catch {
                setLogoError('No se pudo leer la imagen.');
              }
            }}
          />
          <div className="stack" style={{ gap: 12 }}>
            {logoError && <span className="small field-error">{logoError}</span>}
            <Field label="Color principal" hint={err.brandColor ? <span className="field-error">{err.brandColor}</span> : 'Títulos, líneas y tabla de la cotización'}>
              <div className="row" style={{ gap: 8 }}>
                <input type="color" value={f.brandColor || '#0b2a52'} onChange={(e) => set('brandColor')(e.target.value)} style={{ width: 44, height: 36, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
                <TextInput value={f.brandColor} onChange={set('brandColor')} placeholder="#0b2a52" style={{ width: 110 }} />
              </div>
            </Field>
            {f.logo && (
              <button className="btn sm danger" onClick={() => set('logo')(undefined)}>
                <Trash2 size={13} /> Quitar logo
              </button>
            )}
          </div>
        </div>
      </Card>
      <Card title="Datos de la empresa" extra={<span className="small faint">Aparecen en cotizaciones y comprobantes</span>}>
        <div className="form-grid">
          <Field label="Razón social" className="full">
            <TextInput value={f.name} onChange={set('name')} />
          </Field>
          <Field label="RUT" hint={err.rut && <span className="field-error">{err.rut}</span>}>
            <TextInput value={f.rut} onChange={set('rut')} onBlur={() => set('rut')(formatRut(f.rut))} maxLength={12} placeholder="76.123.456-0" />
          </Field>
          <Field label="Giro">
            <TextInput value={f.giro} onChange={set('giro')} />
          </Field>
          <Field label="Dirección" className="full">
            <TextInput value={f.address} onChange={set('address')} />
          </Field>
          <Field label="Teléfono" hint={err.phone && <span className="field-error">{err.phone}</span>}>
            <TextInput value={f.phone} onChange={set('phone')} type="tel" maxLength={20} />
          </Field>
          <Field label="Correo" hint={err.email && <span className="field-error">{err.email}</span>}>
            <TextInput value={f.email} onChange={set('email')} type="email" maxLength={254} />
          </Field>
          <Field label="Sitio web" className="full" hint={err.website && <span className="field-error">{err.website}</span>}>
            <TextInput value={f.website} onChange={set('website')} placeholder="www.tuempresa.cl" maxLength={200} />
          </Field>
        </div>
        <SaveBar dirty={dirty} invalid={invalid} onSave={() => setSettings((s) => ({ ...s, company: f }))} />
      </Card>
    </div>
  );
}

/** Ajusta el logo a máx. 600 px y lo guarda como PNG (mantiene transparencia). */
function logoToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const sc = Math.min(1, 600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function QuoteSettingsTab() {
  const { db, setSettings } = useStore();
  const { f: bank, set } = useForm<BankAccount>(db.settings.bank);
  const [conditions, setConditions] = useState(db.settings.quoteConditions);
  const dirtyBank = JSON.stringify(bank) !== JSON.stringify(db.settings.bank);
  const bankErr = {
    rut: optional(bank.rut, isRut, 'RUT no válido.'),
    email: optional(bank.email, isEmail, 'Correo no válido.'),
    accountNumber: optional(bank.accountNumber, (n) => /^[0-9-]{4,20}$/.test(n.trim()), 'Usa solo números y guiones.'),
  };
  const dirtyCond = conditions !== db.settings.quoteConditions;
  return (
    <div className="grid k2" style={{ alignItems: 'start' }}>
      <Card title="Datos bancarios" extra={<span className="small faint">Se muestran al pie de cada cotización</span>}>
        <div className="form-grid">
          <Field label="Banco">
            <TextInput value={bank.bank} onChange={set('bank')} placeholder="Banco de Chile" />
          </Field>
          <Field label="Tipo de cuenta">
            <Select value={bank.accountType} onChange={set('accountType')} options={['Cuenta Corriente', 'Cuenta Vista', 'Cuenta RUT', 'Cuenta de Ahorro']} />
          </Field>
          <Field label="N° de cuenta" className="full" hint={bankErr.accountNumber && <span className="field-error">{bankErr.accountNumber}</span>}>
            <TextInput value={bank.accountNumber} onChange={set('accountNumber')} maxLength={20} inputMode="numeric" />
          </Field>
          <Field label="Titular" className="full">
            <TextInput value={bank.holder} onChange={set('holder')} />
          </Field>
          <Field label="RUT titular" hint={bankErr.rut && <span className="field-error">{bankErr.rut}</span>}>
            <TextInput value={bank.rut} onChange={set('rut')} onBlur={() => set('rut')(formatRut(bank.rut))} maxLength={12} />
          </Field>
          <Field label="Correo de confirmación" hint={bankErr.email && <span className="field-error">{bankErr.email}</span>}>
            <TextInput value={bank.email} onChange={set('email')} type="email" maxLength={254} />
          </Field>
        </div>
        <SaveBar dirty={dirtyBank} invalid={Object.values(bankErr).some(Boolean)} onSave={() => setSettings((s) => ({ ...s, bank }))} />
      </Card>
      <Card
        title="Condiciones por defecto"
        extra={
          <button className="btn sm ghost" onClick={() => setConditions(DEFAULT_CONDITIONS)}>
            <RotateCcw size={13} /> Restaurar sugeridas
          </button>
        }
      >
        <Field label="Condiciones comerciales" hint="Una por línea. Se copian en cada cotización nueva y puedes modificarlas en cada una.">
          <textarea className="input" style={{ minHeight: 236 }} value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </Field>
        <SaveBar dirty={dirtyCond} onSave={() => setSettings((s) => ({ ...s, quoteConditions: conditions }))} />
      </Card>
    </div>
  );
}

function ParamsTab() {
  const { db, setSettings } = useStore();
  const { f, set } = useForm<Params>(db.settings.params);
  const dirty = JSON.stringify(f) !== JSON.stringify(db.settings.params);
  return (
    <Card title="Parámetros de cálculo" extra={<span className="small faint">Valores por defecto para nuevas cotizaciones</span>}>
      <div className="form-grid c3">
        <Field label="Precio diésel" hint="Referencia actual por litro">
          <NumInput value={f.fuelPrice} onChange={set('fuelPrice')} prefix="$" suffix="/L" />
        </Field>
        <Field label="IVA">
          <NumInput value={f.ivaPct} onChange={set('ivaPct')} suffix="%" />
        </Field>
        <Field label="Margen objetivo" hint="Sobre el precio de venta">
          <NumInput value={f.defaultMarginPct} onChange={set('defaultMarginPct')} suffix="%" />
        </Field>
        <Field label="Desgaste / mantención" hint="Costo variable por km">
          <NumInput value={f.maintenancePerKm} onChange={set('maintenancePerKm')} prefix="$" suffix="/km" />
        </Field>
        <Field label="Costo diario conductor">
          <NumInput value={f.defaultDriverRate} onChange={set('defaultDriverRate')} prefix="$" />
        </Field>
        <Field label="Validez de cotizaciones">
          <NumInput value={f.quoteValidityDays} onChange={set('quoteValidityDays')} suffix="días" />
        </Field>
        <Field label="Alertar vencimientos con" hint="Revisión técnica, seguros, licencias">
          <NumInput value={f.alertDays} onChange={set('alertDays')} suffix="días" />
        </Field>
      </div>
      <SaveBar dirty={dirty} onSave={() => setSettings((s) => ({ ...s, params: f }))} />
    </Card>
  );
}

const blankTariff = (): Tariff => ({ id: '', name: '', unit: 'km', value: 0 });

function TariffsTab() {
  const { db, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Tariff | null>(null);
  const { f, set, setF } = useForm<Tariff>(blankTariff());
  useEffect(() => {
    if (edit) setF(edit);
  }, [edit, setF]);
  return (
    <>
      <div className="card table-wrap">
        <div className="toolbar">
          <b>Tarifario</b>
          <span className="small faint">Úsalo en cotizaciones con el modo “Según tarifa”</span>
          <span className="spacer" />
          <button className="btn primary sm" onClick={() => setEdit(blankTariff())}>
            <Plus size={14} /> Nueva tarifa
          </button>
        </div>
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Vehículo</th>
              <th>Unidad</th>
              <th className="right">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.tariffs.map((t) => (
              <tr key={t.id} className="click" onClick={() => setEdit(t)}>
                <td>
                  <div className="cell-title">{t.name}</div>
                  <div className="cell-sub">{t.description}</div>
                </td>
                <td>{t.vehicleType ?? <span className="faint">Todos</span>}</td>
                <td>por {t.unit}</td>
                <td className="right tnum strong">{clp(t.value)}</td>
                <td>
                  <div className="table-actions">
                    <button className="icon-btn">
                      <Pencil size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {db.tariffs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 30 }}>
                  Sin tarifas.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={f.id ? 'Editar tarifa' : 'Nueva tarifa'}
        footer={
          <>
            {f.id && (
              <button
                className="btn danger left"
                onClick={() => {
                  if (confirmDelete('esta tarifa')) {
                    remove('tariffs', f.id);
                    setEdit(null);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button className="btn" onClick={() => setEdit(null)}>
              Cancelar
            </button>
            <button
              className="btn primary"
              disabled={!f.name.trim()}
              onClick={() => {
                upsert('tariffs', { ...f, id: f.id || uid() });
                setEdit(null);
              }}
            >
              Guardar
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nombre *" className="full">
            <TextInput value={f.name} onChange={set('name')} />
          </Field>
          <Field label="Unidad de cobro">
            <Select value={f.unit} onChange={set('unit')} options={[{ value: 'km', label: 'Por km' }, { value: 'viaje', label: 'Por viaje' }, { value: 'kg', label: 'Por kg' }, { value: 'día', label: 'Por día' }]} />
          </Field>
          <Field label="Valor">
            <NumInput value={f.value} onChange={set('value')} prefix="$" />
          </Field>
          <Field label="Tipo de vehículo" className="full">
            <Select value={f.vehicleType ?? ''} onChange={(v) => set('vehicleType')((v || undefined) as Tariff['vehicleType'])} placeholder="Todos" options={VEHICLE_TYPES} />
          </Field>
          <Field label="Descripción" className="full">
            <TextInput value={f.description} onChange={set('description')} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

const blankUser = (): User => ({ id: '', name: '', email: '', role: 'Operaciones', active: true });

function UsersTab() {
  const { db, upsert, remove, user: me } = useStore();
  const [edit, setEdit] = useState<User | null>(null);
  const { f, set, setF } = useForm<User>(blankUser());
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (edit) setF(edit);
    setPw('');
  }, [edit, setF]);
  const isNew = !f.id;
  const isMe = !!f.id && f.id === me?.id;
  const emailError = f.email && !isEmail(f.email) ? 'Correo no válido.' : f.email && db.users.some((u) => u.id !== f.id && u.email.trim().toLowerCase() === f.email.trim().toLowerCase()) ? 'Ya existe un usuario con ese correo.' : undefined;
  const pwError = pw || isNew ? passwordProblem(pw, f.email) : null;
  const save = async () => {
    setSaving(true);
    try {
      const passwordHash = pw ? await hashPassword(pw) : f.passwordHash;
      if (upsert('users', { ...f, name: f.name.trim(), email: f.email.trim().toLowerCase(), id: f.id || uid(), passwordHash })) setEdit(null);
    } finally {
      setSaving(false);
    }
  };
  const limit = planInfo(db.settings.plan).maxUsers;
  return (
    <>
      <div className="card table-wrap">
        <div className="toolbar">
          <b>Usuarios</b>
          <span className="small faint">
            {Number.isFinite(limit) ? `${db.users.length} de ${limit} usuarios incluidos en tu plan` : `${db.users.length} usuarios · ilimitados en tu plan`}
          </span>
          <span className="spacer" />
          <button className="btn primary sm" disabled={db.users.length >= limit} onClick={() => setEdit(blankUser())}>
            <Plus size={14} /> Invitar usuario
          </button>
        </div>
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className="click" onClick={() => setEdit(u)}>
                <td className="cell-title">
                  {u.name} {u.id === me?.id && <Badge tone="blue" plain>Tú</Badge>}
                </td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <StatusBadge status={u.active ? 'Activo' : 'Inactivo'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={f.id ? 'Editar usuario' : 'Nuevo usuario'}
        footer={
          <>
            {f.id && f.id !== me?.id && (
              <button
                className="btn danger left"
                onClick={() => {
                  if (confirmDelete(f.name)) {
                    remove('users', f.id);
                    setEdit(null);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button className="btn" onClick={() => setEdit(null)}>
              Cancelar
            </button>
            <button className="btn primary" disabled={saving || !f.name.trim() || !f.email || !!emailError || !!pwError} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nombre *" className="full">
            <TextInput value={f.name} onChange={set('name')} maxLength={80} />
          </Field>
          <Field label="Correo *" className="full" hint={emailError && <span className="field-error">{emailError}</span>}>
            <TextInput value={f.email} onChange={set('email')} type="email" maxLength={254} autoComplete="off" />
          </Field>
          <Field label="Rol" hint={isMe ? 'No puedes cambiar tu propio rol.' : ROLE_INFO[f.role]}>
            <Select value={f.role} onChange={(v) => (isMe ? null : set('role')(v))} options={ROLES} />
          </Field>
          <Field
            label={isNew ? 'Contraseña *' : 'Nueva contraseña'}
            hint={pwError ? <span className="field-error">{pw ? pwError : `Mínimo ${MIN_PASSWORD} caracteres, con letras y números.`}</span> : isNew ? 'Se guarda cifrada: nadie puede verla, ni siquiera un administrador.' : 'Déjala vacía para mantener la actual. Al cambiarla se cierran sus sesiones abiertas.'}
          >
            <TextInput value={pw} onChange={setPw} type="password" autoComplete="new-password" maxLength={128} />
          </Field>
          <div className="field">
            <span>Activo</span>
            <Toggle on={f.active} onChange={(v) => (isMe ? null : set('active')(v))} />
          </div>
        </div>
      </Modal>
    </>
  );
}

function PlanTab() {
  const { db, plan, setSettings } = useStore();
  const order = PLAN_LIST.findIndex((p) => p.key === plan);
  const vehicles = db.vehicles.length;
  return (
    <div className="grid k3 plans-grid">
      {PLAN_LIST.map((p, i) => {
        const current = p.key === plan;
        const over = vehicles > p.maxVehicles;
        return (
          <div key={p.key} className={`card plan-card ${current ? 'current' : ''} ${p.key === 'flota_plus' ? 'premium' : ''}`}>
            {current ? (
              <span className="ribbon badge blue">Plan actual</span>
            ) : p.key === bestValueKey() ? (
              <span className="ribbon plan-badge">Más conveniente</span>
            ) : p.key === 'flota_plus' ? (
              <span className="ribbon plan-badge premium">Premium</span>
            ) : null}
            <div>
              <div className="small faint strong">PLAN</div>
              <h3>{p.name}</h3>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {p.tagline}
              </p>
            </div>
            <div>
              <div className="price">
                {clp(p.price)} <small>+ IVA / mes</small>
              </div>
              <div className="small muted">
                {clp(perVehicle(p))} por vehículo · primeros {PROMO.months} meses {clp(promoPrice(p))} + IVA
              </div>
            </div>
            <div className="plan-limits">
              <span>
                <Truck size={15} /> {vehiclesLabel(p)}
              </span>
              <span>
                <Users size={15} /> {usersLabel(p)}
              </span>
            </div>
            <ul>
              {p.includesPrevious && (
                <li>
                  <Check size={16} /> <b>Todo lo del plan {p.includesPrevious}, más:</b>
                </li>
              )}
              {p.items.map((x) => (
                <li key={x} className={p.includesPrevious ? 'extra' : ''}>
                  {p.includesPrevious ? <Crown size={16} /> : <Check size={16} />} {x}
                </li>
              ))}
            </ul>
            {current && (
              <p className={`small ${over ? 'neg strong' : 'muted'}`} style={{ margin: 0 }}>
                {over
                  ? `Tienes ${vehicles} vehículos: superas el límite de este plan.`
                  : `Usas ${vehicles} de ${p.maxVehicles} vehículos.`}
              </p>
            )}
            <button
              className={`btn ${!current && i > order ? 'accent' : ''}`}
              disabled={current}
              onClick={() => setSettings((s) => ({ ...s, plan: p.key }))}
            >
              {current ? 'Plan activo' : i > order ? `Mejorar a ${p.name}` : `Cambiar a ${p.name}`}
            </button>
          </div>
        );
      })}
      <p className="small faint" style={{ gridColumn: '1 / -1' }}>
        Precios en pesos chilenos, más IVA. Oferta de lanzamiento: {PROMO.trialDays} días gratis y {PROMO.discount * 100}% de descuento los primeros {PROMO.months} meses. En esta versión de demostración puedes alternar entre planes para probar las funciones.
      </p>
    </div>
  );
}

function DataTab() {
  const { db, replaceDB, resetDemo, clearData } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const size = new Blob([JSON.stringify(db)]).size;
  return (
    <div className="stack">
      <ExportCard />
      <ImportCard />
    <div className="grid k2">
      <Card title="Respaldo técnico (JSON)">
        <p className="muted small" style={{ marginTop: 0 }}>
          Los datos se guardan en este navegador ({(size / 1024).toFixed(0)} KB usados). Exporta un respaldo periódicamente.
        </p>
        <div className="row wrap">
          <button
            className="btn primary"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `flotimly-respaldo-${today()}.json`;
              track('data_exported', { format: 'json' });
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} /> Exportar respaldo
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Importar respaldo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > MAX_UPLOAD.json) {
                alert('El respaldo pesa más de 60 MB.');
                e.target.value = '';
                return;
              }
              try {
                const data = JSON.parse(await file.text()) as DB;
                const lists = ['vehicles', 'drivers', 'clients', 'trips', 'expenses', 'quotes', 'proofs', 'tariffs'] as const;
                if (!data || typeof data !== 'object' || typeof data.settings !== 'object' || !lists.every((k) => Array.isArray(data[k]))) throw new Error();
                if (window.confirm('Esto reemplazará los datos actuales con los del respaldo. Los usuarios y el plan se mantienen. ¿Continuar?')) replaceDB(data);
              } catch {
                alert('El archivo no es un respaldo válido de Flotimly.');
              }
              e.target.value = '';
            }}
          />
        </div>
      </Card>
      <Card title="Datos de demostración">
        <p className="muted small" style={{ marginTop: 0 }}>
          Restaura los datos de ejemplo o deja la cuenta vacía para cargar tu propia operación. Se conservan los usuarios y el plan.
        </p>
        <div className="row wrap">
          <button className="btn" onClick={() => window.confirm('¿Restaurar los datos de demostración? Se perderán los cambios.') && resetDemo()}>
            <RotateCcw size={15} /> Restaurar demo
          </button>
          <button className="btn danger" onClick={() => window.confirm('¿Borrar flota, clientes, viajes, gastos, cotizaciones y comprobantes?') && clearData()}>
            <Trash2 size={15} /> Empezar desde cero
          </button>
        </div>
      </Card>
    </div>
    </div>
  );
}
