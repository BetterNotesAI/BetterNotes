import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link href="/support" className="text-xs text-white/60 hover:text-white transition-colors">
            ← Back to Support
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Política de privacidad</h1>
          <p className="mt-1 text-sm text-white/60">
            Última actualización: 10 de abril de 2026.
          </p>
        </div>

        <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3 text-sm text-white/75 leading-relaxed">
          <h2 className="text-white font-medium">1. Datos que recopilamos</h2>
          <p>
            Recopilamos datos de cuenta (email, identificadores de usuario), contenido que subes o generas,
            y métricas de uso necesarias para operar BetterNotes.
          </p>

          <h2 className="text-white font-medium">2. Uso de datos</h2>
          <p>
            Usamos estos datos para autenticarte, generar contenido, mostrar tu uso de créditos,
            y mejorar la estabilidad y calidad del producto.
          </p>

          <h2 className="text-white font-medium">3. Compartición con terceros</h2>
          <p>
            Solo compartimos datos con proveedores necesarios para operar el servicio,
            como infraestructura cloud y pagos (Stripe), bajo acuerdos de procesamiento.
          </p>

          <h2 className="text-white font-medium">4. Retención y eliminación</h2>
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si eliminas la cuenta desde Settings,
            se elimina tu usuario y los datos asociados según nuestra política de retención técnica.
          </p>

          <h2 className="text-white font-medium">5. Contacto</h2>
          <p>
            Para solicitudes sobre privacidad, escríbenos a{' '}
            <a href="mailto:hello@better-notes.ai" className="text-indigo-300 hover:text-indigo-200">
              hello@better-notes.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
