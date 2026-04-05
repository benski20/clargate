import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/landing/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Use — Arbiter",
  description: "Terms governing use of the Arbiter platform and related services.",
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

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" lastUpdated="April 3, 2026">
      <p className="text-[#0A0A0A]/70">
        These Terms of Use (“Terms”) govern your access to and use of the Arbiter websites, applications, and related
        services (collectively, the “Services”) operated by Arbiter Systems Inc. (“Arbiter,” “we,” “us,” or “our”). By
        accessing or using the Services, you agree to these Terms. If you do not agree, do not use the Services.
      </p>

      <Section title="1. Eligibility and accounts">
        <p>
          You must have authority to bind yourself or the organization you represent. You are responsible for maintaining
          the confidentiality of your credentials and for all activity under your account. You must notify us promptly
          of any unauthorized use.
        </p>
        <p>
          Creating an account through our self-service sign-up requires you to confirm that you have read and agree to
          these Terms and our{" "}
          <Link href="/privacy" className="text-[#0A0A0A] underline underline-offset-4 hover:text-[#0A0A0A]/80">
            Privacy Policy
          </Link>
          . If your organization provisions access another way, your administrator’s process may apply instead.
        </p>
      </Section>

      <Section title="2. The Services">
        <p>
          Arbiter provides tools to support research compliance workflows (for example, protocol intake, review
          coordination, messaging, and related features). Features may change over time. We do not guarantee
          availability, uninterrupted operation, or that the Services will meet every regulatory or institutional
          requirement without configuration by your organization.
        </p>
      </Section>

      <Section title="3. Your content and responsibilities">
        <p>
          You retain rights to content you submit (“Your Content”). You grant Arbiter a non-exclusive license to host,
          process, and display Your Content solely to provide and improve the Services, as described in our{" "}
          <Link href="/privacy" className="text-[#0A0A0A] underline underline-offset-4 hover:text-[#0A0A0A]/80">
            Privacy Policy
          </Link>
          . You represent that you have the rights needed to submit Your Content and that its use does not violate
          applicable law or third-party rights.
        </p>
        <p>
          You are responsible for how you use the Services, including compliance with institutional policies, research
          ethics requirements, and applicable laws. The Services are not a substitute for professional legal or
          regulatory advice.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>misuse the Services or attempt to gain unauthorized access to systems, data, or accounts;</li>
          <li>upload malware or interfere with security or integrity;</li>
          <li>use the Services in violation of law or to infringe others’ rights;</li>
          <li>reverse engineer or scrape the Services except where permitted by law;</li>
          <li>use the Services to build a competing product without our written consent.</li>
        </ul>
      </Section>

      <Section title="5. Intellectual property">
        <p>
          The Services, including software, branding, and documentation, are owned by Arbiter or its licensors and are
          protected by intellectual property laws. Except for the limited rights expressly granted in these Terms, no
          rights are transferred to you.
        </p>
      </Section>

      <Section title="6. Third-party services">
        <p>
          The Services may integrate with third-party services (for example, identity, email, or cloud infrastructure).
          Your use of those services may be subject to separate terms from those providers.
        </p>
      </Section>

      <Section title="7. Disclaimers">
        <p>
          THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARBITER DISCLAIMS
          ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE ERROR-FREE OR THAT
          RESULTS FROM USE OF THE SERVICES WILL MEET YOUR OR YOUR INSTITUTION’S COMPLIANCE OBLIGATIONS WITHOUT YOUR OWN
          REVIEW AND PROCESSES.
        </p>
      </Section>

      <Section title="8. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARBITER AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND
          SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
          LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM OR RELATED TO THE SERVICES OR THESE TERMS. OUR AGGREGATE
          LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THE SERVICES OR THESE TERMS WILL NOT EXCEED THE GREATER OF
          (A) THE AMOUNTS YOU PAID US FOR THE SERVICES IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S.
          DOLLARS (US$100), EXCEPT WHERE PROHIBITED BY LAW.
        </p>
      </Section>

      <Section title="9. Indemnity">
        <p>
          You will defend and indemnify Arbiter against claims, damages, losses, and expenses (including reasonable
          attorneys’ fees) arising from Your Content or your violation of these Terms or applicable law, except to the
          extent caused by our willful misconduct.
        </p>
      </Section>

      <Section title="10. Suspension and termination">
        <p>
          We may suspend or terminate access to the Services for violation of these Terms, risk to security, or as
          required by law. You may stop using the Services at any time. Provisions that by their nature should survive
          will survive termination.
        </p>
      </Section>

      <Section title="11. Changes">
        <p>
          We may modify these Terms by posting an updated version and updating the “Last updated” date. Material changes
          may be communicated through the Services or by email where appropriate. Continued use after changes become
          effective constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="12. Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, excluding conflict-of-law rules, unless
          mandatory consumer protection laws in your jurisdiction require otherwise. Courts in Delaware (or another forum
          we specify in an enterprise agreement) have exclusive jurisdiction, subject to mandatory arbitration or venue
          rules if agreed in writing.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Questions about these Terms:{" "}
          <a
            href="mailto:contact@arbitercp.com?subject=Terms%20of%20Use"
            className="text-[#0A0A0A] underline underline-offset-4 hover:text-[#0A0A0A]/80"
          >
            contact@arbitercp.com
          </a>
        </p>
      </Section>
    </LegalPageShell>
  );
}
