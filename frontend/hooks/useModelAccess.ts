import { useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/api';
import { useRouter } from 'next/navigation';

export type ModelType =
  | '303' | '130' | '115' | '180' | '390'  // Existing
  | '349' | '131' | '111' | '190' | '123' | '347'  // New tax models
  | 'SII' | 'VIES' | 'REDEME';  // Informational pages

export function useModelAccess(modelType: ModelType) {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const checkAccess = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await auth.getMe();
      let allowed: boolean;

      switch (modelType) {
        // Existing models
        case '303':
          allowed = response.data.mostrar_modelo_303;
          break;
        case '130':
          allowed = response.data.mostrar_modelo_130;
          break;
        case '115':
          allowed = response.data.mostrar_modelo_115;
          break;
        case '180':
          allowed = response.data.mostrar_modelo_180;
          break;
        case '390':
          allowed = response.data.mostrar_modelo_390;
          break;
        // New IVA models
        case '349':
          allowed = response.data.mostrar_modelo_349;
          break;
        case 'SII':
          allowed = response.data.mostrar_sii;
          break;
        // New IRPF models
        case '131':
          allowed = response.data.mostrar_modelo_131;
          break;
        // New Retenciones models
        case '111':
          allowed = response.data.mostrar_modelo_111;
          break;
        case '190':
          allowed = response.data.mostrar_modelo_190;
          break;
        case '123':
          allowed = response.data.mostrar_modelo_123;
          break;
        // Declaraciones Informativas
        case '347':
          allowed = response.data.mostrar_modelo_347;
          break;
        // Registros Censales
        case 'VIES':
          allowed = response.data.mostrar_vies_roi;
          break;
        case 'REDEME':
          allowed = response.data.mostrar_redeme;
          break;
        default:
          allowed = true;
      }

      setIsAllowed(allowed ?? true);
    } catch (err: any) {
      if (err.message.includes('Token') || err.message.includes('autenticacion')) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setIsAllowed(true); // Default to allowed on error
      }
    } finally {
      setLoading(false);
    }
  }, [modelType, router]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess, refreshTrigger]);

  // Function to refresh the access check
  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { isAllowed, loading, refresh };
}
