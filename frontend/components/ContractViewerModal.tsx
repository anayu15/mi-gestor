'use client';

import { useEffect, useState } from 'react';

interface ContractViewerModalProps {
  programacionId: string;
  contractName: string;
  onClose: () => void;
}

export default function ContractViewerModal({ programacionId, contractName, onClose }: ContractViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let blobUrl = '';

    async function loadFile() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Sesion expirada');
          return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

        // Load file with authentication
        const response = await fetch(`${API_URL}/programaciones/${programacionId}/contrato/file`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Error al cargar el contrato');
        }

        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        setFileType(contentType);

        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        setFileUrl(blobUrl);
      } catch (err: any) {
        console.error('Error:', err);
        setError(err.message || 'Error al cargar el contrato');
      } finally {
        setLoading(false);
      }
    }

    loadFile();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [programacionId]);

  async function handleDownload() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const response = await fetch(`${API_URL}/programaciones/${programacionId}/contrato/file`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al descargar el contrato');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Determine file extension from content type
      const contentType = response.headers.get('Content-Type') || '';
      let extension = '.pdf';
      if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = '.jpg';
      else if (contentType.includes('png')) extension = '.png';

      a.download = contractName || `contrato_${programacionId}${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Error al descargar: ' + err.message);
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

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar contrato</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isImage = fileType.startsWith('image/');
  const isPdf = fileType === 'application/pdf';

  async function handleShare() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const response = await fetch(`${API_URL}/programaciones/${programacionId}/contrato/file`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al obtener documento');

      const blob = await response.blob();
      const contentType = response.headers.get('Content-Type') || '';
      let extension = '.pdf';
      if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = '.jpg';
      else if (contentType.includes('png')) extension = '.png';

      const file = new File(
        [blob],
        `${contractName.replace(/[\/\\]/g, '_')}${extension}`,
        { type: contentType || 'application/pdf' }
      );

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: contractName,
          files: [file],
        });
      } else {
        alert('Tu navegador no soporta compartir archivos. Se descargara el archivo.');
        handleDownload();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error al compartir:', error);
        alert('Error al compartir: ' + error.message);
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full h-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-slate-50 to-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{contractName}</h2>
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

        {/* File Viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden flex items-center justify-center">
          {isPdf && (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              title={contractName}
            />
          )}
          {isImage && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={contractName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
          {!isPdf && !isImage && (
            <div className="text-center p-8">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 mb-4">No se puede previsualizar este tipo de archivo</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Descargar archivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
