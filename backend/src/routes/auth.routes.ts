import { Router } from 'express';
import { register, login, getMe, updatePreferences } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    nombre_completo: z.string().min(1, 'El nombre es obligatorio'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  }),
});

const preferencesSchema = z.object({
  body: z.object({
    // Existing model preferences
    mostrar_modelo_303: z.boolean().optional(),
    mostrar_modelo_130: z.boolean().optional(),
    mostrar_modelo_115: z.boolean().optional(),
    mostrar_modelo_180: z.boolean().optional(),
    mostrar_modelo_390: z.boolean().optional(),
    // New IVA models
    mostrar_modelo_349: z.boolean().optional(),
    mostrar_sii: z.boolean().optional(),
    // New IRPF models
    mostrar_modelo_131: z.boolean().optional(),
    mostrar_modelo_100: z.boolean().optional(),
    // New Retenciones models
    mostrar_modelo_111: z.boolean().optional(),
    mostrar_modelo_190: z.boolean().optional(),
    mostrar_modelo_123: z.boolean().optional(),
    // Declaraciones Informativas
    mostrar_modelo_347: z.boolean().optional(),
    // Registros Censales
    mostrar_vies_roi: z.boolean().optional(),
    mostrar_redeme: z.boolean().optional(),
    // Situation flags
    tiene_empleados: z.boolean().optional(),
    tiene_operaciones_ue: z.boolean().optional(),
    usa_modulos: z.boolean().optional(),
    // Other preferences
    tiene_tarifa_plana_ss: z.boolean().optional(),
    base_cotizacion: z.union([z.number().positive(), z.null()]).optional(),
    timezone: z.union([z.string(), z.null()]).optional(),
    idioma: z.union([z.string(), z.null()]).optional(),
    // Date fields
    fecha_alta_aeat: z.union([z.string(), z.null()]).optional(),
  }),
});

// Routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, getMe);
router.patch('/preferences', authenticate, validate(preferencesSchema), updatePreferences);

export default router;
