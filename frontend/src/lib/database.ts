import { createClient } from "@/lib/supabase";
import type { Proposal } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function getClient(): SupabaseClient {
  return createClient();
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
      .select("id, institution_id")
      .eq("supabase_uid", user.id)
      .single();
    if (!appUser) throw new Error("User not found");

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
    const { data, error } = await supabase
      .from("review_assignments")
      .select("*, proposals(title)")
      .order("assigned_at", { ascending: false });
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

  async getAuditLog(opts?: { entityType?: string; action?: string; pageSize?: number }) {
    const supabase = getClient();
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts?.pageSize ?? 100);

    if (opts?.entityType && opts.entityType !== "all") {
      query = query.eq("entity_type", opts.entityType);
    }
    if (opts?.action) {
      query = query.ilike("action", `%${opts.action}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getCurrentAppUser() {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("supabase_uid", user.id)
      .single();
    return data;
  },
};
