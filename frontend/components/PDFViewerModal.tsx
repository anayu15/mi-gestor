'use client';

import { useEffect, useState } from 'react';

interface PDFViewerModalProps {
  // Support multiple source types (only one should be provided)
  invoiceId?: string;
  expenseId?: string;
  documentId?: string;
  programacionId?: string;
  title?: string;
  onClose: () => void;
}

export default function PDFViewerModal({ invoiceId, expenseId, documentId, programacionId, title, onClose }: PDFViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [displayTitle, setDisplayTitle] = useState(title || 'Documento');
  const [subtitle, setSubtitle] = useState('');

  // Determine source type and id
  const sourceType = invoiceId ? 'invoice' : expenseId ? 'expense' : programacionId ? 'programacion' : 'document';
  const sourceId = invoiceId || expenseId || programacionId || documentId || '';

  useEffect(() => {
    let blobUrl = '';

    async function loadPDF() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Sesion expirada');
          onClose();
          return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

        // Use unified endpoint for viewing
        const pdfResponse = await fetch(`${API_URL}/documents/view/${sourceType}/${sourceId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!pdfResponse.ok) {
          if (pdfResponse.status === 404) {
            throw new Error('Documento no encontrado');
          }
          throw new Error('Error al cargar documento');
        }

        const blob = await pdfResponse.blob();
        blobUrl = URL.createObjectURL(blob);
        setPdfUrl(blobUrl);

        // Set title based on source type if not provided
        if (!title) {
          if (sourceType === 'invoice') {
            setDisplayTitle(`Factura`);
          } else if (sourceType === 'expense') {
            setDisplayTitle(`Gasto`);
          }
        }
      } catch (error: any) {
        console.error('Error:', error);
        alert(error.message || 'Error al cargar el documento');
        onClose();
      } finally {
        setLoading(false);
      }
    }

    loadPDF();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [sourceType, sourceId, title, onClose]);

  async function handleDownload() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const response = await fetch(`${API_URL}/documents/download/${sourceType}/${sourceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al descargar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${displayTitle.replace(/[\/\\]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert('Error al descargar: ' + error.message);
    }
  }

  async function handleShare() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const response = await fetch(`${API_URL}/documents/download/${sourceType}/${sourceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al obtener documento');

      const blob = await response.blob();
      const file = new File(
        [blob],
        `${displayTitle.replace(/[\/\\]/g, '_')}.pdf`,
        { type: 'application/pdf' }
      );

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: displayTitle,
          files: [file],
        });
      } else {
        alert('Tu navegador no soporta compartir archivos. Se descargara el PDF.');
        handleDownload();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error al compartir:', error);
        alert('Error al compartir: ' + error.message);
      }
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-[70vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando documento...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full h-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-slate-50 to-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{displayTitle}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300 flex items-center gap-1.5 text-sm"
              title="Compartir"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Compartir</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium border border-slate-300 flex items-center gap-1.5 text-sm"
              title="Descargar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Descargar</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              title="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title={displayTitle}
          />
        </div>
      </div>
    </div>
  );
}
