import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, AlertCircle, Download } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Money from '../components/ui/Money';
import { useUI } from '../context/UIContext';
import useAsync from '../hooks/useAsync';
import { listTournaments, importTournaments } from '../api/tournaments';
import { importTournamentsFromCsv, downloadText } from '../lib/csv';
import { netResult } from '../lib/stats';
import { formatDay, pluralize } from '../lib/format';

const TEMPLATE = 'Tournament Name,Date,Location,Buy-in ($),Action Sold (%),Place,Winnings ($)\nDaily $150 Deepstack,2026-03-14,Borgata,150,0,,0\nFall Open $600 NLH,2026-03-15,Borgata,600,25,14,4200\n';

const keyOf = (t) => `${String(t.tournament_name).trim().toLowerCase()}|${t.date}|${Number(t.buy_in)}`;

export default function ImportTournaments() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const existing = useAsync(() => listTournaments(), []);
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const existingKeys = useMemo(() => new Set((existing.data || []).map(keyOf)), [existing.data]);
  const fresh = useMemo(() => (parsed ? parsed.rows.filter((r) => !existingKeys.has(keyOf(r))) : []), [parsed, existingKeys]);
  const dupes = parsed ? parsed.rows.length - fresh.length : 0;

  const readFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('That file is over 5 MB. Split it and import in parts.', { type: 'error' });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setParsed(importTournamentsFromCsv(String(reader.result)));
    reader.readAsText(file);
  };

  const run = async () => {
    setBusy(true);
    try {
      const n = await importTournaments(fresh);
      toast(`Imported ${pluralize(n, 'tournament')}.`);
      navigate('/tournaments');
    } catch (e) {
      toast(e.message, { type: 'error' });
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Import tournaments"
        subtitle="Bring your history over from a spreadsheet. Save it as CSV first."
        back={{ to: '/tournaments', label: 'Tournaments' }}
      />

      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]); }}
      >
        <FileUp size={28} aria-hidden="true" />
        <p><strong>{fileName || 'Drop a CSV file here'}</strong></p>
        <p className="muted">Needs columns for tournament name, date and buy-in. Venue, action sold, place and winnings are picked up if present.</p>
        <div className="row wrap">
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current.click()}>Choose file</button>
          <button type="button" className="btn btn-ghost" onClick={() => downloadText('stacktrack-template.csv', TEMPLATE)}>
            <Download size={16} aria-hidden="true" /> Download template
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => readFile(e.target.files[0])} />
      </div>

      {parsed && (
        <section className="stack import-result">
          {parsed.errors.length > 0 && (
            <div className="form-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <div>
                <strong>{pluralize(parsed.errors.length, 'row')} can’t be imported</strong>
                <ul className="error-list">
                  {parsed.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
                  {parsed.errors.length > 6 && <li>…and {parsed.errors.length - 6} more</li>}
                </ul>
              </div>
            </div>
          )}

          {parsed.rows.length > 0 && (
            <>
              <div className="row-between wrap">
                <p>
                  <strong>{pluralize(fresh.length, 'tournament')}</strong> ready to import
                  {dupes > 0 && <span className="muted">. {pluralize(dupes, 'row')} already in StackTrack will be skipped.</span>}
                </p>
                <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !fresh.length}>
                  {busy ? 'Importing…' : `Import ${pluralize(fresh.length, 'tournament')}`}
                </button>
              </div>
              <div className="panel panel-flush table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tournament</th>
                      <th>Date</th>
                      <th className="r">Buy-in</th>
                      <th className="r">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fresh.slice(0, 12).map((r, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={i}>
                        <td>{r.tournament_name}<div className="faint">{r.location}</div></td>
                        <td className="num">{formatDay(r.date)}</td>
                        <td className="r"><Money value={r.buy_in} /></td>
                        <td className="r"><Money value={netResult(r)} sign /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fresh.length > 12 && <p className="muted">Showing the first 12.</p>}
              <p className="faint">Imported tournaments aren’t posted to your friends’ feeds.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
