const DUTY_CAT: Record<string, string> = { TL: 'customs', RT: 'raak', FA: 'levy', SU: 'excise', FK: 'excise', GA: 'packaging', MA: 'packaging', GB: 'packaging', MB: 'packaging', GG: 'packaging', MG: 'packaging', GP: 'packaging', MP: 'packaging', FF: 'export' };
export const CAT_LABEL: Record<string, string> = { customs: 'Toll (TL)', raak: 'RÅK (RT)', excise: 'Særavgift', packaging: 'Emballasje', levy: 'Forskningsavgift', vat: 'MVA', export: 'Eksportavgift', other: 'Annet' };
export const chargeCategory = (c: any) => c.source === 'vat' ? 'vat' : (DUTY_CAT[c.charge_type] || 'other');
