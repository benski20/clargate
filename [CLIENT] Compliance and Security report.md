CLIENT COMPLIANCE AND SECURITY REPORT
Arbiter - IRB workflow platform

Summary for security, IRB, and procurement teams:

- Institution isolation: Your organization's users, proposals, messages, and files are separated from every other customer's data.

- Roles that match IRB reality: Separate capabilities for principal investigators, IRB administrators, and reviewers, including assignment-based reviewer access and safeguards around investigator drafts before formal submission.

- Multi-factor authentication (MFA): Dashboard access requires MFA using an authenticator app (TOTP), not password alone.

- Institutional signup controls: Users onboard with organization-issued signup codes so accounts attach to the right institution and role.

- Encryption in transit: Traffic between browsers and our application uses TLS.

- Private documents: Attachments are stored in private cloud storage (not public buckets); downloads use short-lived links instead of permanent open URLs.

- Audit visibility: Administrators can review logged actions across the lifecycle (for example submissions and resubmissions, document uploads, status changes, reviewer assignment, revision-letter sends, and selected administrative and AI-assisted steps).

- AWS and HIPAA: Components that run on Amazon Web Services use HIPAA-eligible services under AWS's rules; we have accepted AWS's Business Associate Addendum for our designated HIPAA Account (same instrument as in AWS+Business+Associate+Addendum.pdf). Your risk team should still validate how any PHI you place in Arbiter maps to your agreements with us and other vendors.

- AI use: Assistive features call external inference only to return outputs for the actions you take; our Privacy Policy states we do not use your research materials to train general-purpose models for advertising, resale, or broad foundation-model development.

- Campus identity (where contracted): SSO/SAML against your identity provider can be enabled on applicable institutional plans.

- FERPA / HIPAA / IRB: Whether records are education records, PHI, or solely governed by your IRB depends on your protocol and policies; we supply controls to support serious operations; your counsel and compliance office decide classifications and required contracts (including any business associate or data processing agreement with Arbiter).

Arbiter gives you one governed workspace with MFA, role separation, auditable actions, and private file handling. Completing your institution's vendor questionnaire and subprocessor review (database, hosting, AI providers, regions, email) remains your standard next step; we will support those conversations.

This overview is for convenience only. It is not legal advice and does not by itself show that any deployment meets FERPA, HIPAA, or IRB rules.
