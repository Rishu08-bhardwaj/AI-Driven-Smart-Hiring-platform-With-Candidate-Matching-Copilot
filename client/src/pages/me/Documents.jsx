import { useQuery } from '@tanstack/react-query';
import { FiDownload, FiFile } from 'react-icons/fi';
import { meService } from '../../services/index.js';
import { formatDate } from '../../constants/index.js';
import PageHeader from '../../components/common/PageHeader.jsx';
import DataTable from '../../components/tables/DataTable.jsx';

export default function MyDocuments() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['me', 'documents'], queryFn: () => meService.documents() });

  const columns = [
    { key: 'document_name', header: 'Document', render: (d) => <span className="inline-flex items-center gap-2 font-medium text-slate-700"><FiFile className="text-slate-400" /> {d.document_name}</span> },
    { key: 'document_type', header: 'Type', render: (d) => d.document_type || '—' },
    { key: 'uploaded_at', header: 'Uploaded', render: (d) => formatDate(d.uploaded_at) },
    {
      key: 'actions', header: '', align: 'right',
      render: (d) => <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"><FiDownload size={14} /> Download</a>,
    },
  ];

  return (
    <div>
      <PageHeader title="My Documents" subtitle="Documents shared with you by HR." />
      <div className="card">
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} error={isError ? 'Failed to load.' : null} onRetry={refetch} emptyTitle="No documents" emptyMessage="HR hasn't shared any documents yet." />
      </div>
    </div>
  );
}
