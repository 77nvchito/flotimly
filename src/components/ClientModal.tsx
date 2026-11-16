import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Field, Modal, NumInput, TextInput, confirmDelete, useForm } from './ui';
import { useStore } from '../store/store';
import type { Client } from '../store/types';
import { uid } from '../lib/format';

export const blankClient = (): Client => ({ id: '', name: '', rut: '', contact: '', email: '', phone: '', address: '', paymentTermsDays: 30 });

/** Formulario de cliente. Se usa en Operaciones → Clientes y como atajo desde el cotizador. */
export function ClientModal({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved?: (c: Client) => void }) {
  const { db, upsert, remove } = useStore();
  const { f, set, setF } = useForm<Client>(blankClient());
  useEffect(() => {
    if (client) setF(client);
  }, [client, setF]);
  const isNew = !client?.id;
  return (
    <Modal
      open={!!client}
      onClose={onClose}
      title={isNew ? 'Nuevo cliente' : f.name}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger left"
              onClick={() => {
                const used = db.trips.some((t) => t.clientId === f.id);
                if (used) return alert('Este cliente tiene viajes asociados y no puede eliminarse.');
                if (confirmDelete(f.name)) {
                  remove('clients', f.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={15} /> Eliminar
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            disabled={!f.name.trim()}
            onClick={() => {
              const saved = { ...f, id: f.id || uid() };
              upsert('clients', saved);
              onSaved?.(saved);
              onClose();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Razón social *" className="full">
          <TextInput value={f.name} onChange={set('name')} />
        </Field>
        <Field label="RUT">
          <TextInput value={f.rut} onChange={set('rut')} placeholder="76.123.456-7" />
        </Field>
        <Field label="Plazo de pago">
          <NumInput value={f.paymentTermsDays} onChange={set('paymentTermsDays')} suffix="días" />
        </Field>
        <Field label="Contacto">
          <TextInput value={f.contact} onChange={set('contact')} />
        </Field>
        <Field label="Teléfono">
          <TextInput value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Correo" className="full">
          <TextInput value={f.email} onChange={set('email')} type="email" />
        </Field>
        <Field label="Dirección" className="full">
          <TextInput value={f.address} onChange={set('address')} />
        </Field>
      </div>
    </Modal>
  );
}
