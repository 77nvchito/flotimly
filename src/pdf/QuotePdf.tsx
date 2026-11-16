import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { BankAccount, Client, Company, Quote, Vehicle } from '../store/types';
import type { QuoteBreakdown } from '../lib/calc';
import { clp, fmtDate, num } from '../lib/format';

// Sin guiones de corte automáticos (no partir correos, sitios web ni nombres)
Font.registerHyphenationCallback((word) => [word]);

/** "C-0009" → "0009" */
export const quoteNumber = (code: string) => code.replace(/^[A-Za-z]+-/, '');

export interface QuotePdfProps {
  quote: Quote;
  calc: QuoteBreakdown;
  company: Company;
  bank: BankAccount;
  client?: Client;
  vehicle?: Vehicle;
  ivaPct: number;
  conditions: string;
}

const INK = '#1d1d1f';
const MUTED = '#6e6e73';
const LINE = '#e3e3e8';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 44, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 9.5, color: INK, lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottomWidth: 2 },
  logo: { maxHeight: 58, maxWidth: 190, objectFit: 'contain', marginBottom: 8 },
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  companyName: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  muted: { color: MUTED },
  titleBox: { alignItems: 'flex-end' },
  title: { fontSize: 19, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  metaLabel: { color: MUTED, width: 70, textAlign: 'right', marginRight: 6 },
  cols: { flexDirection: 'row', marginTop: 18, marginBottom: 18 },
  box: { flex: 1, padding: 12, borderRadius: 6, backgroundColor: '#f6f6f8' },
  boxTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, marginBottom: 6 },
  bold: { fontFamily: 'Helvetica-Bold' },
  tHead: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tHeadText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  tRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: LINE },
  cDesc: { flex: 1 },
  cQty: { width: 60, textAlign: 'center' },
  cAmt: { width: 100, textAlign: 'right' },
  totals: { marginLeft: 'auto', width: 230, marginTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1.5, fontSize: 12.5, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 10 },
  bankBox: { marginTop: 20, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: LINE, flexDirection: 'row', flexWrap: 'wrap' },
  bankItem: { width: '50%', flexDirection: 'row', marginBottom: 3 },
  bankLabel: { width: 90, color: MUTED },
});

export function QuotePdf({ quote: q, calc: c, company, bank, client, vehicle, ivaPct, conditions }: QuotePdfProps) {
  const brand = /^#[0-9a-f]{6}$/i.test(company.brandColor ?? '') ? company.brandColor! : '#0b2a52';
  const lines = conditions
    .split('\n')
    .map((l) => l.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean);
  const hasBank = !!(bank.bank || bank.accountNumber);

  return (
    <Document title={`Cotización N° ${quoteNumber(q.code)} - ${company.name}`} author={company.name} creator={company.name} producer={company.name}>
      <Page size="A4" style={s.page}>
        <View style={[s.header, { borderBottomColor: brand }]}>
          <View style={{ maxWidth: 300 }}>
            {company.logo ? (
              <>
                <Image src={company.logo} style={s.logo} />
                <Text style={s.companyName}>{company.name}</Text>
              </>
            ) : (
              <Text style={[s.brandName, { color: brand }]}>{company.name}</Text>
            )}
            <Text style={s.muted}>
              RUT {company.rut}
              {company.giro ? `  ·  ${company.giro}` : ''}
            </Text>
            {company.address ? <Text style={s.muted}>{company.address}</Text> : null}
            {company.phone || company.email ? <Text style={s.muted}>{[company.phone, company.email].filter(Boolean).join('  ·  ')}</Text> : null}
            {company.website ? <Text style={s.muted}>{company.website}</Text> : null}
          </View>
          <View style={s.titleBox}>
            <Text style={[s.title, { color: brand }]}>Cotización N° {quoteNumber(q.code)}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Fecha</Text>
              <Text>{fmtDate(q.date)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Válida hasta</Text>
              <Text style={s.bold}>{fmtDate(q.validUntil)}</Text>
            </View>
          </View>
        </View>

        <View style={s.cols}>
          <View style={[s.box, { marginRight: 10 }]}>
            <Text style={s.boxTitle}>CLIENTE</Text>
            <Text style={s.bold}>{client?.name ?? '—'}</Text>
            {client?.rut ? <Text>RUT {client.rut}</Text> : null}
            {client?.contact ? <Text>Atención: {client.contact}</Text> : null}
            {client?.email || client?.phone ? <Text style={s.muted}>{[client?.email, client?.phone].filter(Boolean).join('  ·  ')}</Text> : null}
            {client?.address ? <Text style={s.muted}>{client.address}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>DETALLE DEL SERVICIO</Text>
            <Text>
              <Text style={s.bold}>Ruta: </Text>
              {q.origin} – {q.destination}
            </Text>
            <Text>
              <Text style={s.bold}>Modalidad: </Text>
              {q.roundTrip ? 'Ida y vuelta' : 'Solo ida'} ({num(c.km)} km)
            </Text>
            {vehicle ? (
              <Text>
                <Text style={s.bold}>Vehículo: </Text>
                {vehicle.type} (capacidad {num(vehicle.capacityKg)} kg)
              </Text>
            ) : null}
            <Text>
              <Text style={s.bold}>Condición de pago: </Text>
              {client?.paymentTermsDays ?? 30} días
            </Text>
          </View>
        </View>

        <View style={[s.tHead, { backgroundColor: brand }]}>
          <Text style={[s.tHeadText, s.cDesc]}>Descripción</Text>
          <Text style={[s.tHeadText, s.cQty]}>Cantidad</Text>
          <Text style={[s.tHeadText, s.cAmt]}>Valor neto</Text>
        </View>
        <View style={s.tRow}>
          <View style={s.cDesc}>
            <Text style={s.bold}>
              Servicio de transporte {q.origin} – {q.destination}
            </Text>
            <Text style={s.muted}>
              {[q.cargo || 'Carga general', q.weightKg ? `${num(q.weightKg)} kg` : '', q.roundTrip ? 'ida y vuelta' : 'solo ida'].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <Text style={s.cQty}>1</Text>
          <Text style={s.cAmt}>{clp(c.net)}</Text>
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal neto</Text>
            <Text>{clp(c.net)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.muted}>IVA ({ivaPct}%)</Text>
            <Text>{clp(c.iva)}</Text>
          </View>
          <View style={[s.grand, { borderTopColor: brand, color: brand }]}>
            <Text>Total</Text>
            <Text>{clp(c.total)}</Text>
          </View>
        </View>

        {q.notes ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Observaciones</Text>
            <Text>{q.notes}</Text>
          </View>
        ) : null}

        {lines.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Condiciones comerciales</Text>
            {lines.map((l, i) => (
              <View style={s.bullet} key={i}>
                <Text style={[s.bulletDot, { color: brand }]}>•</Text>
                <Text style={{ flex: 1 }}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        {hasBank && (
          <View wrap={false}>
            <View style={s.bankBox}>
              <Text style={[s.sectionTitle, { width: '100%' }]}>Datos para transferencia</Text>
              {[
                ['Banco', bank.bank],
                ['Tipo de cuenta', bank.accountType],
                ['N° de cuenta', bank.accountNumber],
                ['Titular', bank.holder],
                ['RUT', bank.rut],
                ['Correo', bank.email],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <View style={s.bankItem} key={k}>
                    <Text style={s.bankLabel}>{k}</Text>
                    <Text style={s.bold}>{v}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

      </Page>
    </Document>
  );
}
