import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function TermsOfService() {
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
              Terms of Service
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
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing or using SignSuiteIQ.ai and its products — InstalliQ, SignSalesIQ, and SignTakeoffIQ (collectively, the "Services") —
                you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, you may not
                use the Services. If you are using the Services on behalf of a company or organization, you represent that you have authority to
                bind that entity to these Terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. Description of Services</h2>
              <p>
                SignSuiteIQ.ai provides AI-powered software tools designed for the sign and graphics industry. The Services include installation
                workflow management (InstalliQ), sales proposal generation (SignSalesIQ), and automated takeoff and estimating tools (SignTakeoffIQ).
                Features and availability may vary by subscription plan and are subject to change with reasonable notice.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. Account Registration</h2>
              <p className="mb-3">To use the Services, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Create an account with accurate and complete information.</li>
                <li>Maintain the security of your account credentials. You are responsible for all activity under your account.</li>
                <li>Promptly notify us at <a href="mailto:support@signsuiteiq.ai" className="text-accent hover:underline">support@signsuiteiq.ai</a> if you suspect unauthorized access.</li>
                <li>Be at least 18 years of age or have the legal authority to enter into contracts in your jurisdiction.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. Subscription Plans and Payment</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Services are offered on a subscription basis, billed monthly or annually as selected at checkout.</li>
                <li>All fees are non-refundable except as required by law or explicitly stated in our refund policy.</li>
                <li>Prices may change with at least 30 days' advance notice. Continued use after the effective date constitutes acceptance.</li>
                <li>Failure to pay may result in suspension or termination of your account.</li>
                <li>Annual plans are prepaid. Cancellation stops renewal but does not entitle you to a refund for unused months.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Free Trials</h2>
              <p>
                We may offer free trials for new accounts. At the end of a trial period, your account will automatically convert to a paid
                subscription unless you cancel before the trial ends. We reserve the right to modify or discontinue free trial offers at any time.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Services for any unlawful purpose or in violation of any applicable regulations.</li>
                <li>Attempt to gain unauthorized access to our systems, other accounts, or data.</li>
                <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of our software.</li>
                <li>Upload or transmit malicious code, viruses, or any content that could damage or disrupt the Services.</li>
                <li>Resell, sublicense, or redistribute the Services without express written permission.</li>
                <li>Use automated scripts or bots to scrape, crawl, or otherwise extract data from the Services.</li>
                <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Intellectual Property</h2>
              <p>
                All software, content, trademarks, logos, and technology within the Services are owned by SignSuiteIQ.ai or its licensors and are
                protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Services
                for your internal business purposes during your subscription term. No ownership rights are transferred to you.
              </p>
              <p className="mt-3">
                You retain ownership of all business data and content you upload to the Services. By uploading content, you grant us a limited
                license to process and store that content solely to provide the Services to you.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">8. AI-Generated Content</h2>
              <p>
                The Services use artificial intelligence to generate proposals, estimates, schedules, and other outputs. You acknowledge that
                AI-generated content may contain errors and should be reviewed by a qualified professional before use. SignSuiteIQ.ai makes no
                warranty that AI-generated outputs are accurate, complete, or suitable for any specific purpose. You are solely responsible for
                verifying and approving any outputs before relying on them in your business operations.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">9. Disclaimers</h2>
              <p>
                THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES
                OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE
                UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">10. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, SIGNSUITEIQ.AI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                OR PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS, DATA, BUSINESS, OR GOODWILL — ARISING FROM YOUR USE OF OR INABILITY TO USE THE
                SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU SHALL NOT EXCEED THE AMOUNTS PAID BY
                YOU TO SIGNSUITEIQ.AI IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">11. Termination</h2>
              <p>
                You may cancel your subscription at any time through your account settings or by contacting support. We reserve the right to
                suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or fail to pay fees. Upon termination,
                your right to use the Services ends immediately. We will provide a 30-day window to export your data before it is deleted.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">12. Governing Law and Disputes</h2>
              <p>
                These Terms are governed by the laws of the State of Texas, United States, without regard to conflict of law principles.
                Any disputes arising under these Terms shall be resolved through binding arbitration administered under the rules of the
                American Arbitration Association, except that either party may seek injunctive relief in a court of competent jurisdiction.
                You waive any right to participate in a class action lawsuit.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">13. Changes to These Terms</h2>
              <p>
                We may modify these Terms at any time. We will notify you via email or in-app notice at least 14 days before material changes
                take effect. Continued use of the Services after the effective date constitutes your acceptance of the revised Terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-primary mb-4">14. Contact Us</h2>
              <p>For questions about these Terms, please contact:</p>
              <div className="mt-4 bg-slate-50 rounded-lg p-6 text-sm space-y-1">
                <p className="font-semibold text-primary">SignSuiteIQ.ai</p>
                <p>Email: <a href="mailto:legal@signsuiteiq.ai" className="text-accent hover:underline">legal@signsuiteiq.ai</a></p>
                <p>Website: <a href="https://www.signsuiteiq.ai" className="text-accent hover:underline">www.signsuiteiq.ai</a></p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
