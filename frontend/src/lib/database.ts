import { createClient } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import type {
  AuditLogEntry,
  InstitutionAiGuidanceRow,
  Letter,
  Proposal,
  RedeemSignupResult,
  ReviewAssignment,
  SignupCodeRow,
  UserRole,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function getClient(): SupabaseClient {
  return createClient();
}

function randomSignupCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "CLG-";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) {
    s += chars[arr[i]! % chars.length];
  }
  return s;
}

export const db = {
  client: getClient,

  async getProposals(opts?: { status?: string; search?: string; pageSize?: number }) {
    const supabase = getClient();
    let query = supabase
      .from("proposals")
      .select("*, users!proposals_pi_user_id_fkey(full_name)")
      .order("updated_at", { ascending: false })
      .limit(opts?.pageSize ?? 20);

    if (opts?.status && opts.status !== "all") {
      query = query.eq("status", opts.status);
    }
    if (opts?.search) {
      query = query.ilike("title", `%${opts.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      pi_name: (p.users as Record<string, string>)?.full_name ?? null,
    })) as Proposal[];
  },

  async getProposal(id: string) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("proposals")
      .select("*, proposal_documents(*), users!proposals_pi_user_id_fkey(full_name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    const docs = ((data.proposal_documents ?? []) as Record<string, unknown>[]).filter(
      (d) => !d.is_deleted,
    );
    return {
      ...data,
      pi_name: (data.users as Record<string, string>)?.full_name ?? null,
      documents: docs,
      document_count: docs.length,
    };
  },

  async createProposal(title: string, formData: Record<string, unknown>) {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const svcClient = getClient();
    const { data: appUser } = await svcClient
      .from("users")
      .select("id, institution_id, role")
      .eq("supabase_uid", user.id)
      .single();
    if (!appUser) throw new Error("User not found");
    if (appUser.role !== "pi") {
      throw new Error("Only principal investigators can create proposals.");
    }

    const { data, error } = await supabase
      .from("proposals")
      .insert({
        title,
        form_data: formData,
        pi_user_id: appUser.id,
        institution_id: appUser.institution_id,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProposal(id: string, updates: Record<string, unknown>) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("proposals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async submitProposal(id: string) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("proposals")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * S3 upload + `proposal_documents` row via Next.js API (session cookie; no Edge Function JWT).
   */
  async getProposalDocumentDownloadUrl(proposalId: string, documentId: string) {
    const res = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/download`, {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      download_url?: string;
      file_name?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || `Download failed (${res.status})`);
    }
    if (!json.download_url) {
      throw new Error("No download URL");
    }
    return {
      download_url: json.download_url,
      file_name: json.file_name ?? "document",
    };
  },

  async presignUploadProposalFile(proposalId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/proposals/${proposalId}/upload-document`, {
      method: "POST",
      body: formData,
    });
    const json = (await res.json().catch(() => ({}))) as {
      document_id?: string;
      s3_key?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || `Upload failed (${res.status})`);
    }
    if (!json.document_id || !json.s3_key) {
      throw new Error("Invalid response from upload");
    }
    return { document_id: json.document_id, s3_key: json.s3_key };
  },

  /** Soft-delete a document row (Edge Function); S3 object remains unless you add lifecycle rules. */
  async deleteProposalDocument(proposalId: string, documentId: string) {
    await invokeEdgeFunction("delete-document", {
      proposal_id: proposalId,
      document_id: documentId,
    });
  },

  async resubmitProposal(id: string) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("proposals")
      .update({ status: "resubmitted", submitted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMessages(proposalId: string) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*, users!messages_sender_user_id_fkey(full_name)")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      sender_name: (m.users as Record<string, string>)?.full_name ?? null,
    }));
  },

  async sendMessage(proposalId: string, body: string, senderUserId: string) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ proposal_id: proposalId, body, sender_user_id: senderUserId })
      .select("*, users!messages_sender_user_id_fkey(full_name)")
      .single();
    if (error) throw error;
    return {
      ...data,
      sender_name: (data.users as Record<string, string>)?.full_name ?? null,
    };
  },

  async getInbox(page = 1, pageSize = 20) {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_inbox", {
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) throw error;
    return data ?? [];
  },

  async getMyAssignments() {
    const supabase = getClient();
    const appUser = await this.getCurrentAppUser();
    let query = supabase
      .from("review_assignments")
      .select("*, proposals(title)")
      .order("assigned_at", { ascending: false });
    if (appUser?.role === "reviewer") {
      query = query.eq("reviewer_user_id", appUser.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async submitReview(
    assignmentId: string,
    decision: string,
    comments: Record<string, string>,
  ) {
    const supabase = getClient();
    const { error: reviewErr } = await supabase
      .from("reviews")
      .insert({ assignment_id: assignmentId, decision, comments });
    if (reviewErr) throw reviewErr;

    const { error: updateErr } = await supabase
      .from("review_assignments")
      .update({ status: "submitted" })
      .eq("id", assignmentId);
    if (updateErr) throw updateErr;
  },

  async getReviews(proposalId: string) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*, review_assignments!inner(proposal_id)")
      .eq("review_assignments.proposal_id", proposalId);
    if (error) throw error;
    return data ?? [];
  },

  async getReviewAssignmentsForProposal(proposalId: string): Promise<ReviewAssignment[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("review_assignments")
      .select("id, proposal_id, reviewer_user_id, status, assigned_at")
      .eq("proposal_id", proposalId)
      .order("assigned_at", { ascending: false });
    if (error) throw error;
    const users = await this.getInstitutionUsers();
    const nameById = new Map(users.map((u) => [u.id, u.full_name]));
    return (data ?? []).map((row) => ({
      ...(row as ReviewAssignment),
      reviewer_name: nameById.get((row as ReviewAssignment).reviewer_user_id) ?? null,
    }));
  },

  async getProposalLetters(proposalId: string): Promise<Letter[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("letters")
      .select(
        "id, proposal_id, type, content, generated_by_ai, sent_at, approval_date, expiration_date, created_at",
      )
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Letter[];
  },

  async getLatestAiSummary(proposalId: string): Promise<Record<string, unknown> | null> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("ai_summaries")
      .select("summary")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const raw = data?.summary;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return null;
  },

  async getInstitutionUsers() {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getInstitution() {
    const supabase = getClient();
    const { data, error } = await supabase.from("institutions").select("*").single();
    if (error) throw error;
    return data;
  },

  /** PI/admin/reviewer: rows for your institution (RLS). Used for the “learn about your institution” page. */
  async getInstitutionGuidance(): Promise<InstitutionAiGuidanceRow[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("institution_ai_guidance")
      .select("*")
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as InstitutionAiGuidanceRow[];
  },

  async getInstitutionGuidanceFileDownload(guidanceId: string) {
    const res = await fetch(`/api/institution-guidance/${guidanceId}/download`, {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      download_url?: string;
      file_name?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || `Download failed (${res.status})`);
    }
    if (!json.download_url) {
      throw new Error("No download URL");
    }
    return {
      download_url: json.download_url,
      file_name: json.file_name ?? "document",
    };
  },

  async getAuditLog(opts?: { entityType?: string; action?: string; pageSize?: number }): Promise<AuditLogEntry[]> {
    const supabase = getClient();
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts?.pageSize ?? 150);

    if (opts?.entityType && opts.entityType !== "all") {
      query = query.eq("entity_type", opts.entityType);
    }
    if (opts?.action) {
      query = query.ilike("action", `%${opts.action}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];

    const userIds = [
      ...new Set(
        rows.map((r) => r.user_id).filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const actorById = new Map<string, { full_name: string | null; email: string }>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const u of users ?? []) {
        const row = u as { id: string; full_name: string | null; email: string };
        actorById.set(row.id, { full_name: row.full_name, email: row.email });
      }
    }

    return rows.map((row) => {
      const rawMeta = row.metadata ?? row.metadata_;
      const metadata_ =
        rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
          ? (rawMeta as Record<string, unknown>)
          : null;
      const uid = typeof row.user_id === "string" ? row.user_id : null;
      return {
        id: row.id as string,
        user_id: uid,
        action: row.action as string,
        entity_type: row.entity_type as string,
        entity_id: typeof row.entity_id === "string" ? row.entity_id : null,
        metadata_,
        created_at: row.created_at as string,
        actor: uid ? actorById.get(uid) ?? null : null,
      };
    });
  },

  async getCurrentAppUser() {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("supabase_uid", user.id)
      .maybeSingle();
    return data;
  },

  async listSignupCodes(): Promise<SignupCodeRow[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("signup_codes")
      .select("id, code, role, max_uses, uses_count, expires_at, label, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SignupCodeRow[];
  },

  async createSignupCode(opts: {
    role: UserRole;
    max_uses?: number | null;
    expires_at?: string | null;
    label?: string | null;
  }): Promise<SignupCodeRow> {
    const supabase = getClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data: appUser, error: appErr } = await supabase
      .from("users")
      .select("id, institution_id")
      .eq("supabase_uid", user.id)
      .single();
    if (appErr || !appUser) throw new Error("User not found in app database");

    const rowBase = {
      institution_id: appUser.institution_id,
      role: opts.role,
      max_uses: opts.max_uses ?? null,
      expires_at: opts.expires_at ?? null,
      label: opts.label ?? null,
      created_by_user_id: appUser.id,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomSignupCode();
      const { data, error } = await supabase
        .from("signup_codes")
        .insert({ ...rowBase, code })
        .select("id, code, role, max_uses, uses_count, expires_at, label, created_at")
        .single();
      if (!error && data) return data as SignupCodeRow;
      if (error.code !== "23505") throw error;
    }
    throw new Error("Could not generate unique code");
  },

  /** Validate signup code via Next API route (server uses anon key only; no Edge Function). */
  async validateSignupCode(code: string) {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
    const res = await fetch(`${origin}/api/validate-signup-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    return (await res.json()) as {
      valid: boolean;
      error?: string;
      role?: string;
      label?: string | null;
      institution_name?: string;
    };
  },

  /** Link the signed-in Supabase user to an institution via signup code (RPC). */
  async redeemSignupCode(code: string, fullName: string): Promise<RedeemSignupResult> {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("redeem_signup_code", {
      p_code: code.trim(),
      p_full_name: fullName.trim(),
    });
    if (error) throw error;
    return data as RedeemSignupResult;
  },
};
