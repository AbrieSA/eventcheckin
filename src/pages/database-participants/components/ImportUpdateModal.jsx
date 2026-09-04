import React, { useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const normalize = (value) => String(value || '').trim().toLowerCase();
const compact = (value) => normalize(value).replace(/[^a-z0-9]/g, '');

const EVENTME_FIELDS = [
  { key: 'id', label: 'EventMe ID', match: true, aliases: ['id', 'eventme id', 'record id', 'uuid'] },
  { key: 'participantId', label: 'Participant ID', match: true, aliases: ['participant id', 'participant number', 'member id'] },
  { key: 'firstName', label: 'First name', match: true, aliases: ['first name', 'firstname', 'given name'] },
  { key: 'lastName', label: 'Last name', match: true, aliases: ['last name', 'lastname', 'surname', 'family name'] },
  { key: 'email', label: 'Email', match: true, aliases: ['email', 'email address', 'participant email'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'mobile number'] },
  { key: 'role', label: 'Role', aliases: ['role', 'participant role'] },
  { key: 'dateOfBirth', label: 'Date of birth', aliases: ['date of birth', 'dob', 'birth date'] },
  { key: 'age', label: 'Age', aliases: ['age', 'participant age', 'age in years'] },
  { key: 'is18OrOver', label: '18 or over', aliases: ['is 18 or over', '18 or over', 'adult', 'is adult'] },
  { key: 'hasAllergies', label: 'Has allergies', aliases: ['has allergies', 'allergies yes no', 'allergy flag'] },
  { key: 'allergiesDetails', label: 'Allergies details', aliases: ['allergies', 'allergy details', 'allergies details', 'allergies list'] },
  { key: 'hasMedicalConditions', label: 'Has medical conditions', aliases: ['has medical conditions', 'medical conditions yes no', 'medical condition flag'] },
  { key: 'medicalConditionDetails', label: 'Medical condition details', aliases: ['medical conditions', 'medical condition details', 'medical details', 'medical notes'] },
  { key: 'medicare', label: 'Medicare', aliases: ['medicare', 'medicare number', 'medicare details'] },
  { key: 'emergencyContactName', label: 'Emergency contact first name', aliases: ['emergency contact name', 'emergency contact first name'] },
  { key: 'emergencyContactSurname', label: 'Emergency contact surname', aliases: ['emergency contact surname', 'emergency contact last name'] },
  { key: 'emergencyContactPhone', label: 'Emergency contact phone', aliases: ['emergency contact phone', 'emergency phone'] },
  { key: 'emergencyContactEmail', label: 'Emergency contact email', aliases: ['emergency contact email', 'emergency email'] },
  { key: 'emergencyContactRelationshipToMinor', label: 'Emergency contact relationship', aliases: ['emergency contact relationship', 'relationship to participant'] },
  { key: 'personToGoHomeWith', label: 'Person they can go home with', aliases: ['person they can go home with', 'person to go home with', 'go home with', 'pickup person', 'pick up person'] },
  { key: 'formReceived', label: 'Form received', aliases: ['form received', 'form complete', 'signed form received'] },
  { key: 'mediaConsentGiven', label: 'Media consent', aliases: ['media consent', 'media consent given', 'photo consent'] },
  { key: 'emergencyTreatmentConsentGiven', label: 'Emergency treatment consent', aliases: ['emergency treatment consent', 'medical treatment consent', 'emergency consent'] },
  { key: 'futureContactPermissionGiven', label: 'Future contact permission', aliases: ['future contact permission', 'future contact consent', 'contact permission'] },
  { key: 'selfSignOutPermission', label: 'Self sign-out permission', aliases: ['self sign out permission', 'self sign-out permission', 'self sign out consent'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'participant notes'] }
];

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const autoMapHeaders = (headers) => headers.reduce((mapping, header, index) => {
  const field = EVENTME_FIELDS.find((candidate) =>
    [candidate.label, ...candidate.aliases].some((alias) => compact(alias) === compact(header))
  );
  mapping[index] = field?.key || '';
  return mapping;
}, {});

const findParticipants = (row, mappings, participants) => {
  const valueFor = (fieldKey) => {
    const index = Object.keys(mappings).find((columnIndex) => mappings[columnIndex] === fieldKey);
    return index === undefined ? '' : row[Number(index)] || '';
  };
  const id = valueFor('id');
  const participantId = valueFor('participantId');
  const email = valueFor('email');
  const firstName = valueFor('firstName');
  const lastName = valueFor('lastName');
  if (id) return participants.filter((participant) => normalize(participant?.id) === normalize(id));
  if (participantId) return participants.filter((participant) => normalize(participant?.participantId) === normalize(participantId));
  if (email) return participants.filter((participant) => normalize(participant?.email) === normalize(email));
  if (firstName && lastName) return participants.filter((participant) => normalize(participant?.firstName) === normalize(firstName) && normalize(participant?.lastName) === normalize(lastName));
  return [];
};

const ImportUpdateModal = ({ participants, onClose }) => {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [csvRows, setCsvRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [openMapping, setOpenMapping] = useState(null);
  const [fileError, setFileError] = useState('');
  const [step, setStep] = useState(1);
  const headers = csvRows[0] || [];
  const dataRows = csvRows.slice(1);
  const mappedColumns = headers.filter((_, index) => mappings[index]);
  const duplicateTargets = Object.values(mappings).filter(Boolean).filter((value, index, values) => values.indexOf(value) !== index);
  const mappedTargets = Object.values(mappings);
  const hasIdentifier = mappedTargets.some((key) => ['id', 'participantId', 'email'].includes(key))
    || (mappedTargets.includes('firstName') && mappedTargets.includes('lastName'));

  const rowPreview = useMemo(() => dataRows.slice(0, 50).map((row, index) => {
    const matches = findParticipants(row, mappings, participants);
    return {
      rowNumber: index + 2,
      status: matches.length > 1 ? 'Ambiguous' : matches.length === 1 ? 'Matched' : 'Unmatched',
      participant: matches.length === 1 ? `${matches[0]?.firstName || ''} ${matches[0]?.lastName || ''}`.trim() : '—'
    };
  }), [dataRows, mappings, participants]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    setFileError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Choose a CSV file to continue.');
      event.target.value = '';
      return;
    }
    try {
      const rows = parseCsv(await file.text());
      if (!rows[0]?.length || rows.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
      setFileName(file.name);
      setCsvRows(rows);
      setMappings(autoMapHeaders(rows[0]));
      setStep(2);
    } catch (error) {
      setFileError(error?.message || 'The CSV could not be read.');
      event.target.value = '';
    }
  };

  const resetFile = () => {
    setFileName('');
    setCsvRows([]);
    setMappings({});
    setFileError('');
    setStep(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canReview = mappedColumns.length > 0 && hasIdentifier && duplicateTargets.length === 0;
  const matchedCount = rowPreview.filter((row) => row.status === 'Matched').length;
  const problemCount = rowPreview.filter((row) => row.status !== 'Matched').length;

  const selectMapping = (columnIndex, value) => {
    setMappings((current) => ({ ...current, [columnIndex]: value }));
    setOpenMapping(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between">
            <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"><Icon name="Eye" size={14} />Preview only</div><h2 className="text-2xl font-bold text-slate-900">Import participant updates</h2></div>
            <Button onClick={onClose} variant="surface" size="icon" iconName="X" aria-label="Close import updates" className="rounded-full" />
          </div>
          <div className="relative mt-6 w-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} aria-label="Import progress">
            <div className="absolute rounded-full" style={{ left: '16.67%', right: '16.67%', top: '16px', height: '3px', backgroundColor: '#cbd5e1' }}><div className="h-full rounded-full transition-all" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%', backgroundColor: 'var(--color-primary)' }} /></div>
            {['Choose file', 'Map fields', 'Review'].map((label, index) => { const number = index + 1; const active = number === step; const complete = number < step; return <div key={label} className="relative flex flex-col items-center text-center"><span className={`z-10 flex shrink-0 aspect-square items-center justify-center rounded-full border-2 text-sm font-bold ${complete || active ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-400'}`} style={{ width: '36px', height: '36px', minWidth: '36px', borderRadius: '9999px' }}>{complete ? <Icon name="Check" size={17} /> : number}</span><span className={`mt-2 text-xs font-semibold sm:text-sm ${active ? 'text-primary' : complete ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span></div>; })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
          {step === 1 && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center rounded-[24px] border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="Upload" size={28} /></span>
              <span className="text-base font-semibold text-slate-900">Choose any CSV file</span>
              <span className="mt-2 text-sm text-slate-600">We’ll inspect the headings, suggest mappings, and flag anything that needs attention.</span>
            </button>
          )}

          {step === 2 && fileName && (
            <>
              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Icon name="FileSpreadsheet" size={21} /></span><div><p className="font-semibold text-slate-900">{fileName}</p><p className="text-sm text-slate-600">{headers.length} columns · {dataRows.length} rows</p></div></div>
                <Button variant="surface" onClick={resetFile} className="rounded-full">Choose another file</Button>
              </div>

              <section className="mb-6" aria-labelledby="column-map-title">
                <div className="mb-4 flex items-end justify-between"><div><h3 id="column-map-title" className="text-xl font-bold text-slate-900">Map your fields</h3><p className="text-sm text-slate-600">CSV fields and EventMe destinations are on the left; examples from your file are on the right.</p></div><span className="text-sm font-medium text-slate-600">{mappedColumns.length}/{headers.length} mapped</span></div>
                {mappedColumns.length === 0 && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">These are all unmapped. Choose an EventMe field for each CSV column you want to use.</div>}
                {!hasIdentifier && <div role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Map an EventMe ID, Participant ID, email, or both first and last name so participants can be matched.</div>}
                <div className="overflow-visible rounded-2xl border border-slate-200">
                  <div className="grid bg-slate-900 text-sm font-semibold text-white" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(110px, 1fr)' }}><div className="px-5 py-3">CSV field and EventMe mapping</div><div className="border-l border-white/15 px-5 py-3">Examples from your file</div></div>
                  {headers.map((header, index) => (
                    <div key={`${header}-${index}`} className="relative grid border-t border-slate-200 first:border-t-0" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(110px, 1fr)', zIndex: openMapping === index ? 100 : 1 }}>
                      <div className="px-5 py-4"><div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">CSV</span><span className="font-semibold text-slate-900">{header || '(Blank heading)'}</span><Icon name="ArrowRight" size={15} className="text-slate-400" /><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!mappings[index] ? 'bg-amber-100 text-amber-800' : duplicateTargets.includes(mappings[index]) ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{!mappings[index] ? 'Unmapped' : duplicateTargets.includes(mappings[index]) ? 'Duplicate mapping' : 'Mapped'}</span></div><div className="relative w-full"><button id={`mapping-${index}`} type="button" aria-haspopup="listbox" aria-expanded={openMapping === index} onClick={() => setOpenMapping((current) => current === index ? null : index)} className="flex w-full items-center justify-between gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-left text-sm text-slate-900 shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"><span>{EVENTME_FIELDS.find((field) => field.key === mappings[index])?.label || 'Unmapped — ignore this column'}{EVENTME_FIELDS.find((field) => field.key === mappings[index])?.match ? ' (matching)' : ''}</span><Icon name="ChevronDown" size={18} className={`shrink-0 transition-transform ${openMapping === index ? 'rotate-180' : ''}`} /></button>{openMapping === index && <div role="listbox" aria-labelledby={`mapping-${index}`} className="absolute max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.16)]" style={{ left: 0, top: 'calc(100% + 8px)', width: '100%', minWidth: '100%', zIndex: 110 }}><button type="button" role="option" aria-selected={!mappings[index]} onClick={() => selectMapping(index, '')} className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm text-slate-700 transition-colors duration-150 hover:!bg-emerald-100 focus:!bg-emerald-100 focus:outline-none"><Icon name="CircleOff" size={18} className="shrink-0 text-slate-500" /><span>Unmapped — ignore this column</span></button>{EVENTME_FIELDS.map((field) => <button key={field.key} type="button" role="option" aria-selected={mappings[index] === field.key} onClick={() => selectMapping(index, field.key)} className={`flex w-full items-center gap-3 border-t border-slate-100 px-5 py-3 text-left text-sm transition-colors duration-150 hover:!bg-emerald-100 focus:!bg-emerald-100 focus:outline-none ${mappings[index] === field.key ? 'bg-primary/5 font-semibold text-primary' : 'text-slate-900'}`}><Icon name={mappings[index] === field.key ? 'Check' : 'ArrowRight'} size={18} className={`shrink-0 ${mappings[index] === field.key ? 'text-primary' : 'text-slate-500'}`} /><span>{field.label}{field.match ? ' (matching)' : ''}</span></button>)}</div>}</div>
                      </div>
                      <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4 md:border-l md:border-t-0"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">Examples</p><div className="space-y-1.5">{dataRows.slice(0, 3).map((row, rowIndex) => <p key={rowIndex} className="truncate rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">{row[index] || <span className="italic text-slate-400">Blank</span>}</p>)}</div></div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {step === 3 && (
            <section aria-labelledby="review-title"><div className="mb-5"><h3 id="review-title" className="text-xl font-bold text-slate-900">Review participant matches</h3><p className="mt-1 text-sm text-slate-600">Problems appear directly on their row. No changes can be applied in this frontend preview.</p></div><div className="mb-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-2xl font-bold text-emerald-800">{matchedCount}</p><p className="text-sm text-emerald-700">Matched rows</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-2xl font-bold text-amber-800">{problemCount}</p><p className="text-sm text-amber-700">Rows needing attention</p></div></div><div className="overflow-hidden rounded-2xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">CSV row</th><th className="px-4 py-3">EventMe participant</th><th className="px-4 py-3">Result</th></tr></thead><tbody className="divide-y divide-slate-200">{rowPreview.map((row) => <tr key={row.rowNumber}><td className="px-4 py-3 text-slate-500">{row.rowNumber}</td><td className="px-4 py-3 font-medium text-slate-900">{row.participant}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'Matched' ? 'bg-emerald-100 text-emerald-800' : row.status === 'Ambiguous' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{row.status}</span></td></tr>)}</tbody></table>{dataRows.length > 50 && <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">Showing the first 50 rows.</p>}</div></section>
          )}
          {fileError && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fileError}</div>}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-sm text-slate-600">This preview stays in your browser. No participant data is changed.</p>
          <div className="flex justify-end gap-3"><Button variant="surface" onClick={step === 1 ? onClose : () => setStep((current) => current - 1)} className="rounded-full">{step === 1 ? 'Cancel' : 'Previous'}</Button>{step < 3 ? <Button onClick={() => setStep((current) => current + 1)} disabled={step === 1 ? !fileName : !canReview} iconName="ArrowRight" iconPosition="right" className="rounded-full">Next</Button> : <Button disabled iconName="Upload" className="rounded-full" title="Backend update is not implemented">Apply updates</Button>}</div>
        </div>
      </div>
    </div>
  );
};

export default ImportUpdateModal;
