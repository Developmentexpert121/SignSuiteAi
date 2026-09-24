import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Hero */}
      <section className="bg-primary text-white py-24 relative overflow-hidden text-center">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-medium tracking-tight mb-6">
              Privacy Policy
            </h1>
            <p className="text-xl text-white/80">Effective Date: April 1, 2025</p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-slate max-w-none space-y-10 text-slate-700 leading-relaxed">

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Overview</h2>
              <p>
                SignSuiteIQ.ai ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our platform, including InstalliQ, SignSalesIQ, and SignTakeoffIQ
                (collectively, the "Services"). Please read this policy carefully. If you do not agree with the terms of this Privacy Policy,
                please do not access or use our Services.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. Information We Collect</h2>
              <p className="mb-3">We may collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Account Information:</strong> Name, email address, company name, job title, and password when you register for an account.
                </li>
                <li>
                  <strong>Billing Information:</strong> Payment card details and billing address, processed securely through our third-party payment processor. We do not store full card numbers.
                </li>
                <li>
                  <strong>Usage Data:</strong> Pages visited, features used, session duration, device type, browser type, IP address, and referring URLs.
                </li>
                <li>
                  <strong>Business Data:</strong> Project files, takeoff data, customer records, installation schedules, and other content you upload or create within the Services.
                </li>
                <li>
                  <strong>Communications:</strong> Messages you send to our support team or through contact forms.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, operate, and improve the Services.</li>
                <li>Process transactions and send billing-related communications.</li>
                <li>Send product updates, feature announcements, and marketing communications (you may opt out at any time).</li>
                <li>Respond to support requests and troubleshoot issues.</li>
                <li>Monitor and analyze usage trends to improve user experience.</li>
                <li>Detect, prevent, and address fraud, abuse, or security incidents.</li>
                <li>Comply with legal obligations.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. How We Share Your Information</h2>
              <p className="mb-3">We do not sell your personal information. We may share information with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Service Providers:</strong> Third-party vendors who assist us with hosting, payment processing, analytics, email delivery, and customer support — each bound by appropriate data protection agreements.
                </li>
                <li>
                  <strong>AI Processing Partners:</strong> Anonymized or de-identified data may be processed by AI infrastructure providers to power our intelligent features. Raw business data is never used to train external models without your explicit consent.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law, court order, or governmental authority.
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, subject to standard confidentiality protections.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed to provide Services. After account
                termination, we retain data for up to 90 days before secure deletion, unless a longer retention period is required by law
                or legitimate business necessity.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Security</h2>
              <p>
                We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, access controls,
                and regular security audits. While we strive to protect your data, no method of transmission over the internet is 100% secure.
                We encourage you to use a strong, unique password and enable two-factor authentication when available.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Your Rights and Choices</h2>
              <p className="mb-3">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal information we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your personal information.</li>
                <li>Opt out of marketing communications at any time via the unsubscribe link in any email.</li>
                <li>Data portability — receive a copy of your data in a machine-readable format.</li>
              </ul>
              <p className="mt-3">To exercise these rights, contact us at <a href="mailto:privacy@signsuiteiq.ai" className="text-accent hover:underline">privacy@signsuiteiq.ai</a>.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">8. Cookies</h2>
              <p>
                We use cookies and similar tracking technologies to improve your experience, analyze usage, and support marketing activities.
                You can control cookie preferences through your browser settings. Disabling certain cookies may affect the functionality of the Services.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">9. Children's Privacy</h2>
              <p>
                Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors.
                If you believe a minor has provided us with personal information, please contact us and we will promptly delete it.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through a prominent
                notice within the Services. Your continued use of the Services after the effective date constitutes acceptance of the updated policy.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">11. Contact Us</h2>
              <p>
                If you have questions or concerns about this Privacy Policy, please reach out:
              </p>
              <div className="mt-4 bg-slate-50 rounded-lg p-6 text-sm space-y-1">
                <p className="font-semibold text-primary">SignSuiteIQ.ai</p>
                <p>Email: <a href="mailto:privacy@signsuiteiq.ai" className="text-accent hover:underline">privacy@signsuiteiq.ai</a></p>
                <p>Website: <a href="https://www.signsuiteiq.ai" className="text-accent hover:underline">www.signsuiteiq.ai</a></p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
