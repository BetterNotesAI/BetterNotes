import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use',
};

function Pending({ label }: { label?: string }) {
  return (
    <span className="inline-block bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-1.5 py-0.5 text-xs font-mono">
      {label ?? '[PENDING TO COMPLETE]'}
    </span>
  );
}

export default function TermsOfUsePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link href="/support" className="text-xs text-white/60 hover:text-white transition-colors">
            ← Back to Support
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Terms of Use</h1>
          <p className="mt-1 text-sm text-white/60">
            Last updated: <Pending label="[PENDING TO COMPLETE]" />
          </p>
          <p className="mt-3 text-sm text-white/70 leading-relaxed">
            These Terms of Use govern access to and use of the BetterNotes website, platform, applications,
            tools, and related services made available by <strong className="text-white">BETTERNOTES SL</strong>.
            By accessing or using BetterNotes, you agree to be bound by these Terms. If you do not agree,
            you must not use the service.
          </p>
        </div>

        <div className="space-y-4 text-sm text-white/75 leading-relaxed">

          {/* Section 1 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">1. Provider Identification</h2>
            <p>The service is provided by:</p>
            <div className="pl-4 border-l border-white/20 space-y-1">
              <p><strong className="text-white">BETTERNOTES SL</strong></p>
              <p>Tax ID / CIF: <Pending /></p>
              <p>Registered address: <Pending /></p>
              <p>Contact email: <Pending /></p>
              <p>Privacy email: <Pending /></p>
            </div>
            <p>
              As an information society service provider established in Spain, BETTERNOTES SL is subject,
              among other rules, to the Spanish LSSI and other applicable Spanish and EU laws.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">2. About BetterNotes</h2>
            <p>
              BetterNotes is a digital platform that allows users to create, upload, organize, transform, and
              interact with educational and study-related content, including through artificial intelligence features.
            </p>
            <p>Depending on the services available at any given time, BetterNotes may include features such as:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>account creation and profile management;</li>
              <li>upload of files, notes, PDFs, and text;</li>
              <li>AI-assisted generation of summaries, cheat sheets, long-form notes, exams, and problem-solving content;</li>
              <li>organization of projects and study materials;</li>
              <li>optional publication or sharing of materials;</li>
              <li>free and paid subscription plans, including usage or credit-based features.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">3. Eligibility</h2>
            <p>You may use BetterNotes only if:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>you have the legal capacity to enter into a binding agreement;</li>
              <li>your use of the service is not prohibited under applicable law;</li>
              <li>you comply with these Terms and all applicable laws.</li>
            </ul>
            <p>
              <strong className="text-white">Minimum user age:</strong> <Pending />
            </p>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">4. User Account</h2>
            <p>To access some or all of BetterNotes, you may be required to create an account. You agree to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>provide accurate, current, and complete information;</li>
              <li>keep your login credentials secure and confidential;</li>
              <li>notify us promptly of any unauthorized use of your account;</li>
              <li>be responsible for all activity carried out through your account unless caused by our fault.</li>
            </ul>
            <p>
              We may suspend or terminate accounts that contain false information, violate these Terms,
              create security risks, or are used in a fraudulent, abusive, or unlawful manner.
            </p>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">5. Nature of the Service</h2>
            <p>
              BetterNotes provides software tools and digital functionalities for educational support. It does
              not provide accredited academic certification, official tutoring, legal advice, medical advice,
              professional engineering certification, or any other regulated professional service unless
              explicitly stated otherwise.
            </p>
            <p>The platform is intended as a productivity, study, and educational-assistance tool.</p>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">6. Acceptable Use</h2>
            <p>You agree to use BetterNotes lawfully, responsibly, and in good faith. You must not:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>use the service for unlawful, fraudulent, deceptive, or harmful purposes;</li>
              <li>upload or share content that infringes copyright, confidentiality, trade secrets, privacy, or other third-party rights;</li>
              <li>upload malware, malicious code, or harmful files;</li>
              <li>attempt to gain unauthorized access to the platform, other accounts, or underlying systems;</li>
              <li>interfere with the integrity, security, or operation of the service;</li>
              <li>scrape, reverse engineer, decompile, or exploit the platform beyond what is permitted by law;</li>
              <li>use BetterNotes to generate or distribute unlawful, defamatory, abusive, threatening, discriminatory, or otherwise prohibited content;</li>
              <li>use bots or automated systems in a way that overloads, disrupts, or abuses the service;</li>
              <li>circumvent plan restrictions, usage limits, access controls, or payment obligations;</li>
              <li>upload official exam papers, copyrighted textbooks, commercial educational material, or third-party notes without authorization.</li>
            </ul>
            <p>
              Because BetterNotes allows users to upload and transform documents, compliance with copyright and
              authorization rules is especially important. Spain&apos;s Intellectual Property Law protects copyrighted
              works and related rights, and unauthorized reproduction, transformation, or communication of
              protected material may be unlawful.
            </p>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">7. User Content</h2>
            <p>
              &ldquo;User Content&rdquo; means any files, text, prompts, notes, PDFs, metadata, profile materials,
              comments, feedback, or other content submitted, uploaded, published, or otherwise made available
              by you through BetterNotes.
            </p>
            <p>You retain ownership of your User Content, subject to the rights you grant to BETTERNOTES SL under these Terms.</p>
            <p>You represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>you own or control all rights necessary to upload, process, use, and, where applicable, publish that content;</li>
              <li>your User Content does not infringe any third-party rights;</li>
              <li>your User Content does not violate any law, regulation, contractual duty, or confidentiality obligation;</li>
              <li>if your User Content contains personal data of third parties, you have a valid legal basis to disclose and process it through the service.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">8. License Granted to BetterNotes</h2>
            <p>
              To operate the service, you grant BETTERNOTES SL a non-exclusive, worldwide, revocable,
              royalty-free license to host, store, reproduce, process, adapt, transform, display, transmit, and
              otherwise use your User Content solely to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>provide and operate BetterNotes;</li>
              <li>process your requests;</li>
              <li>generate outputs and deliver platform functionalities;</li>
              <li>store and display your content according to your chosen settings;</li>
              <li>maintain security, prevent abuse, debug errors, and improve technical performance;</li>
              <li>comply with legal obligations and enforce these Terms.</li>
            </ul>
            <p>
              This license lasts only for as long as necessary for those purposes, subject to applicable
              retention obligations and the technical operation of the service.
            </p>
            <p>
              If you choose to publish or make content visible to others, you also grant BETTERNOTES SL
              the rights necessary to display and distribute that content within the BetterNotes platform
              according to your selected visibility settings.
            </p>
          </section>

          {/* Section 9 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">9. AI Features and Generated Output</h2>
            <p>BetterNotes may use artificial intelligence models, APIs, and related technologies to analyze inputs and generate outputs. By using these features, you acknowledge and agree that:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>your prompts, uploaded content, excerpts, and related inputs may be processed by third-party AI service providers acting in connection with the service;</li>
              <li>AI-generated output may be incomplete, inaccurate, misleading, outdated, biased, or otherwise unsuitable for your intended use;</li>
              <li>BetterNotes does not guarantee the factual accuracy, originality, legal availability, or academic suitability of AI-generated content;</li>
              <li>you are solely responsible for reviewing and evaluating any generated output before using, sharing, publishing, submitting, or relying on it.</li>
            </ul>
            <p>This is especially relevant for educational, technical, scientific, and exam-related outputs, where errors or hallucinations may occur.</p>
          </section>

          {/* Section 10 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">10. No Academic Guarantee</h2>
            <p>BetterNotes does not guarantee:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>academic success;</li>
              <li>exam results;</li>
              <li>grading outcomes;</li>
              <li>absence of errors;</li>
              <li>absence of plagiarism risk;</li>
              <li>suitability for a specific course, institution, or professor;</li>
              <li>compliance of any generated output with academic integrity rules applicable to your school or university.</li>
            </ul>
            <p>
              You are solely responsible for ensuring that your use of BetterNotes complies with your
              institution&apos;s policies, academic honesty rules, and submission requirements.
            </p>
          </section>

          {/* Section 11 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">11. Copyright, Intellectual Property, and Infringement Policy</h2>
            <p>You must not upload, process, transform, or publish content unless you have the legal right to do so. This includes, without limitation:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>commercial textbooks;</li>
              <li>copyrighted lecture notes belonging to third parties;</li>
              <li>proprietary training materials;</li>
              <li>official examination papers or protected answer keys;</li>
              <li>any other protected content for which you lack authorization.</li>
            </ul>
            <p>
              BETTERNOTES SL may remove, disable access to, or restrict any content where we reasonably
              believe there may be copyright infringement, unlawful use, or violation of these Terms.
              We may also suspend repeat infringers or users who repeatedly upload unauthorized material.
            </p>
            <p>Spanish copyright law protects authors&apos; rights and related rights over original works and other protected materials.</p>
          </section>

          {/* Section 12 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">12. Public Content and Sharing</h2>
            <p>BetterNotes may allow users to publish or share content, profiles, or educational materials publicly or semi-publicly. If you choose to make content public:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>you are solely responsible for that decision;</li>
              <li>your username, profile information, or other identifying details may appear together with the content;</li>
              <li>your content may be visible to other users and, depending on the design of the service, potentially to visitors;</li>
              <li>BetterNotes may continue displaying cached or technically stored versions for a limited period as part of normal service operation.</li>
            </ul>
            <p><strong className="text-white">Default publication setting:</strong> <Pending /></p>
          </section>

          {/* Section 13 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">13. Platform Content and BetterNotes Intellectual Property</h2>
            <p>Except for User Content, BetterNotes and all related elements are owned by or licensed to BETTERNOTES SL, including, where applicable:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>the BetterNotes name, brand, logo, visual identity, and trademarks;</li>
              <li>software, code, architecture, interface design, workflows, text, graphics, databases, and platform content;</li>
              <li>documentation, templates, site structure, and proprietary materials created by BETTERNOTES SL.</li>
            </ul>
            <p>
              You may not copy, reproduce, distribute, modify, create derivative works from, publicly communicate,
              or exploit any part of BetterNotes except as permitted by these Terms or by mandatory law.
            </p>
          </section>

          {/* Section 14 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">14. Feedback</h2>
            <p>
              If you provide suggestions, ideas, recommendations, bug reports, or other feedback relating to
              BetterNotes, you grant BETTERNOTES SL a non-exclusive, worldwide, perpetual, irrevocable,
              royalty-free right to use, implement, reproduce, adapt, and exploit that feedback for any lawful
              business purpose, without compensation to you.
            </p>
            <p>This does not transfer ownership of your personal data and does not override the Privacy Policy.</p>
          </section>

          {/* Section 15 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">15. Plans, Pricing, and Credits</h2>
            <p>
              BetterNotes may offer free and paid plans and may operate with usage limits, credits, model
              access rules, or other plan-based restrictions. If you subscribe to a paid plan:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>you agree to pay the applicable fees shown at the time of purchase;</li>
              <li>pricing, features, and plan limits may vary over time;</li>
              <li>access to certain features, models, outputs, or usage volumes may depend on the selected plan;</li>
              <li>we may modify plan structure, pricing, or included features in the future, subject to applicable law and reasonable notice where required.</li>
            </ul>
            <p><strong className="text-white">Current plan/pricing page:</strong> <Pending /></p>
          </section>

          {/* Section 16 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">16. Payments and Renewals</h2>
            <p>
              All payments are processed securely through our third-party provider, <strong className="text-white">Stripe, Inc.</strong> By
              subscribing, you authorize us and our payment provider to charge the applicable fees to your
              designated payment method.
            </p>
          </section>

          {/* Section 17 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">17. Right of Withdrawal for Consumers</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-300 text-xs font-mono">[PENDING TO COMPLETE after final subscription design]</p>
            </div>
            <p>
              If BetterNotes is offered to consumers in the EU, a statutory withdrawal right may apply in some
              circumstances to distance contracts. However, for digital content or digital services supplied
              immediately, that right may be lost once performance has begun with the user&apos;s prior express
              consent and acknowledgment where legally required.
            </p>
            <p>This section should be reviewed carefully before publication to match the actual checkout flow.</p>
          </section>

          {/* Section 18 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">18. Suspension and Termination</h2>
            <p>We may suspend, restrict, or terminate your access to BetterNotes, with or without prior notice where appropriate, if:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>you breach these Terms;</li>
              <li>you fail to pay fees due;</li>
              <li>you misuse the platform;</li>
              <li>your use creates legal, technical, or security risk;</li>
              <li>we are required to do so by law or competent authority;</li>
              <li>maintaining your account is no longer operationally feasible.</li>
            </ul>
            <p>
              You may stop using BetterNotes at any time and may request deletion of your account subject
              to applicable legal and technical constraints. Termination does not affect rights or obligations
              accrued before termination.
            </p>
          </section>

          {/* Section 19 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">19. Service Availability and Changes</h2>
            <p>
              We may update, modify, suspend, or discontinue all or part of BetterNotes at any time for
              operational, legal, security, or business reasons. We do not guarantee uninterrupted availability,
              error-free operation, or permanent availability of any specific feature. From time to time we may
              perform maintenance, apply updates, or change the design, models, tools, pricing, features, or
              functionality of the platform.
            </p>
          </section>

          {/* Section 20 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">20. Disclaimer of Warranties</h2>
            <p>
              To the fullest extent permitted by applicable law, BetterNotes is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis. BETTERNOTES SL does not warrant that:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>the service will always be uninterrupted, secure, or error-free;</li>
              <li>outputs will be accurate, complete, lawful, original, or fit for a particular purpose;</li>
              <li>the platform will meet all user expectations;</li>
              <li>uploaded content will never be lost, corrupted, delayed, or inaccessible;</li>
              <li>the service will be compatible with all devices, browsers, systems, or external tools.</li>
            </ul>
            <p>Nothing in these Terms excludes warranties that cannot lawfully be excluded under applicable consumer law.</p>
          </section>

          {/* Section 21 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">21. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, BETTERNOTES SL shall not be liable for:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>indirect, incidental, special, consequential, or punitive damages;</li>
              <li>loss of profits, revenue, business, opportunity, reputation, data, goodwill, or expected savings;</li>
              <li>academic outcomes, grades, admissions, exam performance, or institutional sanctions;</li>
              <li>errors, inaccuracies, or omissions in AI-generated or user-generated content;</li>
              <li>infringement caused by content uploaded, published, or used by users;</li>
              <li>service interruptions, outages, third-party failures, or events beyond our reasonable control.</li>
            </ul>
            <p>
              In any event, BETTERNOTES SL&apos;s aggregate liability arising out of or in connection with the service
              shall, to the extent legally permitted, be limited to the total amount paid by you to BETTERNOTES SL
              in the twelve months preceding the event giving rise to the claim. Nothing in these Terms excludes
              or limits liability that cannot be excluded under applicable law.
            </p>
          </section>

          {/* Section 22 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">22. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless BETTERNOTES SL, its directors, officers,
              employees, contractors, and affiliates from and against claims, losses, liabilities, damages,
              costs, and expenses, including reasonable legal fees, arising from or related to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>your User Content;</li>
              <li>your misuse of BetterNotes;</li>
              <li>your violation of these Terms;</li>
              <li>your infringement of third-party rights;</li>
              <li>your breach of applicable law.</li>
            </ul>
          </section>

          {/* Sections 23-25 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">23. Privacy and Data Protection</h2>
              <p>
                The processing of personal data is governed by our{' '}
                <Link href="/support/privacy-policy" className="text-indigo-300 hover:text-indigo-200 underline">Privacy Policy</Link>.
                Where personal data is involved, BETTERNOTES SL will process such data in accordance with
                applicable data protection law, including the GDPR where applicable.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">24. Cookies</h2>
              <p>
                Use of cookies and similar technologies is governed by our{' '}
                <Link href="/support/cookie-policy" className="text-indigo-300 hover:text-indigo-200 underline">Cookie Policy</Link>{' '}
                and applicable law, including the Spanish LSSI rules on cookies and user consent for non-essential cookies.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">25. Links to Third-Party Services</h2>
              <p>
                BetterNotes may include links to or integrations with third-party websites, services, tools, login
                providers, AI providers, payment processors, or content sources. We are not responsible for the
                availability, legality, content, or privacy practices of third-party services.
              </p>
            </div>
          </section>

          {/* Sections 26-30 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-4">
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">26. Governing Law</h2>
              <p>
                These Terms shall be governed by the laws of Spain, without prejudice to any mandatory
                consumer-protection rules that may apply under the law of the country of residence of a consumer user.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">27. Jurisdiction</h2>
              <p>
                Unless mandatory consumer law provides otherwise, any dispute relating to these Terms or the
                use of BetterNotes shall be submitted to the courts of <strong className="text-white">Barcelona, Spain</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">28. Severability</h2>
              <p>
                If any provision of these Terms is found to be invalid, unlawful, or unenforceable, the remaining
                provisions shall remain in full force and effect.
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">29. No Waiver</h2>
              <p>Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision or of any other right.</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">30. Entire Agreement</h2>
              <p>
                These Terms, together with the Privacy Policy, Cookie Policy, and any additional legal notices
                expressly incorporated by reference, constitute the entire agreement between you and BETTERNOTES SL
                regarding the use of BetterNotes.
              </p>
            </div>
          </section>

          {/* Section 31 */}
          <section className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">31. Contact</h2>
            <p>If you have questions about these Terms, you may contact:</p>
            <div className="pl-4 border-l border-white/20 space-y-1">
              <p><strong className="text-white">BETTERNOTES SL</strong></p>
              <p>Registered address: <Pending /></p>
              <p>Contact email: <Pending /></p>
              <p>Privacy email: <Pending /></p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
