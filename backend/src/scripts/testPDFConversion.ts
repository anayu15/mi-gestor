import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Test PDF to PNG conversion using macOS sips
 */
async function testPDFConversion() {
  console.log('🧪 Test de Conversión de PDF a PNG con sips\n');

  const testDir = path.join(__dirname, '../../test-uploads');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create a simple PDF using built-in macOS tools
  console.log('1️⃣ Creando PDF de prueba...');
  const pdfPath = path.join(testDir, 'test-invoice.pdf');

  // Create a simple text file
  const textContent = `FACTURA

Empresa Test S.L.
CIF: B12345678
Fecha: 15/01/2024
Nº Factura: FAC-2024-001

Concepto: Servicios de consultoría informática

Base imponible: 1.000,00 €
IVA (21%): 210,00 €
IRPF (15%): 150,00 €

TOTAL: 1.060,00 €
`;

  const txtPath = path.join(testDir, 'test-invoice.txt');
  fs.writeFileSync(txtPath, textContent);

  try {
    // Convert text to PDF using macOS textutil
    execSync(`textutil -convert pdf "${txtPath}" -output "${pdfPath}"`, { stdio: 'pipe' });
    console.log(`✅ PDF creado: ${pdfPath}`);

    // Clean up text file
    fs.unlinkSync(txtPath);
  } catch (error) {
    console.error('❌ Error creando PDF:', error);
    console.log('   Nota: textutil no disponible, usando archivo de texto como PDF simulado');
    fs.renameSync(txtPath, pdfPath);
  }

  // Test conversion with sips
  console.log('\n2️⃣ Convirtiendo PDF a PNG con sips...');
  const pngPath = path.join(testDir, 'test-invoice-converted.png');

  try {
    const command = `sips -s format png "${pdfPath}" --out "${pngPath}"`;
    console.log(`   Comando: ${command}`);

    execSync(command, { stdio: 'pipe' });

    if (fs.existsSync(pngPath)) {
      const stats = fs.statSync(pngPath);
      console.log(`✅ Conversión exitosa!`);
      console.log(`   Archivo PNG: ${pngPath}`);
      console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.error('❌ El archivo PNG no se creó');
    }
  } catch (error: any) {
    console.error('❌ Error en conversión:', error.message);
    if (error.stdout) console.log('   stdout:', error.stdout.toString());
    if (error.stderr) console.log('   stderr:', error.stderr.toString());
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Prueba completada');
  console.log('\n💡 PRÓXIMO PASO:');
  console.log('   Prueba subiendo un PDF real desde el navegador:');
  console.log('   http://localhost:3001/gastos/nuevo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

testPDFConversion();
