import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/landing/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Arbiter",
  description: "How Arbiter collects, uses, and protects information when you use our platform.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-medium tracking-tight text-[#0A0A0A]">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="April 3, 2026">
      <p className="text-[#0A0A0A]/70">
        Arbiter Systems Inc. (“Arbiter,” “we,” “us,” or “our”) explains in this Privacy Policy how we collect, use,
        disclose, and protect information in connection with our websites, applications, and related services
        (collectively, the “Services”). By using the Services, you agree to this Privacy Policy together with our{" "}
        <Link href="/terms" className="text-[#0A0A0A] underline underline-offset-4 hover:text-[#0A0A0A]/80">
          Terms of Use
        </Link>
        .
      </p>

      <Section title="1. Who this policy applies to">
        <p>
          This policy applies to visitors to our marketing site, account holders, and users invited by an organization
          (for example, principal investigators, administrators, and reviewers). If your organization has a separate
          agreement with us (such as a data processing addendum), that agreement may supplement this policy where it
          applies to organizational data.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p>
          <strong className="font-medium text-[#0A0A0A]">Account and profile data.</strong> Name, email, role,
          institution or organization, and similar identifiers you or your administrator provide.
        </p>
        <p>
          <strong className="font-medium text-[#0A0A0A]">Content you submit.</strong> Research-related materials,
          messages, files, and metadata needed to operate workflows you use within the Services. Depending on your
          study, this may include information that is sensitive or regulated under research ethics rules, grant
          requirements, or health-privacy laws when applicable. You and your institution are responsible for
          determining what may be submitted and for obtaining appropriate authorizations.
        </p>
        <p>
          <strong className="font-medium text-[#0A0A0A]">Technical and usage data.</strong> IP address, device and
          browser type, approximate location derived from IP, log data, and product usage events to secure and improve
          the Services.
        </p>
        <p>
          <strong className="font-medium text-[#0A0A0A]">Support and communications.</strong> Information you send when
          you contact us or we respond to incidents.
        </p>
        <p>
          We collect only what we reasonably need to provide the Services, secure accounts, and meet our legal
          obligations. We do not ask you to provide unnecessary personal data beyond what your workflows require.
        </p>
      </Section>

      <Section title="3. How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>provide, maintain, and secure the Services;</li>
          <li>authenticate users and enforce access controls;</li>
          <li>communicate about the Services, including service and security notices;</li>
          <li>analyze usage in aggregate to improve performance and reliability (without using your research content to
            train machine learning models—see Section 4);</li>
          <li>comply with law and respond to lawful requests; and</li>
          <li>fulfill other purposes described when we collect information or with your consent.</li>
        </ul>
      </Section>

      <Section title="4. AI features, automation, and machine learning">
        <p>
          <strong className="font-medium text-[#0A0A0A]">Operational processing only.</strong> Some features may use
          automated processing or third-party inference APIs (for example, to help summarize text or suggest edits). Such
          processing runs to deliver the specific feature you invoke within the Services—not to build unrelated products.
        </p>
        <p>
          <strong className="font-medium text-[#0A0A0A]">We do not use your research content to train models.</strong>{" "}
          We do not use your protocols, submissions, attachments, messages, or other study materials to train,
          fine-tune, or improve general-purpose machine learning models—whether operated by Arbiter or by a third
          party—for advertising, resale, or broad model development. Your research content is not treated as training
          data for building or improving foundation models.
        </p>
        <p>
          <strong className="font-medium text-[#0A0A0A]">Subprocessors and APIs.</strong> Where we use vendors that
          provide model inference, we contract for services appropriate to institutional research and configure
          processing so that your content is used only to return outputs to you within the Services, consistent with our
          agreements and the provider’s applicable terms (including restrictions on use for model training where those
          terms are offered). We do not sell your data to AI vendors for training purposes.
        </p>
        <p>
          <strong className="font-medium text-[#0A0A0A]">Aggregates and telemetry.</strong> We may derive de-identified
          or aggregated statistics (for example, error rates or latency) to operate and improve the platform. Aggregates
          do not include your study content in identifiable form.
        </p>
      </Section>

      <Section title="5. Legal bases (where applicable)">
        <p>
          If the GDPR or similar laws apply, we rely on appropriate bases such as contract (providing the Services),
          legitimate interests (security and improvement, balanced against your rights), legal obligation, and consent
          where required.
        </p>
      </Section>

      <Section title="6. How we share information">
        <p>We may share information:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-[#0A0A0A]">Within your organization</strong> as configured in the
            product (for example, routing submissions to reviewers and administrators).
          </li>
          <li>
            <strong className="font-medium text-[#0A0A0A]">With service providers</strong> who assist us (hosting,
            email, analytics, security, and—where applicable—inference APIs) under contracts that limit use to providing
            services to us and, where relevant, prohibit use of your customer data for training their models except as
            stated in Section 4.
          </li>
          <li>
            <strong className="font-medium text-[#0A0A0A]">For legal reasons</strong> if we believe disclosure is
            required by law, regulation, legal process, or to protect rights, safety, and security.
          </li>
          <li>
            <strong className="font-medium text-[#0A0A0A]">In connection with a transaction</strong> such as a
            merger or acquisition, subject to appropriate safeguards.
          </li>
        </ul>
        <p>We do not sell your personal information as that term is commonly defined in U.S. state privacy laws.</p>
      </Section>

      <Section title="7. Retention">
        <p>
          We retain information for as long as your account is active, as needed to provide the Services, and as
          required for legal, audit, or contractual purposes. Retention periods may be set by your organization’s
          administrator where the product allows. When data is no longer needed, we delete or de-identify it in line with
          our retention schedules and your organization’s instructions where applicable.
        </p>
      </Section>

      <Section title="8. Security and access controls">
        <p>
          We implement administrative, technical, and organizational measures designed to protect information, including
          role-based access within the product, encryption of data in transit (TLS), and safeguards aligned with the
          sensitivity of research workflows. Access to production systems is limited to authorized personnel with a
          legitimate need.
        </p>
        <p>
          No method of transmission or storage is completely secure; we encourage strong passwords, multi-factor
          authentication where available, and institutional policies appropriate to sensitive research data.
        </p>
      </Section>

      <Section title="9. International transfers">
        <p>
          We may process information in the United States and other countries where we or our providers operate. Where
          required, we use appropriate safeguards such as standard contractual clauses.
        </p>
      </Section>

      <Section title="10. Your rights and choices">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export personal information, or
          to object to or restrict certain processing. You may also unsubscribe from marketing emails via the link in
          those emails. To exercise rights, contact us using the details below. You may lodge a complaint with a data
          protection authority where applicable.
        </p>
      </Section>

      <Section title="11. Children">
        <p>The Services are not directed to children under 16, and we do not knowingly collect their personal data.</p>
      </Section>

      <Section title="12. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the revised policy and update the “Last
          updated” date. Where changes are material, we will provide additional notice as appropriate.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Privacy questions and requests:{" "}
          <a
            href="mailto:contact@arbitercp.com?subject=Privacy%20Policy"
            className="text-[#0A0A0A] underline underline-offset-4 hover:text-[#0A0A0A]/80"
          >
            contact@arbitercp.com
          </a>
        </p>
      </Section>
    </LegalPageShell>
  );
}
