import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEuro(amount: number | null | undefined): string {
  const validAmount = amount != null && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(validAmount);
}

export function formatEuroWithSign(amount: number | null | undefined): string {
  const validAmount = amount != null && !isNaN(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    signDisplay: 'always',
  }).format(validAmount);
  return formatted;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';

  // If it's a string in YYYY-MM-DD format, parse it manually to avoid timezone issues
  if (typeof date === 'string' && date.includes('-')) {
    const dateOnly = date.split('T')[0]; // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS"
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      // Create a date using the parts directly in UTC
      const parsedDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      return parsedDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
  }

  // Fallback to Date parsing for Date objects
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return '-';

  // Use UTC to avoid timezone shifts
  return parsedDate.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-';

  // If it's a string in YYYY-MM-DD format, parse it manually to avoid timezone issues
  if (typeof date === 'string' && date.includes('-')) {
    const dateOnly = date.split('T')[0]; // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS"
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      // Create a date using the parts directly in UTC
      const parsedDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      return parsedDate.toLocaleDateString('es-ES', {
        timeZone: 'UTC',
      });
    }
  }

  // Fallback to Date parsing for Date objects
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return '-';
  return parsedDate.toLocaleDateString('es-ES', {
    timeZone: 'UTC',
  });
}

export function formatDayMonth(date: string | Date | null | undefined): string {
  if (!date) return '-';

  // If it's a string in YYYY-MM-DD format, parse it directly to avoid timezone issues
  if (typeof date === 'string' && date.includes('-')) {
    const parts = date.split('T')[0].split('-'); // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS"
    if (parts.length === 3) {
      const day = parts[2].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      return `${day}/${month}`;
    }
  }

  // Fallback to Date parsing for Date objects
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return '-';

  // Use UTC to avoid timezone shifts
  const day = parsedDate.getUTCDate().toString().padStart(2, '0');
  const month = (parsedDate.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  const validValue = value != null && !isNaN(value) ? value : 0;
  return `${validValue.toFixed(decimals)}%`;
}

export function getNivelRiesgoColor(nivel: string): string {
  const colors: Record<string, string> = {
    BAJO: 'bg-green-100 text-green-800',
    MEDIO: 'bg-yellow-100 text-yellow-800',
    ALTO: 'bg-orange-100 text-orange-800',
    CRÍTICO: 'bg-red-100 text-red-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };
  return colors[nivel] || 'bg-gray-100 text-gray-800';
}
