'use client';

import { useEffect, useState } from 'react';

interface DocumentViewerModalProps {
  documentId: string;
  onClose: () => void;
}

interface Document {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: string;
  archivo_nombre_original: string;
  archivo_tipo_mime: string;
  archivo_tamanio_bytes: number;
  fecha_subida: string;
  fecha_documento: string;
  fecha_vencimiento: string;
  version: number;
  estado: string;
  etiquetas: string[];
  notas: string;
}

export default function DocumentViewerModal({ documentId, onClose }: DocumentViewerModalProps) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentUrl, setDocumentUrl] = useState<string>('');

  useEffect(() => {
    let blobUrl = '';
    let isMounted = true;

    async function loadDocument() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Sesión expirada');
          onClose();
          return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

        // Get document details
        const response = await fetch(`${API_URL}/documents/${documentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Error al cargar documento');
        }

        const data = await response.json();
        const documentData = data.data;

        if (!documentData) {
          throw new Error('Documento no encontrado');
        }

        if (!isMounted) return;
        setDoc(documentData);

        // Load document with authentication
        const docResponse = await fetch(`${API_URL}/documents/${documentId}/view`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!docResponse.ok) {
          const errorData = await docResponse.text();
          console.error('Error response:', errorData);
          throw new Error('Error al cargar vista del documento');
        }

        const blob = await docResponse.blob();
        if (!isMounted) return;

        blobUrl = URL.createObjectURL(blob);
        setDocumentUrl(blobUrl);
      } catch (error: any) {
        console.error('Error completo:', error);
        if (isMounted) {
          alert(error.message || 'Error al cargar el documento');
          onClose();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDocument();

    // Cleanup blob URL on unmount
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [documentId, onClose]);

  async function handleDownload() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const response = await fetch(`${API_URL}/documents/${documentId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al descargar documento');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc?.archivo_nombre_original || 'documento';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert('Error al descargar documento: ' + error.message);
    }
  }

  async function handleShare() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      const response = await fetch(`${API_URL}/documents/${documentId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al obtener documento');

      const blob = await response.blob();
      const file = new File(
        [blob],
        doc?.archivo_nombre_original || 'documento',
        { type: doc?.archivo_tipo_mime || 'application/pdf' }
      );

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: doc?.nombre,
          text: `${doc?.nombre}`,
          files: [file],
        });
      } else {
        // Fallback: copy link or download
        alert('Tu navegador no soporta compartir archivos. Se descargará el documento.');
        handleDownload();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error al compartir:', error);
        alert('Error al compartir documento: ' + error.message);
      }
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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

  if (!doc) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full h-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{doc.nombre}</h2>
            {doc.descripcion && (
              <p className="text-sm text-gray-600 mt-1">{doc.descripcion}</p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleShare}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              title="Compartir documento"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Compartir</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              title="Descargar documento"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Descargar</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Document Viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden">
          {doc.archivo_tipo_mime === 'application/pdf' ? (
            <iframe
              src={documentUrl}
              className="w-full h-full border-0"
              title={doc.nombre}
            />
          ) : doc.archivo_tipo_mime.startsWith('image/') ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={documentUrl}
                alt={doc.nombre}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg mb-2">No hay vista previa disponible</p>
                <p className="text-sm">Tipo: {doc.archivo_tipo_mime}</p>
                <button
                  onClick={handleDownload}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Descargar documento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
