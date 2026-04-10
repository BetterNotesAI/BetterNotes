import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use',
};

export default function TermsOfUsePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link href="/support" className="text-xs text-white/60 hover:text-white transition-colors">
            ← Back to Support
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Términos de uso</h1>
          <p className="mt-1 text-sm text-white/60">
            Última actualización: 10 de abril de 2026.
          </p>
        </div>

        <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3 text-sm text-white/75 leading-relaxed">
          <h2 className="text-white font-medium">1. Uso permitido</h2>
          <p>
            Puedes usar BetterNotes para crear y gestionar contenido académico y educativo.
            No está permitido el uso para actividades ilícitas o que vulneren derechos de terceros.
          </p>

          <h2 className="text-white font-medium">2. Cuenta y seguridad</h2>
          <p>
            Eres responsable de mantener la confidencialidad de tus credenciales y de toda
            actividad realizada desde tu cuenta.
          </p>

          <h2 className="text-white font-medium">3. Planes y facturación</h2>
          <p>
            El acceso a funcionalidades premium depende de tu plan activo. Los pagos y gestión de
            suscripción se procesan mediante Stripe.
          </p>

          <h2 className="text-white font-medium">4. Disponibilidad del servicio</h2>
          <p>
            Hacemos esfuerzos razonables para mantener disponibilidad, pero el servicio puede tener
            interrupciones por mantenimiento, incidencias o causas externas.
          </p>

          <h2 className="text-white font-medium">5. Terminación</h2>
          <p>
            Podemos suspender cuentas por incumplimiento de estos términos. También puedes cerrar
            tu cuenta en cualquier momento desde Settings.
          </p>
        </section>
      </div>
    </div>
  );
}
