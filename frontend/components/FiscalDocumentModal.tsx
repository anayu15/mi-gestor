'use client';

import { useEffect, useState, useRef } from 'react';
import { fiscal } from '@/lib/api';

interface FiscalDocumentModalProps {
  mode: 'view' | 'upload';
  modelo: string;
  trimestre?: number;
  ano: number;
  title?: string;
  onClose: () => void;
  onUploadSuccess?: () => void;
  onDeleteSuccess?: () => void;
}

export default function FiscalDocumentModal({
  mode,
  modelo,
  trimestre,
  ano,
  title,
  onClose,
  onUploadSuccess,
  onDeleteSuccess,
}: FiscalDocumentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(mode === 'view');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const displayTitle = title || `Modelo ${modelo}`;

  // Upload mode state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Only load file in view mode
    if (mode !== 'view') return;

    let blobUrl = '';

    async function loadFile() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Sesion expirada');
          return;
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

        let url = `${API_URL}/fiscal/obligations/${modelo}/view?ano=${ano}`;
        if (trimestre !== undefined && trimestre !== null) {
          url += `&trimestre=${trimestre}`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Error al cargar archivo');
        }

        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        setFileType(contentType);

        // Get filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match) setFileName(match[1]);
        }

        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        setFileUrl(blobUrl);
      } catch (err: any) {
        console.error('Error:', err);
        setError(err.message || 'Error al cargar el archivo');
      } finally {
        setLoading(false);
      }
    }

    loadFile();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [mode, modelo, trimestre, ano]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview && previewType === 'pdf') {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview, previewType]);

  async function handleDownload() {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

      let url = `${API_URL}/fiscal/obligations/${modelo}/download?ano=${ano}`;
      if (trimestre !== undefined && trimestre !== null) {
        url += `&trimestre=${trimestre}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al descargar archivo');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      // Determine file extension from content type
      const contentType = response.headers.get('Content-Type') || '';
      let extension = '';
      if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = '.jpg';
      else if (contentType.includes('png')) extension = '.png';
      else if (contentType.includes('pdf')) extension = '.pdf';

      a.download = fileName || `${displayTitle.replace(/[\/\\]/g, '_')}${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Error al descargar: ' + err.message);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estas seguro de que deseas eliminar este documento?')) {
      return;
    }

    setDeleting(true);
    try {
      await fiscal.deleteObligationDocument(modelo, ano, trimestre);
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el documento');
    } finally {
      setDeleting(false);
    }
  }

  // Handle file selection for upload mode
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Solo se aceptan archivos JPG, JPEG, PNG o PDF');
      return;
    }

    // Validate file size (max 10MB for AEAT documents)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('El archivo no puede superar 10MB');
      return;
    }

    // Clear previous preview
    if (imagePreview && previewType === 'pdf') {
      URL.revokeObjectURL(imagePreview);
    }

    setUploadedFile(file);
    setUploadError('');

    // Create preview
    if (file.type === 'application/pdf') {
      const blobUrl = URL.createObjectURL(file);
      setImagePreview(blobUrl);
      setPreviewType('pdf');
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setPreviewType('image');
      };
      reader.readAsDataURL(file);
    }
  }

  // Handle clear file in upload mode
  function handleClearFile() {
    if (imagePreview && previewType === 'pdf') {
      URL.revokeObjectURL(imagePreview);
    }
    setUploadedFile(null);
    setImagePreview(null);
    setPreviewType(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Handle upload submission
  async function handleUploadSubmit() {
    if (!uploadedFile) return;

    setUploading(true);
    setUploadError('');

    try {
      await fiscal.uploadObligationDocument(modelo, uploadedFile, ano, trimestre);

      // Notify parent of success
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  }

  // Loading state (only for view mode)
  if (mode === 'view' && loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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

  // Error state (only for view mode)
  if (mode === 'view' && error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar documento</h3>
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

  // Upload mode UI
  if (mode === 'upload') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700">
            <div>
              <h2 className="text-xl font-bold text-white">Adjuntar documento AEAT</h2>
              <p className="text-sm text-blue-100 mt-1">{displayTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              title="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Error message */}
            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {uploadError}
              </div>
            )}

            {/* Info message */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Sube el justificante de presentacion del modelo fiscal en la Agencia Tributaria. Este documento quedara asociado a esta obligacion.</span>
              </div>
            </div>

            {!imagePreview ? (
              /* Upload zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-600 font-medium mb-2">Haz clic para seleccionar el documento</p>
                <p className="text-gray-400 text-sm">PDF, JPG o PNG (max. 10MB)</p>
              </div>
            ) : (
              /* Preview */
              <div className="space-y-4">
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  {previewType === 'pdf' ? (
                    <iframe
                      src={imagePreview}
                      className="w-full h-[400px] border-0"
                      title="Vista previa de PDF"
                    />
                  ) : (
                    <div className="flex items-center justify-center p-4">
                      <img
                        src={imagePreview}
                        alt="Vista previa"
                        className="max-w-full max-h-[400px] object-contain rounded"
                      />
                    </div>
                  )}
                  {/* Clear button */}
                  <button
                    onClick={handleClearFile}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                    title="Eliminar archivo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* File info */}
                <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
                  <span className="truncate">{uploadedFile?.name}</span>
                  <span className="text-gray-400 ml-2 flex-shrink-0">
                    {uploadedFile && (uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleUploadSubmit}
              disabled={!uploadedFile || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Subiendo...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Subir documento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View mode UI
  const isImage = fileType.startsWith('image/');
  const isPdf = fileType === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700">
          <div>
            <h2 className="text-xl font-bold text-white">{displayTitle}</h2>
            <p className="text-sm text-blue-100 mt-1">Documento AEAT - {trimestre ? `T${trimestre} ` : ''}{ano}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
              title="Descargar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Descargar</span>
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 bg-red-500/80 text-white rounded-lg hover:bg-red-500 transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Eliminar"
            >
              {deleting ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              <span>Eliminar</span>
            </button>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1"
              title="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              title="Documento AEAT"
            />
          )}
          {isImage && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt="Documento AEAT"
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
