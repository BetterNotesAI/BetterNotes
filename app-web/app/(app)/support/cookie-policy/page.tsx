import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy',
};

function Pending({ label }: { label?: string }) {
  return (
    <span className="inline-block bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-1.5 py-0.5 text-xs font-mono">
      {label ?? '[PENDING TO COMPLETE]'}
    </span>
  );
}

export default function CookiePolicyPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link href="/support" className="text-xs text-white/60 hover:text-white transition-colors">
            ← Back to Support
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Cookie Policy</h1>
          <p className="mt-1 text-sm text-white/60">
            Last updated: <Pending label="[PENDING TO COMPLETE]" />
          </p>
          <p className="mt-3 text-sm text-white/70 leading-relaxed">
            This Cookie Policy explains how <strong className="text-white">BETTERNOTES SL</strong> uses cookies
            and similar technologies on the BetterNotes website, platform, and related services. It describes
            what cookies are, which types may be used, what purposes they serve, how long they may remain on
            your device, and how you can manage your preferences.
          </p>
        </div>

        <div className="space-y-4 text-sm text-white/75 leading-relaxed">

          {/* Section 1 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">1. Who We Are</h2>
            <p>This website and the BetterNotes service are operated by:</p>
            <div className="pl-4 border-l border-white/20 space-y-1">
              <p><strong className="text-white">BETTERNOTES SL</strong></p>
              <p>Tax ID / CIF: <Pending /></p>
              <p>Registered address: <Pending /></p>
              <p>Contact email: <Pending /></p>
              <p>Privacy email: <Pending /></p>
            </div>
            <p>If you have questions about this Cookie Policy, you may contact us using the details above.</p>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">2. What Are Cookies?</h2>
            <p>
              Cookies are small text files or similar technologies that are stored on your device when you visit
              a website or use an online service. They allow the website or service to recognize your device,
              remember certain information, and collect data about how the service is used.
            </p>
            <p>
              Cookies can serve different purposes, including enabling the website to function properly,
              remembering your preferences, measuring traffic and usage, improving performance, and supporting
              security. The AEPD cookie guide explains that cookies and similar technologies fall within the
              scope of Spanish rules when they are used to store or retrieve information from a user&apos;s device.
            </p>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">3. What Types of Cookies Do We Use?</h2>
            <p>BetterNotes may use the following categories of cookies or similar technologies:</p>

            <div className="space-y-4">
              <div>
                <h3 className="text-white/90 font-medium">3.1 Strictly necessary cookies</h3>
                <p className="mt-1">
                  These cookies are essential for the operation of the website or service and do not require
                  consent where they are strictly necessary. They may be used for:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 mt-2">
                  <li>user authentication;</li>
                  <li>session management;</li>
                  <li>security and fraud prevention;</li>
                  <li>load balancing;</li>
                  <li>remembering privacy choices;</li>
                  <li>maintaining logged-in areas;</li>
                  <li>essential interface operation.</li>
                </ul>
                <p className="mt-2 text-white/60 text-xs">Spanish law and the AEPD guidance recognize that certain strictly necessary cookies may be exempt from consent.</p>
              </div>

              <div>
                <h3 className="text-white/90 font-medium">3.2 Preference or customization cookies</h3>
                <p className="mt-1">
                  These cookies remember choices you make, such as language, interface settings, or display
                  preferences, so that the service can provide a more personalized experience.
                </p>
              </div>

              <div>
                <h3 className="text-white/90 font-medium">3.3 Analytics or measurement cookies</h3>
                <p className="mt-1">
                  These cookies help us understand how users interact with BetterNotes, such as which pages
                  are visited, how users navigate the service, and how long sessions last. As a general rule,
                  analytics cookies require consent unless they fit within the narrow conditions described by
                  the AEPD for exempt audience-measurement tools.
                </p>
              </div>

              <div>
                <h3 className="text-white/90 font-medium">3.4 Security cookies</h3>
                <p className="mt-1">
                  These cookies help protect BetterNotes and its users by identifying suspicious activity,
                  supporting login integrity, preventing abuse, and protecting user sessions. Some security
                  cookies may be considered strictly necessary.
                </p>
              </div>

              <div>
                <h3 className="text-white/90 font-medium">3.5 Functional cookies</h3>
                <p className="mt-1">
                  These cookies support enhanced website features that are not strictly necessary but improve
                  the user experience, for example remembering non-essential interface selections or enabling
                  optional functionality. These cookies may require consent depending on their purpose.
                </p>
              </div>

              <div>
                <h3 className="text-white/90 font-medium">3.6 Third-party cookies</h3>
                <p className="mt-1">
                  Some cookies may be set by third-party providers whose services we use, such as analytics
                  providers, payment providers, authentication providers, or infrastructure partners. These
                  third parties may process information collected through cookies in accordance with their own
                  privacy and cookie policies.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">4. Why We Use Cookies</h2>
            <p>We may use cookies and similar technologies for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>to ensure the website and platform function correctly;</li>
              <li>to authenticate users and keep sessions active;</li>
              <li>to remember settings and preferences;</li>
              <li>to protect the service from fraud, abuse, and unauthorized access;</li>
              <li>to measure traffic and performance;</li>
              <li>to understand how BetterNotes is used;</li>
              <li>to improve the design, usability, and reliability of the service;</li>
              <li>to support subscription flows, billing flows, or account-related operations;</li>
              <li>to manage consent preferences.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">5. Legal Basis for Using Cookies</h2>
            <p>
              Under Spanish law, the use of cookies that are not strictly necessary generally requires prior
              informed consent, following from <strong className="text-white">Article 22.2 of the LSSI</strong>.
              Accordingly:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white/90">Strictly necessary cookies</strong> may be used without consent where legally exempt;</li>
              <li><strong className="text-white/90">Non-essential cookies</strong>, such as many analytics, personalization, or third-party cookies, will only be used after the user has given valid consent.</li>
            </ul>
            <p>
              Where cookies involve the processing of personal data, that processing is also subject to
              applicable data protection rules, including the GDPR.
            </p>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">6. How Consent Is Collected</h2>
            <p>When you first visit BetterNotes, you may be shown a cookie banner or consent interface allowing you to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>accept all cookies;</li>
              <li>reject non-essential cookies;</li>
              <li>configure your cookie preferences.</li>
            </ul>
            <p>
              Non-essential cookies will not be placed before valid consent is obtained, except where an
              exemption applies. Your preferences may be stored so that your choices are respected on future visits.
            </p>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">7. How You Can Manage Cookies</h2>
            <p>You can manage your cookie preferences in several ways:</p>

            <div className="space-y-3">
              <div>
                <h3 className="text-white/90 font-medium">7.1 Through our cookie settings tool</h3>
                <p className="mt-1">
                  You may change your choices at any time through{' '}
                  <Pending label="[PENDING TO COMPLETE: Cookie Settings link/button]" />.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">7.2 Through your browser settings</h3>
                <p className="mt-1">
                  Most web browsers allow you to block or delete cookies through the browser settings menu.
                  Please note that disabling certain cookies may affect the functionality of BetterNotes — for
                  example, some login, security, or session features may not work correctly without necessary cookies.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">7.3 By rejecting non-essential cookies on the banner</h3>
                <p className="mt-1">
                  Where applicable, you can reject non-essential cookies directly through the initial cookie
                  banner or consent layer.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">8. Cookie Duration</h2>
            <p>Cookies may be either:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white/90">Session cookies</strong>, which are deleted when you close your browser; or</li>
              <li><strong className="text-white/90">Persistent cookies</strong>, which remain on your device for a set period or until deleted.</li>
            </ul>
            <p>The actual duration depends on the specific cookie and its purpose.</p>
          </section>

          {/* Section 9 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">9. Cookies Used by BetterNotes</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-300 text-xs font-mono">[PENDING TO COMPLETE WITH REAL COOKIE INVENTORY]</p>
              <p className="text-yellow-200/70 text-xs mt-1">The table below is a preliminary structure and must be updated with the actual cookies in use on the live site before publication.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left text-white/80 font-medium py-2 pr-3">Cookie Name</th>
                    <th className="text-left text-white/80 font-medium py-2 pr-3">Provider</th>
                    <th className="text-left text-white/80 font-medium py-2 pr-3">Purpose</th>
                    <th className="text-left text-white/80 font-medium py-2 pr-3">Type</th>
                    <th className="text-left text-white/80 font-medium py-2">Essential</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <td className="py-2 pr-3 font-mono">sb-access-token</td>
                    <td className="py-2 pr-3">Supabase</td>
                    <td className="py-2 pr-3">Maintains secure user authentication session</td>
                    <td className="py-2 pr-3">Necessary</td>
                    <td className="py-2 text-green-400">Yes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono">_vercel_jwt</td>
                    <td className="py-2 pr-3">Vercel</td>
                    <td className="py-2 pr-3">Deployment routing and authentication</td>
                    <td className="py-2 pr-3">Necessary</td>
                    <td className="py-2 text-green-400">Yes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono">__stripe_mid</td>
                    <td className="py-2 pr-3">Stripe</td>
                    <td className="py-2 pr-3">Fraud prevention and transaction security</td>
                    <td className="py-2 pr-3">Necessary</td>
                    <td className="py-2 text-green-400">Yes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-mono">_ga</td>
                    <td className="py-2 pr-3">Google</td>
                    <td className="py-2 pr-3">Analytics and usage measurement</td>
                    <td className="py-2 pr-3">Analytics</td>
                    <td className="py-2 text-yellow-400">No (consent required)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 10 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">10. Third-Party Services That May Set Cookies</h2>
            <p>Depending on the final implementation of BetterNotes, cookies or similar technologies may be set by third-party services such as:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>authentication providers;</li>
              <li>analytics providers;</li>
              <li>hosting or infrastructure tools;</li>
              <li>embedded content tools;</li>
              <li>payment processors;</li>
              <li>customer support or communication tools.</li>
            </ul>
            <p><strong className="text-white">Current providers in use:</strong> <Pending /></p>
          </section>

          {/* Section 11 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">11. Analytics and Measurement Tools</h2>
            <p>
              BetterNotes may use analytics or measurement tools to understand how the platform is used and to
              improve the service. The AEPD&apos;s 2024 guidance explains that some audience-measurement tools may be
              exempt from consent only under limited conditions and with specific guarantees; otherwise, consent
              is required. If BetterNotes uses analytics that do not meet those exempt conditions, we will only
              activate them after obtaining your consent.
            </p>
          </section>

          {/* Section 12 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">12. International Transfers</h2>
            <p>
              If a third-party cookie provider processes information outside the European Economic Area, the
              associated data processing may involve international transfers. Where this occurs, such processing
              should be supported by appropriate legal safeguards under applicable data protection law.
            </p>
          </section>

          {/* Sections 13-14 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">13. Changes to This Cookie Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in law, regulatory guidance,
                technology, or the actual cookies and services used by BetterNotes. The most recent version will
                always be available on the website.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">14. Contact</h2>
              <p>If you have any questions about this Cookie Policy, you may contact:</p>
              <div className="pl-4 border-l border-white/20 space-y-1">
                <p><strong className="text-white">BETTERNOTES SL</strong></p>
                <p>Registered address: <Pending /></p>
                <p>Contact email: <Pending /></p>
                <p>Privacy email: <Pending /></p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
