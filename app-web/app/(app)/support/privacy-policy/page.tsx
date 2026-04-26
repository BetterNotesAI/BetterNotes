import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

function Pending({ label }: { label?: string }) {
  return (
    <span className="inline-block bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-1.5 py-0.5 text-xs font-mono">
      {label ?? '[PENDING TO COMPLETE]'}
    </span>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link href="/support" className="text-xs text-white/60 hover:text-white transition-colors">
            ← Back to Support
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Privacy Policy</h1>
          <p className="mt-1 text-sm text-white/60">
            Last updated: <Pending label="[PENDING TO COMPLETE]" />
          </p>
          <p className="mt-3 text-sm text-white/70 leading-relaxed">
            This Privacy Policy explains how <strong className="text-white">BETTERNOTES SL</strong> collects,
            uses, stores, shares, and protects personal data when you access or use the BetterNotes website,
            platform, applications, and related services. Please read this Privacy Policy carefully before using BetterNotes.
          </p>
        </div>

        <div className="space-y-4 text-sm text-white/75 leading-relaxed">

          {/* Section 1 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">1. Data Controller</h2>
            <p>The data controller responsible for the processing of your personal data is:</p>
            <div className="pl-4 border-l border-white/20 space-y-1">
              <p><strong className="text-white">BETTERNOTES SL</strong></p>
              <p>Tax ID / CIF: <Pending /></p>
              <p>Registered address: <Pending /></p>
              <p>General contact email: <Pending /></p>
              <p>Privacy contact email: <Pending /></p>
            </div>
            <p>
              If you have any questions about this Privacy Policy or about how your personal data is processed,
              you may contact us using the contact details above.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">2. About BetterNotes</h2>
            <p>
              BetterNotes is a digital platform designed to help users create, transform, organize, and interact
              with study materials and educational content, including through artificial intelligence tools.
              Depending on the available features, users may upload files, enter prompts or text, generate
              summaries, cheat sheets, long-form notes, practice exams, guided problem-solving content, and
              other derived materials.
            </p>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">3. Personal Data We Collect</h2>
            <p>We may collect and process the following categories of personal data:</p>

            <div className="space-y-3">
              <div>
                <h3 className="text-white/90 font-medium">3.1 Account and identity data</h3>
                <p className="mt-1">
                  This may include your name, surname, username, email address, encrypted password, login
                  identifiers, and authentication-related information where you create an account or sign in
                  through third-party identity providers (Google, Apple, GitHub).
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.2 Profile data</h3>
                <p className="mt-1">
                  This may include your profile photo, banner image, short biography, educational information
                  such as university or degree, language preferences, display settings, and any other profile
                  details you choose to provide.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.3 User-uploaded content</h3>
                <p className="mt-1">
                  We may process the files, notes, PDFs, text inputs, prompts, questions, answers, and any
                  other materials you upload, submit, paste, or otherwise provide through the service.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.4 AI-generated content</h3>
                <p className="mt-1">
                  We may process outputs generated through BetterNotes, including summaries, notes, exams,
                  explanations, structured documents, labels, metadata, and other content generated or assisted
                  by AI tools based on your inputs.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.5 Usage and activity data</h3>
                <p className="mt-1">
                  We may collect information about how you use BetterNotes, including login times, actions taken
                  within the platform, features used, project history, content interactions, system events,
                  preferences, and operational logs. This also includes the model used, input/output tokens, and
                  credits consumed for each AI operation.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.6 Subscription and billing data</h3>
                <p className="mt-1">
                  If you subscribe to a paid plan, we may process information related to your subscription status,
                  plan type, usage, credits, invoices, payment status, and related identifiers.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.7 Support and communications data</h3>
                <p className="mt-1">
                  We may process information you provide when you contact us, submit support requests, report
                  issues, send feedback, or interact with BetterNotes through communication channels.
                </p>
              </div>
              <div>
                <h3 className="text-white/90 font-medium">3.8 Technical and device data</h3>
                <p className="mt-1">
                  We may collect technical information such as IP address, browser type, device type, operating
                  system, language settings, referring pages, timestamps, crash logs, and similar technical data
                  necessary for platform operation, security, and diagnostics.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">4. How We Collect Your Data</h2>
            <p>We may collect personal data directly from you when:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>you create an account;</li>
              <li>you sign in or authenticate;</li>
              <li>you complete your profile;</li>
              <li>you upload or submit documents or text;</li>
              <li>you interact with AI-powered features;</li>
              <li>you purchase or manage a subscription;</li>
              <li>you publish or share content through the platform;</li>
              <li>you contact support or send us feedback;</li>
              <li>you browse the website and accept certain cookies or similar technologies.</li>
            </ul>
            <p>
              We may also receive certain data from third-party service providers involved in authentication,
              payment processing, analytics, hosting, or infrastructure.
            </p>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">5. Purposes of Processing</h2>
            <p>We process personal data for the following purposes:</p>
            <div className="space-y-3">
              <div><h3 className="text-white/90 font-medium">5.1 To provide the service</h3><p className="mt-1">To create and manage user accounts, authenticate users, store projects, allow uploads, generate content, organize materials, and provide all core BetterNotes functionalities.</p></div>
              <div><h3 className="text-white/90 font-medium">5.2 To process content using artificial intelligence</h3><p className="mt-1">To analyze uploaded files and user prompts, generate requested educational outputs, structure study materials, and deliver AI-assisted features requested by the user.</p></div>
              <div><h3 className="text-white/90 font-medium">5.3 To manage subscriptions, payments, and usage</h3><p className="mt-1">To manage plan access, billing, usage limits, credits, renewals, payment-related incidents, and service access linked to subscription status.</p></div>
              <div><h3 className="text-white/90 font-medium">5.4 To manage optional public content and profiles</h3><p className="mt-1">If users choose to make certain content or parts of their profile visible to others, we process the corresponding data to display that content according to the selected settings.</p></div>
              <div><h3 className="text-white/90 font-medium">5.5 To provide support and handle communications</h3><p className="mt-1">To answer questions, resolve issues, process feedback, and communicate with users regarding service operation, incidents, or account matters.</p></div>
              <div><h3 className="text-white/90 font-medium">5.6 To ensure security and prevent abuse</h3><p className="mt-1">To detect fraud, unauthorized access, misuse of the platform, violations of our Terms, malicious activity, and other security-related events.</p></div>
              <div><h3 className="text-white/90 font-medium">5.7 To improve the platform</h3><p className="mt-1">To monitor performance, debug errors, improve user experience, measure product usage, and make internal product and operational decisions.</p></div>
              <div><h3 className="text-white/90 font-medium">5.8 To comply with legal obligations</h3><p className="mt-1">To comply with applicable legal, regulatory, tax, accounting, consumer protection, and law enforcement obligations.</p></div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">6. Legal Bases for Processing</h2>
            <p>We process your personal data on one or more of the following legal bases:</p>
            <div className="space-y-3">
              <div><h3 className="text-white/90 font-medium">6.1 Performance of a contract</h3><p className="mt-1">We process data where necessary to provide BetterNotes, create and manage accounts, enable features, process user requests, and perform the contractual relationship between you and BETTERNOTES SL.</p></div>
              <div><h3 className="text-white/90 font-medium">6.2 Consent</h3><p className="mt-1">Where required by law, we rely on your consent, for example for certain cookies, optional marketing communications, or certain optional publication settings.</p></div>
              <div><h3 className="text-white/90 font-medium">6.3 Legitimate interests</h3><p className="mt-1">We may process data where necessary for our legitimate interests, including platform security, fraud prevention, service improvement, diagnostics, internal analytics, support operations, and legal defense, provided those interests are not overridden by your rights and freedoms.</p></div>
              <div><h3 className="text-white/90 font-medium">6.4 Legal obligation</h3><p className="mt-1">We may process data where necessary to comply with legal obligations applicable to BETTERNOTES SL.</p></div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">7. Processing of User Content</h2>
            <p>BetterNotes allows users to upload or submit materials for transformation, analysis, storage, or AI-assisted generation. By using these features, you acknowledge and agree that:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>you are responsible for the content you upload, submit, or input into the platform;</li>
              <li>you must have all necessary rights, permissions, and legal grounds to upload and use that content;</li>
              <li>you must not upload unlawful, confidential, infringing, or unauthorized third-party content;</li>
              <li>such content may be processed by third-party service providers acting on behalf of BETTERNOTES SL for the purpose of delivering the service.</li>
            </ol>
            <p>
              If the materials you upload contain personal data of third parties, you are responsible for ensuring
              that you have a valid legal basis to disclose and process such data through the platform.
            </p>
          </section>

          {/* Section 8 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">8. Use of Artificial Intelligence</h2>
            <p>
              BetterNotes uses artificial intelligence tools and third-party AI APIs to process user content and
              generate outputs. This means that prompts, uploaded text, document excerpts, and other submitted
              materials may be sent to external providers for the purpose of carrying out the requested
              functionality, such as summarization, structuring, classification, reformulation, explanation, problem
              solving, or content generation.
            </p>
            <p>
              AI-generated outputs may contain errors, omissions, inaccurate statements, outdated information, or
              misleading conclusions. BetterNotes does not guarantee that AI-generated content is correct,
              complete, or suitable for any particular purpose without human review, especially in academic,
              scientific, technical, or educational contexts. Users should always review outputs carefully before
              relying on them.
            </p>
          </section>

          {/* Section 9 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">9. Categories of Data Recipients</h2>
            <p>We may share personal data with third parties only where necessary for the operation of BetterNotes, to comply with the law, or where otherwise permitted. Recipients may include:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>hosting, storage, database, and infrastructure providers;</li>
              <li>authentication and identity providers;</li>
              <li>artificial intelligence and language model providers;</li>
              <li>payment and billing providers;</li>
              <li>analytics, communications, or support providers;</li>
              <li>legal, tax, accounting, or compliance advisors;</li>
              <li>public authorities, courts, regulators, or law enforcement bodies where required by law.</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">10. International Data Transfers</h2>
            <p>
              Some of our service providers may be located outside the European Economic Area. Because
              BetterNotes relies on international infrastructure and AI service providers, certain user inputs,
              prompts, document fragments, operational logs, or metadata may be processed outside the EEA,
              primarily in the United States. BETTERNOTES SL ensures that such transfers are protected by
              appropriate legal safeguards, such as <strong className="text-white">Standard Contractual Clauses (SCCs)</strong> or the
              EU-U.S. Data Privacy Framework, to ensure an adequate level of data protection as required by the GDPR.
            </p>
          </section>

          {/* Section 11 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">11. Service Providers and Processors</h2>
            <p>BetterNotes may use third-party providers to operate the platform. These providers may include, among others:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-white/90">Hosting &amp; Infrastructure:</strong> Vercel Inc. (Frontend), Railway Corp. (Backend), and Google Cloud Platform</li>
              <li><strong className="text-white/90">Database &amp; Authentication:</strong> Supabase (PostgreSQL database, storage, and auth)</li>
              <li><strong className="text-white/90">Artificial Intelligence:</strong> OpenAI, L.L.C.</li>
              <li><strong className="text-white/90">Payments &amp; Billing:</strong> Stripe, Inc.</li>
            </ul>
          </section>

          {/* Section 12 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">12. Data Retention</h2>
            <p>We retain personal data only for as long as necessary for the purposes for which it was collected. As a general principle:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>account data is retained while your account remains active;</li>
              <li>profile data is retained while linked to your active account, unless modified or deleted;</li>
              <li>uploaded content and generated materials may be retained until deleted by the user, removed under our policies, or no longer needed for the service;</li>
              <li>support and operational communications may be retained for a reasonable period for support, security, and legal purposes;</li>
              <li>subscription, billing, and accounting records may be retained for the period required by applicable law;</li>
              <li>logs and technical records may be retained for a limited period necessary for diagnostics, abuse prevention, and security.</li>
            </ul>
            <p><strong className="text-white">Specific retention periods:</strong> <Pending /></p>
          </section>

          {/* Section 13 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">13. Children and Minors</h2>
            <p>
              <strong className="text-white">Minimum age 14:</strong> BetterNotes is not intended for children under the age of 14.
              In accordance with the Spanish LOPDGDD, users under 14 must not use the platform or provide
              personal data without the verified authorization of their parents or legal guardians.
            </p>
          </section>

          {/* Section 14 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">14. Security Measures</h2>
            <p>
              BETTERNOTES SL implements reasonable technical and organizational measures designed to protect
              personal data against unauthorized access, loss, misuse, alteration, disclosure, or destruction.
              These measures may include access controls, role-based permissions, encryption in transit,
              authentication systems, secure infrastructure, monitoring, backups, and security review of providers.
            </p>
            <p>
              However, no internet-based service can be guaranteed to be completely secure, and users should
              also take reasonable steps to protect their credentials and devices.
            </p>
          </section>

          {/* Section 15 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">15. User Rights</h2>
            <p>Under applicable data protection law, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>access your personal data;</li>
              <li>request correction of inaccurate data;</li>
              <li>request deletion of your personal data;</li>
              <li>request restriction of processing;</li>
              <li>object to certain processing;</li>
              <li>request portability of your data;</li>
              <li>withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p>To exercise these rights, please contact us at: <strong className="text-white">Privacy email:</strong> <Pending /></p>
            <p>
              You may also lodge a complaint with the competent data protection authority if you believe your
              personal data has been processed unlawfully. In Spain, the competent authority is generally the{' '}
              <strong className="text-white">Spanish Data Protection Agency (AEPD)</strong>.
            </p>
          </section>

          {/* Section 16 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">16. Cookies and Similar Technologies</h2>
            <p>
              BetterNotes may use cookies and similar technologies for technical, functional, analytical,
              personalization, and security purposes. Non-essential cookies will only be used where required
              consent has been obtained in accordance with applicable law. Further information about our use of
              cookies will be provided in our{' '}
              <Link href="/support/cookie-policy" className="text-indigo-300 hover:text-indigo-200 underline">Cookie Policy</Link>.
            </p>
          </section>

          {/* Section 17 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">17. Third-Party Login and External Services</h2>
            <p>
              If BetterNotes allows authentication through third-party services such as Google, Apple, GitHub,
              or similar providers, we may receive certain information necessary to identify you and enable
              login, depending on the permissions and settings applied to your account with that provider.
              Details of such third-party processing may also be governed by the privacy policies of those providers.
            </p>
          </section>

          {/* Section 18 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">18. Public Content and Visibility Settings</h2>
            <p>
              Certain features of BetterNotes may allow users to publish documents, projects, notes, or profile
              elements so they can be viewed by others. If you choose to make content public:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>that content may become visible to other users or visitors;</li>
              <li>public profile information may be associated with your content;</li>
              <li>search and discovery features may display your content depending on platform settings;</li>
              <li>BETTERNOTES SL may continue to display such content until it is removed, unpublished, or otherwise restricted.</li>
            </ul>
            <p><strong className="text-white">Default privacy setting for user content:</strong> <Pending /></p>
          </section>

          {/* Section 19-20 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">19. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time to reflect legal, technical, or operational changes.
                If we make material changes, we may notify users by appropriate means, such as through the website,
                within the platform, or by email where appropriate. The latest version will always be made available
                through BetterNotes.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">20. Contact</h2>
              <p>If you have any questions about this Privacy Policy or the processing of your personal data:</p>
              <div className="pl-4 border-l border-white/20 space-y-1">
                <p><strong className="text-white">BETTERNOTES SL</strong></p>
                <p>Registered address: <Pending /></p>
                <p>General contact email: <Pending /></p>
                <p>Privacy contact email: <Pending /></p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
