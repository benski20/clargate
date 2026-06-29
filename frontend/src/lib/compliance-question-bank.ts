import type { ComplianceQuestion } from "@/lib/compliance-questionnaire-types";

export const COMPLIANCE_QUESTION_BANK: readonly ComplianceQuestion[] = [
  // ── Core Information & Funding ──────────────────────────────────────
  {
    questionId: "CI.1",
    cayuseSection: "core_information",
    questionText: "In what general discipline(s) does your research fall under?",
    helpText: "Biomedical, Social/Behavioral/Educational Research (SBER), or Other",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "select",
    selectOptions: ["Biomedical", "SBER", "Other"],
    branchParentId: null,
  },
  {
    questionId: "CI.2",
    cayuseSection: "core_information",
    questionText: "What kind of funding or support do you have for this study?",
    helpText: "Federal, Institutional, Private, or None",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "select",
    selectOptions: ["Federal", "Institutional", "Private", "None"],
    branchParentId: null,
  },
  {
    questionId: "CI.2.b",
    cayuseSection: "core_information",
    questionText:
      "Please provide the Proposal or Account Number and attach the statement of work or project summary.",
    helpText: "Required when the study has any form of funding or support",
    sectionKey: "general",
    applicableWhen: [{ signal: "has_funding", value: true }],
    answerType: "text",
    branchParentId: "CI.2",
  },
  {
    questionId: "CI.3",
    cayuseSection: "core_information",
    questionText:
      "Are you collaborating with another group (school, agency, organization, etc.)?",
    helpText:
      "If yes, attach IRB approval letter, non-engagement letter, or signed IRB Authorization Agreement from collaborating institution",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "CI.3.b",
    cayuseSection: "core_information",
    questionText:
      "Describe the collaboration and confirm that you have attached the required IRB documentation from the collaborating institution.",
    helpText:
      "IRB approval letter, non-engagement letter, or signed IRB Authorization Agreement",
    sectionKey: "general",
    applicableWhen: [{ signal: "has_collaboration", value: true }],
    answerType: "text",
    branchParentId: "CI.3",
  },
  {
    questionId: "CI.4",
    cayuseSection: "core_information",
    questionText: "Will any research be conducted outside the United States?",
    helpText: "International research requires additional documentation",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "CI.5",
    cayuseSection: "core_information",
    questionText:
      "Explain where international research will take place and provide the required documentation.",
    helpText:
      "Local ethics board approval for Expedited/Full Board; letter of cultural appropriateness for Exempt; Risk Management email and/or Risk Assessment Report",
    sectionKey: "general",
    applicableWhen: [{ signal: "involves_international", value: true }],
    answerType: "text",
    branchParentId: "CI.4",
  },
  {
    questionId: "CI.6",
    cayuseSection: "core_information",
    questionText:
      "Will any non-English language be used in consent forms, data collection, or recruitment materials?",
    helpText:
      "If yes, specify all languages and upload translated materials with back-translations and translator credentials",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "CI.6.b",
    cayuseSection: "core_information",
    questionText:
      "Specify all non-English languages used and confirm that translated materials with back-translations and translator credentials have been uploaded.",
    helpText: "CV or certification for translators is required",
    sectionKey: "general",
    applicableWhen: [{ signal: "uses_non_english", value: true }],
    answerType: "text",
    branchParentId: "CI.6",
  },
  {
    questionId: "CI.7",
    cayuseSection: "core_information",
    questionText: "Under which IRB review category does your study fall?",
    helpText:
      "Exempt, Expedited, or Full Board. Selecting Exempt routes to a shorter form. If the IRB later determines a higher category, you will need to resubmit.",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "select",
    selectOptions: ["Exempt", "Expedited", "Full Board"],
    branchParentId: null,
  },
  {
    questionId: "CI.7.exempt",
    cayuseSection: "core_information",
    questionText:
      "Explain your reasoning for Exempt status and confirm your study does NOT involve: vulnerable populations, public disclosure of identifiable harmful data, data methods beyond surveys/tests/interviews/public observation, sensitive subjects, recordings for research, or identifiable health information.",
    helpText:
      "Studies involving any of the listed elements cannot qualify for Exempt review",
    sectionKey: "general",
    applicableWhen: [{ signal: "is_exempt", value: true }],
    answerType: "text",
    branchParentId: "CI.7",
  },
  {
    questionId: "CI.7.expedited_full",
    cayuseSection: "core_information",
    questionText:
      "Explain your reasoning for Expedited or Full Board review based on regulatory definitions.",
    helpText: "The IRB determines the final review category",
    sectionKey: "general",
    applicableWhen: [{ signal: "is_expedited_or_full", value: true }],
    answerType: "text",
    branchParentId: "CI.7",
  },

  // ── Personnel ───────────────────────────────────────────────────────
  {
    questionId: "PERS.1",
    cayuseSection: "personnel",
    questionText:
      "Identify your status as it applies to this protocol (Faculty, Staff, or Unaffiliated Researcher).",
    helpText:
      "Adjuncts/Lecturers require Department Chair approval letter; unaffiliated researchers require an Unaffiliated Investigator Agreement",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "select",
    selectOptions: ["Faculty", "Staff", "Unaffiliated Researcher"],
    branchParentId: null,
  },
  {
    questionId: "PERS.3",
    cayuseSection: "personnel",
    questionText: "List any Co-Principal Investigator(s).",
    helpText: "Provide names and institutional affiliations",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "PERS.4",
    cayuseSection: "personnel",
    questionText: "List any Student Investigators.",
    helpText: "Include name, degree program, and role in the study",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "PERS.5",
    cayuseSection: "personnel",
    questionText:
      "List all Key Personnel, including unaffiliated individuals.",
    helpText: "Anyone who will interact with participants or handle data",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "PERS.7",
    cayuseSection: "personnel",
    questionText:
      "Have all investigators and key personnel completed required CITI human subjects training?",
    helpText:
      "All CITI training must have been completed within the past three years. Attach CITI completion certificate(s).",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "PERS.8",
    cayuseSection: "personnel",
    questionText:
      "Will you be working with external or unaffiliated Co-PIs?",
    helpText:
      "Provide names, affiliations, roles, and whether they will have access to identifiable data. Upload Unaffiliated Investigator Agreement and CITI certificate if unaffiliated with any IRB.",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },

  // ── Research Focus & Concepts ───────────────────────────────────────
  {
    questionId: "1.1",
    cayuseSection: "research_focus",
    questionText:
      "Describe the purpose of the study in lay language, including the research question (~half page).",
    helpText: "Use plain language a non-specialist can understand",
    sectionKey: "background_rationale",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "1.2",
    cayuseSection: "research_focus",
    questionText:
      "Summarize previous research leading to this study, including citations.",
    helpText: "Brief literature review establishing the foundation",
    sectionKey: "background_rationale",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },

  // ── Methods ─────────────────────────────────────────────────────────
  {
    questionId: "2.1",
    cayuseSection: "methods",
    questionText:
      "Summarize the overall study design (quantitative, qualitative, or mixed; identify variables and interventions).",
    helpText: "Include the type of design and key variables",
    sectionKey: "study_design",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "2.2",
    cayuseSection: "methods",
    questionText:
      "Will you test a food product or provide a nutritional supplement to participants?",
    helpText: "If yes, provide brand, dosage, schedule, adverse effects contact, and possible adverse effects",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "2.2.b",
    cayuseSection: "methods",
    questionText:
      "Provide the brand, dosage, administering schedule, contact for adverse effects, and possible adverse effects for the food product or nutritional supplement.",
    helpText: "Required for any study involving food products or supplements",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "involves_food_supplement", value: true }],
    answerType: "text",
    branchParentId: "2.2",
  },
  {
    questionId: "2.3",
    cayuseSection: "methods",
    questionText:
      "Provide a step-by-step outline of all study activities in order.",
    helpText:
      "From initial contact through completion, including time estimates",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },

  // ── Subjects & Recruitment ──────────────────────────────────────────
  {
    questionId: "3.1",
    cayuseSection: "subjects_recruitment",
    questionText:
      "State the maximum projected number of participants (provide a hard total, no vague estimates).",
    helpText: "A specific number, not a range or 'approximately'",
    sectionKey: "participants",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "3.2",
    cayuseSection: "subjects_recruitment",
    questionText:
      "Describe the participant population (gender, racial/ethnic composition, and age range).",
    helpText: "Include inclusion and exclusion criteria",
    sectionKey: "participants",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "3.3",
    cayuseSection: "subjects_recruitment",
    questionText:
      "Describe how subjects will be recruited (face-to-face, email, flyer, classroom announcement, etc.).",
    helpText: "List all recruitment methods",
    sectionKey: "recruitment",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "3.4",
    cayuseSection: "subjects_recruitment",
    questionText: "Describe where recruitment will take place.",
    helpText:
      "Attach site permission letter, social media group admin screenshot, or email list owner permission as applicable",
    sectionKey: "recruitment",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "3.5",
    cayuseSection: "subjects_recruitment",
    questionText:
      "Have you attached all recruitment materials (flyers, email scripts, classroom scripts, social media posts)?",
    helpText:
      "If no recruitment materials are being submitted, explain why (e.g., study involves review of existing records)",
    sectionKey: "recruitment",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "3.6",
    cayuseSection: "subjects_recruitment",
    questionText:
      "Will any of the following vulnerable populations be included: children (under 18), prisoners, or mentally impaired individuals?",
    helpText:
      "Any study involving a vulnerable population requires Expedited or Full Board review; Exempt is not available",
    sectionKey: "participants",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "3.6.b",
    cayuseSection: "subjects_recruitment",
    questionText:
      "Describe the special precautions taken for each vulnerable population identified.",
    helpText:
      "Address how you will protect the rights and welfare of these participants",
    sectionKey: "participants",
    applicableWhen: [{ signal: "involves_vulnerable_populations", value: true }],
    answerType: "text",
    branchParentId: "3.6",
  },
  {
    questionId: "3.7",
    cayuseSection: "subjects_recruitment",
    questionText: "Identify all study locations.",
    helpText:
      "Attach site permission letter on institutional letterhead for Expedited/Full Board off-campus studies",
    sectionKey: "recruitment",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },

  // ── Data Collection ─────────────────────────────────────────────────
  {
    questionId: "4.1",
    cayuseSection: "data_collection",
    questionText:
      "Select all data collection methods that apply: interviews, paper surveys, internet surveys, focus groups, review of existing records, observation, exercise protocol, DXA/radiographic imaging, or other.",
    helpText: "Select all that apply; you will be asked follow-up questions for each method",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "4.1.1",
    cayuseSection: "data_collection",
    questionText:
      "Explain how interviews will be conducted and documented. Attach the list of interview questions.",
    helpText: "Required even for unstructured interviews",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_interviews", value: true }],
    answerType: "text",
    branchParentId: "4.1",
  },
  {
    questionId: "4.1.2",
    cayuseSection: "data_collection",
    questionText:
      "Have you attached copies of all paper surveys and questionnaires as participants will see them?",
    helpText: "Submit the exact version participants will receive",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_paper_surveys", value: true }],
    answerType: "yes_no",
    branchParentId: "4.1",
  },
  {
    questionId: "4.1.3",
    cayuseSection: "data_collection",
    questionText:
      "Have you attached an exported PDF showing the consent notice followed by the internet survey questions?",
    helpText: "The consent notice must appear first in the exported PDF",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_internet_surveys", value: true }],
    answerType: "yes_no",
    branchParentId: "4.1",
  },
  {
    questionId: "4.1.4",
    cayuseSection: "data_collection",
    questionText:
      "Explain how focus groups will be conducted and documented. Attach all related materials.",
    helpText: "Include moderation guide and topic list",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_focus_groups", value: true }],
    answerType: "text",
    branchParentId: "4.1",
  },
  {
    questionId: "4.1.5",
    cayuseSection: "data_collection",
    questionText:
      "Describe the existing records to be reviewed and note whether data is de-identified.",
    helpText:
      "Upload outside-source approval if applicable; upload list of data points to be reviewed",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_existing_records", value: true }],
    answerType: "text",
    branchParentId: "4.1",
  },
  {
    questionId: "4.1.6",
    cayuseSection: "data_collection",
    questionText:
      "Explain the observation context — is it public or private? Describe the setting and consent plan for private observation.",
    helpText: "Public observation does not require consent; private observation does",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_observation", value: true }],
    answerType: "text",
    branchParentId: "4.1",
  },
  {
    questionId: "4.2",
    cayuseSection: "data_collection",
    questionText:
      "Does the study collect or analyze any biological samples (blood, urine, tissue, saliva, etc.)?",
    helpText: "If yes, additional details about collection, storage, and disposal are required",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "4.2.b",
    cayuseSection: "data_collection",
    questionText:
      "List biological samples, explain volume, frequency, collection technique, how samples will be obtained, storage plan (duration, location, disposal), and confirm IBC approval has been uploaded.",
    helpText:
      "IBC (Institutional Biosafety Committee) approval is required before IRB approval can be issued",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "collects_biological_samples", value: true }],
    answerType: "text",
    branchParentId: "4.2",
  },
  {
    questionId: "4.3",
    cayuseSection: "data_collection",
    questionText:
      "Will participants be audio-recorded or video-recorded?",
    helpText:
      "If audio: name who will transcribe and attach NDA for third-party transcription. If video: describe how anonymity will be maintained.",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "4.3.b",
    cayuseSection: "data_collection",
    questionText:
      "Specify whether audio only, video only, or both. Describe transcription plans and anonymity measures.",
    helpText:
      "Audio: name the transcriber; attach NDA if third-party. Video: describe face-blurring or other anonymity measures.",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_recordings", value: true }],
    answerType: "text",
    branchParentId: "4.3",
  },
  {
    questionId: "4.4",
    cayuseSection: "data_collection",
    questionText:
      "Will any third-party online platforms be used (e.g., Qualtrics, MTurk, social media)?",
    helpText: "Identify all platforms and their specific use cases in the study",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "4.4.b",
    cayuseSection: "data_collection",
    questionText:
      "Identify all third-party online platforms and describe their specific use cases in the study.",
    helpText: "Include platform names and what data will be collected through each",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "uses_online_platforms", value: true }],
    answerType: "text",
    branchParentId: "4.4",
  },
  {
    questionId: "4.5",
    cayuseSection: "data_collection",
    questionText:
      "Will you gather information from participants' medical records?",
    helpText:
      "Describe what records, how they will be accessed, and what authorization will be obtained",
    sectionKey: "procedures",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "4.5.b",
    cayuseSection: "data_collection",
    questionText:
      "Describe what medical records will be accessed, how, and what authorization will be obtained.",
    helpText: "HIPAA authorization may be required",
    sectionKey: "procedures",
    applicableWhen: [{ signal: "accesses_medical_records", value: true }],
    answerType: "text",
    branchParentId: "4.5",
  },

  // ── Data Security ───────────────────────────────────────────────────
  {
    questionId: "5.1",
    cayuseSection: "data_security",
    questionText:
      "Is the study identifiable, coded, or anonymous?",
    helpText: "Identifiable: data linked to participants. Coded: key exists. Anonymous: no link possible.",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "select",
    selectOptions: ["Identifiable", "Coded", "Anonymous"],
    branchParentId: null,
  },
  {
    questionId: "5.2",
    cayuseSection: "data_security",
    questionText:
      "Will Personally Identifiable Information (PII) be collected or used?",
    helpText: "Names, addresses, SSN, email, phone numbers, etc.",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "5.2.b",
    cayuseSection: "data_security",
    questionText:
      "Describe what PII will be collected and how it will be protected.",
    helpText: "Include encryption, access controls, and retention policies",
    sectionKey: "confidentiality",
    applicableWhen: [{ signal: "collects_pii", value: true }],
    answerType: "text",
    branchParentId: "5.2",
  },
  {
    questionId: "5.3",
    cayuseSection: "data_security",
    questionText:
      "Who will have access to the data and/or biological samples?",
    helpText: "List all individuals or roles with data access",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "5.4",
    cayuseSection: "data_security",
    questionText: "Will any data be made available as open access?",
    helpText: "If yes, describe what data and through what mechanism",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "5.5",
    cayuseSection: "data_security",
    questionText: "How will raw data be protected and secured?",
    helpText:
      "Encryption, password protection, locked storage, institutional servers, etc.",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "5.6",
    cayuseSection: "data_security",
    questionText:
      "What will happen to data and/or samples at the end of the study?",
    helpText: "Destruction, de-identification, archival, etc.",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "5.7",
    cayuseSection: "data_security",
    questionText:
      "How will data, results, and conclusions be utilized?",
    helpText: "Publication, presentation, internal report, etc.",
    sectionKey: "confidentiality",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },

  // ── Risks, Benefits & Compensation ──────────────────────────────────
  {
    questionId: "6.1",
    cayuseSection: "risks_benefits",
    questionText:
      "Describe all potential risks, discomforts, or inconveniences to participants (even if minimal), as you would explain them to participants.",
    helpText: "Include physical, psychological, social, economic, and legal risks",
    sectionKey: "risks_benefits",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "6.2",
    cayuseSection: "risks_benefits",
    questionText: "Describe procedures to minimize those risks.",
    helpText: "Specific safeguards, not generic statements",
    sectionKey: "risks_benefits",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "6.3",
    cayuseSection: "risks_benefits",
    questionText:
      "Affirm that risks are reasonable in relation to anticipated benefits.",
    helpText: "Required regulatory determination",
    sectionKey: "risks_benefits",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "6.4",
    cayuseSection: "risks_benefits",
    questionText:
      "Describe anticipated benefits to subjects and/or to the field.",
    helpText: "Distinguish direct benefits to participants from broader societal benefits",
    sectionKey: "risks_benefits",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "6.5",
    cayuseSection: "risks_benefits",
    questionText:
      "Will any of the following risk management approaches be used: medical monitoring, Data Safety Monitoring Board (DSMB), or stopping rules / interim analysis?",
    helpText: "Describe the plan for each approach selected",
    sectionKey: "risks_benefits",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "6.6",
    cayuseSection: "risks_benefits",
    questionText: "Will participants receive compensation?",
    helpText:
      "Compensation above $100 should not be listed explicitly in recruitment materials",
    sectionKey: "risks_benefits",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "6.6.b",
    cayuseSection: "risks_benefits",
    questionText:
      "Describe the type, amount, and timing of compensation.",
    helpText:
      "Use general language in recruitment materials for amounts above $100",
    sectionKey: "risks_benefits",
    applicableWhen: [{ signal: "uses_compensation", value: true }],
    answerType: "text",
    branchParentId: "6.6",
  },

  // ── Affiliations & Conflicts of Interest ────────────────────────────
  {
    questionId: "7.1",
    cayuseSection: "affiliations_coi",
    questionText:
      "Do you have any pre-existing relationships with subjects or institutions involved in this study?",
    helpText:
      "Teacher/student, employer/employee, financial interest, etc.",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "7.1.b",
    cayuseSection: "affiliations_coi",
    questionText:
      "Describe the pre-existing relationship and how it will be managed.",
    helpText:
      "Address potential coercion or undue influence on participants",
    sectionKey: "general",
    applicableWhen: [{ signal: "has_pre_existing_relationships", value: true }],
    answerType: "text",
    branchParentId: "7.1",
  },
  {
    questionId: "7.2",
    cayuseSection: "affiliations_coi",
    questionText:
      "Do you or any family members have a financial or other personal interest in this study?",
    helpText: "Includes equity, consulting fees, royalties, etc.",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "7.2.b",
    cayuseSection: "affiliations_coi",
    questionText:
      "Describe the nature of the financial or personal interest.",
    helpText: "Include how the conflict will be managed",
    sectionKey: "general",
    applicableWhen: [{ signal: "has_financial_interest", value: true }],
    answerType: "text",
    branchParentId: "7.2",
  },
  {
    questionId: "7.3",
    cayuseSection: "affiliations_coi",
    questionText:
      "Could there be a perception of a conflict of interest — for the investigator or for subjects?",
    helpText:
      "Even if no actual conflict exists, perceived conflicts should be addressed",
    sectionKey: "general",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },

  // ── Informed Consent & Assent ───────────────────────────────────────
  {
    questionId: "8.1",
    cayuseSection: "consent_assent",
    questionText:
      "How will you obtain and document informed consent? (written, oral, electronic, waiver)",
    helpText: "Select the method appropriate for your study design",
    sectionKey: "consent_process",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "8.2",
    cayuseSection: "consent_assent",
    questionText:
      "Will any subjects be unable to consent for themselves (e.g., minors, cognitively impaired individuals)?",
    helpText: "If yes, describe how you will obtain parental/guardian consent and assent",
    sectionKey: "consent_process",
    applicableWhen: [],
    answerType: "yes_no",
    branchParentId: null,
  },
  {
    questionId: "8.3",
    cayuseSection: "consent_assent",
    questionText:
      "Describe how you will obtain parental/guardian consent and child/minor assent.",
    helpText:
      "Include the assent process appropriate to the age and maturity of participants",
    sectionKey: "consent_process",
    applicableWhen: [{ signal: "subjects_cannot_self_consent", value: true }],
    answerType: "text",
    branchParentId: "8.2",
  },
  {
    questionId: "8.4",
    cayuseSection: "consent_assent",
    questionText:
      "Select the type of Informed Consent Form (ICF) you will use: standard written consent, short form consent, waiver of documentation of consent, or waiver of consent.",
    helpText:
      "If requesting a waiver, provide justification meeting federal criteria",
    sectionKey: "consent_process",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "8.5",
    cayuseSection: "consent_assent",
    questionText:
      "Which study personnel will be involved in obtaining consent?",
    helpText: "List by name or role",
    sectionKey: "consent_process",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
  {
    questionId: "8.6",
    cayuseSection: "consent_assent",
    questionText:
      "Describe how signed consent forms will be maintained and secured.",
    helpText: "Include storage location, access controls, and retention period",
    sectionKey: "consent_process",
    applicableWhen: [],
    answerType: "text",
    branchParentId: null,
  },
] as const;
