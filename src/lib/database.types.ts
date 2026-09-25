export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_secrets: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          branch_id: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          payload: Json
          reason: string | null
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_table: string
          type: Database["public"]["Enums"]["approval_type"]
        }
        Insert: {
          branch_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_table: string
          type: Database["public"]["Enums"]["approval_type"]
        }
        Update: {
          branch_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          subject_id?: string
          subject_table?: string
          type?: Database["public"]["Enums"]["approval_type"]
        }
        Relationships: [
          {
            foreignKeyName: "approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          branch_id: string | null
          id: number
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          branch_id?: string | null
          id?: number
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          branch_id?: string | null
          id?: number
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          body_fat_pct: number | null
          client_id: string
          id: string
          measured_at: string
          measurements: Json
          source: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          client_id: string
          id?: string
          measured_at?: string
          measurements?: Json
          source?: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          client_id?: string
          id?: string
          measured_at?: string
          measurements?: Json
          source?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_hours: Json
          phone: string | null
          settings_override: Json
          timezone: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          opening_hours?: Json
          phone?: string | null
          settings_override?: Json
          timezone?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_hours?: Json
          phone?: string | null
          settings_override?: Json
          timezone?: string
        }
        Relationships: []
      }
      bundle_items: {
        Row: {
          bundle_product_id: string
          product_id: string
          qty: number
        }
        Insert: {
          bundle_product_id: string
          product_id: string
          qty?: number
        }
        Update: {
          bundle_product_id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_product_id_fkey"
            columns: ["bundle_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_membership_id: string
          body: string
          client_id: string
          created_at: string
          id: string
          visibility: Database["public"]["Enums"]["note_visibility"]
        }
        Insert: {
          author_membership_id: string
          body: string
          client_id: string
          created_at?: string
          id?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Update: {
          author_membership_id?: string
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "client_notes_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
        ]
      }
      clients: {
        Row: {
          coach_membership_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          home_branch_id: string
          id: string
          injuries: string | null
          instagram_handle: string | null
          joined_at: string
          last_visit_at: string | null
          lead_id: string | null
          nutritionist_membership_id: string | null
          onboarding_responses: Json
          phone: string
          profile_id: string | null
          rep_membership_id: string | null
          risk_reasons: Json
          risk_score: number
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          coach_membership_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          home_branch_id: string
          id?: string
          injuries?: string | null
          instagram_handle?: string | null
          joined_at?: string
          last_visit_at?: string | null
          lead_id?: string | null
          nutritionist_membership_id?: string | null
          onboarding_responses?: Json
          phone: string
          profile_id?: string | null
          rep_membership_id?: string | null
          risk_reasons?: Json
          risk_score?: number
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          coach_membership_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          home_branch_id?: string
          id?: string
          injuries?: string | null
          instagram_handle?: string | null
          joined_at?: string
          last_visit_at?: string | null
          lead_id?: string | null
          nutritionist_membership_id?: string | null
          onboarding_responses?: Json
          phone?: string
          profile_id?: string | null
          rep_membership_id?: string | null
          risk_reasons?: Json
          risk_score?: number
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["home_branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_nutritionist_membership_id_fkey"
            columns: ["nutritionist_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_nutritionist_membership_id_fkey"
            columns: ["nutritionist_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_nutritionist_membership_id_fkey"
            columns: ["nutritionist_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_rep_membership_id_fkey"
            columns: ["rep_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_rep_membership_id_fkey"
            columns: ["rep_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_rep_membership_id_fkey"
            columns: ["rep_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      coach_assignments: {
        Row: {
          assigned_by: string | null
          client_id: string
          coach_membership_id: string
          end_reason: string | null
          ended_at: string | null
          id: string
          reason: string | null
          started_at: string
        }
        Insert: {
          assigned_by?: string | null
          client_id: string
          coach_membership_id: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
        }
        Update: {
          assigned_by?: string | null
          client_id?: string
          coach_membership_id?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "coach_assignments_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "coach_assignments_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          end_time: string
          id: string
          membership_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          membership_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          membership_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "coach_availability_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["credit_entry_type"]
          id: number
          lot_id: string | null
          qty: number
          reason: string | null
          session_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          entry_type: Database["public"]["Enums"]["credit_entry_type"]
          id?: number
          lot_id?: string | null
          qty: number
          reason?: string | null
          session_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          entry_type?: Database["public"]["Enums"]["credit_entry_type"]
          id?: number
          lot_id?: string | null
          qty?: number
          reason?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "credit_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_lots: {
        Row: {
          client_id: string
          coach_membership_id: string
          created_at: string
          deal_item_id: string | null
          expires_at: string
          id: string
          issued_at: string
          net_per_session_value_piastres: number
          per_session_value_piastres: number
          qty_issued: number
          qty_remaining: number
          status: Database["public"]["Enums"]["lot_status"]
          tax_pct: number
        }
        Insert: {
          client_id: string
          coach_membership_id: string
          created_at?: string
          deal_item_id?: string | null
          expires_at: string
          id?: string
          issued_at?: string
          net_per_session_value_piastres?: number
          per_session_value_piastres?: number
          qty_issued: number
          qty_remaining: number
          status?: Database["public"]["Enums"]["lot_status"]
          tax_pct?: number
        }
        Update: {
          client_id?: string
          coach_membership_id?: string
          created_at?: string
          deal_item_id?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          net_per_session_value_piastres?: number
          per_session_value_piastres?: number
          qty_issued?: number
          qty_remaining?: number
          status?: Database["public"]["Enums"]["lot_status"]
          tax_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "credit_lots_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "credit_lots_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "credit_lots_deal_item_id_fkey"
            columns: ["deal_item_id"]
            isOneToOne: false
            referencedRelation: "deal_items"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_items: {
        Row: {
          created_at: string
          credits_issued: number
          deal_id: string
          duration_days: number | null
          expiry_days: number | null
          id: string
          line_total_piastres: number
          product_id: string
          product_type: Database["public"]["Enums"]["product_type"] | null
          provider_membership_id: string | null
          qty: number
          session_count: number | null
          unit_price_piastres: number
        }
        Insert: {
          created_at?: string
          credits_issued?: number
          deal_id: string
          duration_days?: number | null
          expiry_days?: number | null
          id?: string
          line_total_piastres?: number
          product_id: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          provider_membership_id?: string | null
          qty?: number
          session_count?: number | null
          unit_price_piastres?: number
        }
        Update: {
          created_at?: string
          credits_issued?: number
          deal_id?: string
          duration_days?: number | null
          expiry_days?: number | null
          id?: string
          line_total_piastres?: number
          product_id?: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          provider_membership_id?: string | null
          qty?: number
          session_count?: number | null
          unit_price_piastres?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_provider_membership_id_fkey"
            columns: ["provider_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_provider_membership_id_fkey"
            columns: ["provider_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "deal_items_provider_membership_id_fkey"
            columns: ["provider_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      deals: {
        Row: {
          approval_id: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          client_id: string | null
          closer_membership_id: string | null
          created_at: string
          created_by: string | null
          discount_fixed_piastres: number
          discount_pct: number
          discount_piastres: number
          first_paid_at: string | null
          id: string
          installments_count: number
          is_renewal: boolean
          lead_id: string | null
          notes: string | null
          paid_at: string | null
          paid_piastres: number
          payment_plan: Database["public"]["Enums"]["payment_plan"]
          rep_membership_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          subtotal_piastres: number
          total_piastres: number
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          client_id?: string | null
          closer_membership_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_fixed_piastres?: number
          discount_pct?: number
          discount_piastres?: number
          first_paid_at?: string | null
          id?: string
          installments_count?: number
          is_renewal?: boolean
          lead_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_piastres?: number
          payment_plan?: Database["public"]["Enums"]["payment_plan"]
          rep_membership_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          subtotal_piastres?: number
          total_piastres?: number
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          client_id?: string | null
          closer_membership_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_fixed_piastres?: number
          discount_pct?: number
          discount_piastres?: number
          first_paid_at?: string | null
          id?: string
          installments_count?: number
          is_renewal?: boolean
          lead_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_piastres?: number
          payment_plan?: Database["public"]["Enums"]["payment_plan"]
          rep_membership_id?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          subtotal_piastres?: number
          total_piastres?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "deals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "deals_closer_membership_id_fkey"
            columns: ["closer_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_closer_membership_id_fkey"
            columns: ["closer_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "deals_closer_membership_id_fkey"
            columns: ["closer_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_rep_membership_id_fkey"
            columns: ["rep_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_rep_membership_id_fkey"
            columns: ["rep_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "deals_rep_membership_id_fkey"
            columns: ["rep_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      entitlements: {
        Row: {
          client_id: string
          created_at: string
          deal_item_id: string | null
          ends_at: string
          id: string
          product_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["entitlement_status"]
          type: Database["public"]["Enums"]["entitlement_type"]
        }
        Insert: {
          client_id: string
          created_at?: string
          deal_item_id?: string | null
          ends_at: string
          id?: string
          product_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["entitlement_status"]
          type: Database["public"]["Enums"]["entitlement_type"]
        }
        Update: {
          client_id?: string
          created_at?: string
          deal_item_id?: string | null
          ends_at?: string
          id?: string
          product_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["entitlement_status"]
          type?: Database["public"]["Enums"]["entitlement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "entitlements_deal_item_id_fkey"
            columns: ["deal_item_id"]
            isOneToOne: false
            referencedRelation: "deal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_profile_id: string | null
          branch_id: string | null
          id: number
          occurred_at: string
          payload: Json
          subject_id: string | null
          subject_table: string | null
          type: string
        }
        Insert: {
          actor_profile_id?: string | null
          branch_id?: string | null
          id?: number
          occurred_at?: string
          payload?: Json
          subject_id?: string | null
          subject_table?: string | null
          type: string
        }
        Update: {
          actor_profile_id?: string | null
          branch_id?: string | null
          id?: number
          occurred_at?: string
          payload?: Json
          subject_id?: string | null
          subject_table?: string | null
          type?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          cues: string | null
          equipment: string | null
          id: string
          is_active: boolean
          movement_pattern: string | null
          muscle_group: string | null
          name: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cues?: string | null
          equipment?: string | null
          id?: string
          is_active?: boolean
          movement_pattern?: string | null
          muscle_group?: string | null
          name: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cues?: string | null
          equipment?: string | null
          id?: string
          is_active?: boolean
          movement_pattern?: string | null
          muscle_group?: string | null
          name?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_to_membership_id: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          lead_id: string | null
          status: Database["public"]["Enums"]["follow_up_status"]
          title: string
        }
        Insert: {
          assigned_to_membership_id: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at: string
          id?: string
          lead_id?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          title: string
        }
        Update: {
          assigned_to_membership_id?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          lead_id?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_to_membership_id_fkey"
            columns: ["assigned_to_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_assigned_to_membership_id_fkey"
            columns: ["assigned_to_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "follow_ups_assigned_to_membership_id_fkey"
            columns: ["assigned_to_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      freezes: {
        Row: {
          approval_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          days: number | null
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          status: Database["public"]["Enums"]["freeze_status"]
        }
        Insert: {
          approval_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          days?: number | null
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["freeze_status"]
        }
        Update: {
          approval_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          days?: number | null
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["freeze_status"]
        }
        Relationships: [
          {
            foreignKeyName: "freezes_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freezes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freezes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "freezes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          branch_id: string
          consent_content: boolean | null
          consent_marketing: boolean | null
          converted_client_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_contact_at: string | null
          first_contact_due_at: string | null
          full_name: string
          id: string
          instagram_handle: string | null
          interest_tags: string[]
          lost_note: string | null
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          onboarding_completed_at: string | null
          onboarding_responses: Json
          onboarding_schema_version: number | null
          onboarding_token: string | null
          onboarding_token_expires_at: string | null
          owner_membership_id: string | null
          phone: string
          referred_by_client_id: string | null
          review_note: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          consent_content?: boolean | null
          consent_marketing?: boolean | null
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_contact_at?: string | null
          first_contact_due_at?: string | null
          full_name: string
          id?: string
          instagram_handle?: string | null
          interest_tags?: string[]
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["lost_reason"] | null
          onboarding_completed_at?: string | null
          onboarding_responses?: Json
          onboarding_schema_version?: number | null
          onboarding_token?: string | null
          onboarding_token_expires_at?: string | null
          owner_membership_id?: string | null
          phone: string
          referred_by_client_id?: string | null
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          consent_content?: boolean | null
          consent_marketing?: boolean | null
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_contact_at?: string | null
          first_contact_due_at?: string | null
          full_name?: string
          id?: string
          instagram_handle?: string | null
          interest_tags?: string[]
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["lost_reason"] | null
          onboarding_completed_at?: string | null
          onboarding_responses?: Json
          onboarding_schema_version?: number | null
          onboarding_token?: string | null
          onboarding_token_expires_at?: string | null
          owner_membership_id?: string | null
          phone?: string
          referred_by_client_id?: string | null
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "leads_converted_client_fk"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_fk"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "leads_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "leads_referred_by_fk"
            columns: ["referred_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_fk"
            columns: ["referred_by_client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string | null
          capacity: number | null
          created_at: string
          discount_allowance_pct: number
          id: string
          is_active: boolean
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          rotation_paused: boolean
          specialties: string[]
        }
        Insert: {
          branch_id?: string | null
          capacity?: number | null
          created_at?: string
          discount_allowance_pct?: number
          id?: string
          is_active?: boolean
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          rotation_paused?: boolean
          specialties?: string[]
        }
        Update: {
          branch_id?: string | null
          capacity?: number | null
          created_at?: string
          discount_allowance_pct?: number
          id?: string
          is_active?: boolean
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          rotation_paused?: boolean
          specialties?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          client_id: string | null
          created_at: string
          data: Json
          error: string | null
          id: string
          read_at: string | null
          recipient_profile_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          client_id?: string | null
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          read_at?: string | null
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          type: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          client_id?: string | null
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          read_at?: string | null
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plans: {
        Row: {
          client_id: string
          created_at: string
          ends_at: string | null
          file_url: string | null
          id: string
          notes: string | null
          owner_membership_id: string | null
          starts_at: string | null
          status: string
          targets: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          ends_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          owner_membership_id?: string | null
          starts_at?: string | null
          status?: string
          targets?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          ends_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          owner_membership_id?: string | null
          starts_at?: string | null
          status?: string
          targets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "nutrition_plans_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plans_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "nutrition_plans_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_piastres: number
          created_at: string
          deal_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          received_at: string
          recorded_by: string
          reference: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_piastres: number
          created_at?: string
          deal_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          recorded_by: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_piastres?: number
          created_at?: string
          deal_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          recorded_by?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          duration_days: number | null
          expiry_days: number | null
          id: string
          is_active: boolean
          name: string
          per_session_value_piastres: number | null
          price_piastres: number
          session_count: number | null
          session_minutes: number
          sort_order: number
          type: Database["public"]["Enums"]["product_type"]
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          duration_days?: number | null
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          name: string
          per_session_value_piastres?: number | null
          price_piastres: number
          session_count?: number | null
          session_minutes?: number
          sort_order?: number
          type: Database["public"]["Enums"]["product_type"]
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          duration_days?: number | null
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          name?: string
          per_session_value_piastres?: number | null
          price_piastres?: number
          session_count?: number | null
          session_minutes?: number
          sort_order?: number
          type?: Database["public"]["Enums"]["product_type"]
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          is_active: boolean
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_days: {
        Row: {
          day_index: number
          id: string
          name: string
          program_id: string
        }
        Insert: {
          day_index: number
          id?: string
          name: string
          program_id: string
        }
        Update: {
          day_index?: number
          id?: string
          name?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          order_index: number
          program_day_id: string
          reps: string
          rest_seconds: number | null
          sets: number
          superset_group: string | null
          target_weight_kg: number | null
          tempo: string | null
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          order_index: number
          program_day_id: string
          reps?: string
          rest_seconds?: number | null
          sets?: number
          superset_group?: string | null
          target_weight_kg?: number | null
          tempo?: string | null
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          order_index?: number
          program_day_id?: string
          reps?: string
          rest_seconds?: number | null
          sets?: number
          superset_group?: string | null
          target_weight_kg?: number | null
          tempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_exercises_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      program_templates: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          name: string
          owner_membership_id: string | null
          structure: Json
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name: string
          owner_membership_id?: string | null
          structure?: Json
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_membership_id?: string | null
          structure?: Json
        }
        Relationships: [
          {
            foreignKeyName: "program_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "program_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "program_templates_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_templates_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "program_templates_owner_membership_id_fkey"
            columns: ["owner_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      programs: {
        Row: {
          client_id: string
          coach_membership_id: string
          created_at: string
          ends_at: string | null
          goal: string | null
          id: string
          name: string
          starts_at: string | null
          status: Database["public"]["Enums"]["program_status"]
          updated_at: string
          weeks: number
        }
        Insert: {
          client_id: string
          coach_membership_id: string
          created_at?: string
          ends_at?: string | null
          goal?: string | null
          id?: string
          name: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
          weeks?: number
        }
        Update: {
          client_id?: string
          coach_membership_id?: string
          created_at?: string
          ends_at?: string | null
          goal?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["program_status"]
          updated_at?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "programs_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "programs_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      round_robin_state: {
        Row: {
          branch_id: string
          last_membership_id: string | null
        }
        Insert: {
          branch_id: string
          last_membership_id?: string | null
        }
        Update: {
          branch_id?: string
          last_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_state_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_state_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "round_robin_state_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "round_robin_state_last_membership_id_fkey"
            columns: ["last_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_state_last_membership_id_fkey"
            columns: ["last_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "round_robin_state_last_membership_id_fkey"
            columns: ["last_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
        ]
      }
      schedule_skips: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          skip_date: string
          slot_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          skip_date: string
          slot_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          skip_date?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_skips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_skips_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          branch_id: string
          client_id: string | null
          coach_membership_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          ends_on: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["slot_kind"]
          label: string | null
          start_time: string
          starts_on: string
          updated_at: string
          weekday: number
        }
        Insert: {
          branch_id: string
          client_id?: string | null
          coach_membership_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["slot_kind"]
          label?: string | null
          start_time: string
          starts_on?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          branch_id?: string
          client_id?: string | null
          coach_membership_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["slot_kind"]
          label?: string | null
          start_time?: string
          starts_on?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedule_slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "schedule_slots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "schedule_slots_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "schedule_slots_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "schedule_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          branch_id: string
          cancel_reason: string | null
          client_id: string
          coach_membership_id: string
          created_at: string
          created_by: string | null
          credit_consumed: boolean
          duration_minutes: number
          id: string
          is_walk_in: boolean
          lot_id: string | null
          notes: string | null
          outcome_recorded_at: string | null
          outcome_recorded_by: string | null
          scheduled_at: string
          settled_at: string | null
          slot_id: string | null
          status: Database["public"]["Enums"]["session_status"]
          unpaid: boolean
          updated_at: string
          waive_reason: string | null
          waived: boolean
        }
        Insert: {
          branch_id: string
          cancel_reason?: string | null
          client_id: string
          coach_membership_id: string
          created_at?: string
          created_by?: string | null
          credit_consumed?: boolean
          duration_minutes?: number
          id?: string
          is_walk_in?: boolean
          lot_id?: string | null
          notes?: string | null
          outcome_recorded_at?: string | null
          outcome_recorded_by?: string | null
          scheduled_at: string
          settled_at?: string | null
          slot_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          unpaid?: boolean
          updated_at?: string
          waive_reason?: string | null
          waived?: boolean
        }
        Update: {
          branch_id?: string
          cancel_reason?: string | null
          client_id?: string
          coach_membership_id?: string
          created_at?: string
          created_by?: string | null
          credit_consumed?: boolean
          duration_minutes?: number
          id?: string
          is_walk_in?: boolean
          lot_id?: string | null
          notes?: string | null
          outcome_recorded_at?: string | null
          outcome_recorded_by?: string | null
          scheduled_at?: string
          settled_at?: string | null
          slot_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          unpaid?: boolean
          updated_at?: string
          waive_reason?: string | null
          waived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sessions_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "sessions_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_outcome_recorded_by_fkey"
            columns: ["outcome_recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          exercise_id: string
          id: string
          is_pr: boolean
          program_exercise_id: string | null
          reps: number | null
          rpe: number | null
          set_index: number
          weight_kg: number | null
          workout_log_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          is_pr?: boolean
          program_exercise_id?: string | null
          reps?: number | null
          rpe?: number | null
          set_index: number
          weight_kg?: number | null
          workout_log_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          is_pr?: boolean
          program_exercise_id?: string | null
          reps?: number | null
          rpe?: number | null
          set_index?: number
          weight_kg?: number | null
          workout_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_program_exercise_id_fkey"
            columns: ["program_exercise_id"]
            isOneToOne: false
            referencedRelation: "program_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          created_by: string | null
          id: string
          metric: string
          period: string
          scope_id: string
          scope_type: Database["public"]["Enums"]["target_scope"]
          value: number
        }
        Insert: {
          created_by?: string | null
          id?: string
          metric: string
          period: string
          scope_id: string
          scope_type: Database["public"]["Enums"]["target_scope"]
          value: number
        }
        Update: {
          created_by?: string | null
          id?: string
          metric?: string
          period?: string
          scope_id?: string
          scope_type?: Database["public"]["Enums"]["target_scope"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      touches: {
        Row: {
          by_profile_id: string
          client_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["touch_direction"]
          id: string
          lead_id: string | null
          note: string | null
          occurred_at: string
          type: Database["public"]["Enums"]["touch_type"]
        }
        Insert: {
          by_profile_id: string
          client_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["touch_direction"]
          id?: string
          lead_id?: string | null
          note?: string | null
          occurred_at?: string
          type: Database["public"]["Enums"]["touch_type"]
        }
        Update: {
          by_profile_id?: string
          client_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["touch_direction"]
          id?: string
          lead_id?: string | null
          note?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["touch_type"]
        }
        Relationships: [
          {
            foreignKeyName: "touches_by_profile_id_fkey"
            columns: ["by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "touches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          branch_id: string
          checked_in_at: string
          client_id: string
          id: string
          method: Database["public"]["Enums"]["visit_method"]
          recorded_by: string | null
        }
        Insert: {
          branch_id: string
          checked_in_at?: string
          client_id: string
          id?: string
          method: Database["public"]["Enums"]["visit_method"]
          recorded_by?: string | null
        }
        Update: {
          branch_id?: string
          checked_in_at?: string
          client_id?: string
          id?: string
          method?: Database["public"]["Enums"]["visit_method"]
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "visits_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          client_id: string
          duration_minutes: number | null
          id: string
          notes: string | null
          performed_at: string
          program_day_id: string | null
          session_id: string | null
          synced_at: string
        }
        Insert: {
          client_id: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          performed_at?: string
          program_day_id?: string | null
          session_id?: string | null
          synced_at?: string
        }
        Update: {
          client_id?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          performed_at?: string
          program_day_id?: string | null
          session_id?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mv_client_adherence"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "workout_logs_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_client_adherence: {
        Row: {
          adherence_pct: number | null
          branch_id: string | null
          cancelled_30d: number | null
          client_id: string | null
          coach_membership_id: string | null
          completed_30d: number | null
          credits_left: number | null
          credits_left_with_coach: number | null
          full_name: string | null
          last_visit_at: string | null
          next_expiry: string | null
          no_shows_30d: number | null
          risk_score: number | null
          scheduled_30d: number | null
          status: Database["public"]["Enums"]["client_status"] | null
          unpaid_sessions: number | null
          workouts_logged_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      mv_coach_month: {
        Row: {
          active_clients_now: number | null
          branch_id: string | null
          cancelled: number | null
          clients_ended: number | null
          clients_renewed: number | null
          clients_seen: number | null
          commission_pct: number | null
          commission_piastres: number | null
          credits_burned: number | null
          full_name: string | null
          membership_id: string | null
          month: string | null
          no_show_pct: number | null
          no_shows: number | null
          renewals_count: number | null
          renewals_revenue: number | null
          retention_pct: number | null
          revenue_delivered: number | null
          revenue_delivered_net: number | null
          sessions_completed: number | null
          unpaid_sessions: number | null
          utilization_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      mv_daily_branch: {
        Row: {
          branch_id: string | null
          cancelled: number | null
          clients_lapsed: number | null
          credits_burned: number | null
          day: string | null
          deals_won: number | null
          leads: number | null
          month: string | null
          new_clients: number | null
          no_shows: number | null
          revenue_booked: number | null
          revenue_collected: number | null
          revenue_delivered: number | null
          sessions_completed: number | null
          unique_visitors: number | null
          unpaid_sessions: number | null
          visits: number | null
          week_start: string | null
        }
        Relationships: []
      }
      mv_heatmap: {
        Row: {
          branch_id: string | null
          dow: number | null
          hr: number | null
          sessions: number | null
          visits: number | null
        }
        Relationships: []
      }
      mv_liability: {
        Row: {
          branch_id: string | null
          clients: number | null
          coach_membership_id: string | null
          credits_expiring_30d: number | null
          credits_remaining: number | null
          liability_piastres: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_coach_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_coach_membership_id_fkey"
            columns: ["coach_membership_id"]
            isOneToOne: false
            referencedRelation: "mv_rep_month"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      mv_rep_month: {
        Row: {
          avg_discount_pct: number | null
          branch_id: string | null
          commission_piastres: number | null
          contacted: number | null
          conversion_pct: number | null
          deals_paid: number | null
          full_name: string | null
          leads: number | null
          lost: number | null
          median_response_min: number | null
          membership_collected: number | null
          membership_id: string | null
          month: string | null
          nutrition_collected: number | null
          onboarded: number | null
          overdue_follow_ups_now: number | null
          pt_collected: number | null
          quoted: number | null
          sla_breaches: number | null
          won: number | null
          won_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      mv_retention_cohort: {
        Row: {
          active_m1: number | null
          active_m2: number | null
          active_m3: number | null
          active_m6: number | null
          branch_id: string | null
          cohort_size: number | null
          join_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "clients_home_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      mv_source_roi: {
        Row: {
          branch_id: string | null
          leads: number | null
          month: string | null
          source: string | null
          won: number | null
          won_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_daily_branch"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mv_heatmap"
            referencedColumns: ["branch_id"]
          },
        ]
      }
    }
    Functions: {
      cairo_date: { Args: { t: string }; Returns: string }
      cairo_dow: { Args: { t: string }; Returns: number }
      cairo_hour: { Args: { t: string }; Returns: number }
      fn_activate_program: { Args: { p_program_id: string }; Returns: Json }
      fn_add_client_note: {
        Args: {
          p_body: string
          p_client: string
          p_visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Returns: string
      }
      fn_add_follow_up: {
        Args: {
          p_assignee?: string
          p_client_id: string
          p_due_at: string
          p_lead_id: string
          p_title: string
        }
        Returns: string
      }
      fn_add_session: {
        Args: {
          p_client_id: string
          p_coach_membership_id: string
          p_duration?: number
          p_notes?: string
          p_scheduled_at: string
        }
        Returns: string
      }
      fn_add_weekly_slots: {
        Args: {
          p_client_id?: string
          p_coach: string
          p_duration?: number
          p_kind?: Database["public"]["Enums"]["slot_kind"]
          p_label?: string
          p_start_time: string
          p_starts_on?: string
          p_weekdays: number[]
        }
        Returns: string[]
      }
      fn_apply_attendance: {
        Args: {
          p_outcome: Database["public"]["Enums"]["session_status"]
          p_session_id: string
          p_via_approval?: boolean
          p_waive: boolean
          p_waive_reason: string
        }
        Returns: undefined
      }
      fn_apply_expiry_extension: {
        Args: { p_lot_id: string; p_new_expires_at: string; p_reason: string }
        Returns: undefined
      }
      fn_assign_coach: {
        Args: {
          p_client_id: string
          p_coach_membership_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      fn_assign_lead: {
        Args: { p_lead_id: string; p_membership_id?: string; p_reason?: string }
        Returns: string
      }
      fn_branch_coaches: {
        Args: { p_branch_id: string }
        Returns: {
          active_clients: number
          capacity: number
          full_name: string
          gender: string
          membership_id: string
          specialties: string[]
        }[]
      }
      fn_can_coach_client: { Args: { p_client: string }; Returns: boolean }
      fn_can_edit_coach: { Args: { p_coach: string }; Returns: boolean }
      fn_can_edit_deal: {
        Args: { p_deal: Database["public"]["Tables"]["deals"]["Row"] }
        Returns: boolean
      }
      fn_can_pay_deal: {
        Args: { p_deal: Database["public"]["Tables"]["deals"]["Row"] }
        Returns: boolean
      }
      fn_can_see_coach: { Args: { p_coach: string }; Returns: boolean }
      fn_can_see_deal: { Args: { p_deal_id: string }; Returns: boolean }
      fn_can_see_lead: { Args: { p_lead_id: string }; Returns: boolean }
      fn_cancel_deal: {
        Args: { p_deal_id: string; p_reason: string }
        Returns: undefined
      }
      fn_cancel_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: undefined
      }
      fn_check_in: {
        Args: {
          p_branch_id: string
          p_client_id: string
          p_method?: Database["public"]["Enums"]["visit_method"]
        }
        Returns: Json
      }
      fn_client_check_in: {
        Args: { p_branch?: string; p_code?: string }
        Returns: Json
      }
      fn_client_credits: { Args: never; Returns: Json }
      fn_client_home: { Args: never; Returns: Json }
      fn_client_progress: { Args: { p_exercise?: string }; Returns: Json }
      fn_client_training: { Args: never; Returns: Json }
      fn_coach_client: { Args: { p_client: string }; Returns: Json }
      fn_coach_clients: {
        Args: { p_coach: string }
        Returns: {
          adherence_pct: number
          at_risk: boolean
          client_id: string
          completed_30d: number
          credits_left: number
          full_name: string
          injuries: string
          last_visit_at: string
          next_expiry: string
          no_shows_30d: number
          risk_score: number
          scheduled_30d: number
          status: Database["public"]["Enums"]["client_status"]
          unpaid_sessions: number
          weekly_slots: number
        }[]
      }
      fn_coach_day: {
        Args: { p_coach_membership_id: string; p_date?: string }
        Returns: {
          client_id: string
          client_name: string
          credits_left: number
          duration_minutes: number
          injuries: string
          item_id: string
          kind: string
          label: string
          starts_at: string
          status: Database["public"]["Enums"]["session_status"]
          unpaid: boolean
        }[]
      }
      fn_coach_team: {
        Args: { p_branch: string; p_month: string }
        Returns: Json
      }
      fn_coach_today: {
        Args: { p_coach: string; p_date?: string }
        Returns: Json
      }
      fn_coach_week: {
        Args: { p_coach: string; p_week_start: string }
        Returns: Json
      }
      fn_commission_report: {
        Args: { p_branch_id?: string; p_month: string }
        Returns: Json
      }
      fn_complete_follow_up: {
        Args: {
          p_follow_up_id: string
          p_status?: Database["public"]["Enums"]["follow_up_status"]
        }
        Returns: undefined
      }
      fn_compute_risk_scores: { Args: never; Returns: number }
      fn_consume_credit: {
        Args: { p_client_id: string; p_reason: string; p_session_id: string }
        Returns: string
      }
      fn_convert_lead: {
        Args: { p_deal_id: string; p_lead_id: string }
        Returns: string
      }
      fn_create_deal: {
        Args: { p_client_id?: string; p_lead_id?: string }
        Returns: string
      }
      fn_create_lead: {
        Args: {
          p_branch_id: string
          p_email?: string
          p_full_name: string
          p_interest_tags?: string[]
          p_note?: string
          p_phone: string
          p_referred_by_client_id?: string
          p_source_code?: string
        }
        Returns: Json
      }
      fn_create_staff_profile: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_profile_id: string
        }
        Returns: string
      }
      fn_credit_balance: {
        Args: { p_client_id: string; p_coach_membership_id?: string }
        Returns: number
      }
      fn_credit_balances: {
        Args: { p_client_id: string }
        Returns: {
          balance: number
          coach_membership_id: string
          coach_name: string
          next_expiry: string
        }[]
      }
      fn_dashboard_adherence: {
        Args: { p_coach_membership_id?: string }
        Returns: {
          adherence_pct: number | null
          branch_id: string | null
          cancelled_30d: number | null
          client_id: string | null
          coach_membership_id: string | null
          completed_30d: number | null
          credits_left: number | null
          credits_left_with_coach: number | null
          full_name: string | null
          last_visit_at: string | null
          next_expiry: string | null
          no_shows_30d: number | null
          risk_score: number | null
          scheduled_30d: number | null
          status: Database["public"]["Enums"]["client_status"] | null
          unpaid_sessions: number | null
          workouts_logged_30d: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_client_adherence"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_coaches: {
        Args: { p_month: string }
        Returns: {
          active_clients_now: number | null
          branch_id: string | null
          cancelled: number | null
          clients_ended: number | null
          clients_renewed: number | null
          clients_seen: number | null
          commission_pct: number | null
          commission_piastres: number | null
          credits_burned: number | null
          full_name: string | null
          membership_id: string | null
          month: string | null
          no_show_pct: number | null
          no_shows: number | null
          renewals_count: number | null
          renewals_revenue: number | null
          retention_pct: number | null
          revenue_delivered: number | null
          revenue_delivered_net: number | null
          sessions_completed: number | null
          unpaid_sessions: number | null
          utilization_pct: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_coach_month"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_daily: {
        Args: { p_from: string; p_to: string }
        Returns: {
          branch_id: string | null
          cancelled: number | null
          clients_lapsed: number | null
          credits_burned: number | null
          day: string | null
          deals_won: number | null
          leads: number | null
          month: string | null
          new_clients: number | null
          no_shows: number | null
          revenue_booked: number | null
          revenue_collected: number | null
          revenue_delivered: number | null
          sessions_completed: number | null
          unique_visitors: number | null
          unpaid_sessions: number | null
          visits: number | null
          week_start: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_daily_branch"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_heatmap: {
        Args: never
        Returns: {
          branch_id: string | null
          dow: number | null
          hr: number | null
          sessions: number | null
          visits: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_heatmap"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_liability: {
        Args: never
        Returns: {
          branch_id: string | null
          clients: number | null
          coach_membership_id: string | null
          credits_expiring_30d: number | null
          credits_remaining: number | null
          liability_piastres: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_liability"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_reps: {
        Args: { p_month: string }
        Returns: {
          avg_discount_pct: number | null
          branch_id: string | null
          commission_piastres: number | null
          contacted: number | null
          conversion_pct: number | null
          deals_paid: number | null
          full_name: string | null
          leads: number | null
          lost: number | null
          median_response_min: number | null
          membership_collected: number | null
          membership_id: string | null
          month: string | null
          nutrition_collected: number | null
          onboarded: number | null
          overdue_follow_ups_now: number | null
          pt_collected: number | null
          quoted: number | null
          sla_breaches: number | null
          won: number | null
          won_revenue: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_rep_month"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_retention: {
        Args: never
        Returns: {
          active_m1: number | null
          active_m2: number | null
          active_m3: number | null
          active_m6: number | null
          branch_id: string | null
          cohort_size: number | null
          join_month: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_retention_cohort"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_dashboard_sources: {
        Args: { p_month: string }
        Returns: {
          branch_id: string | null
          leads: number | null
          month: string | null
          source: string | null
          won: number | null
          won_revenue: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_source_roi"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_deal: { Args: { p_deal_id: string }; Returns: Json }
      fn_deal_approval_preview: { Args: { p_deal_id: string }; Returns: Json }
      fn_deal_catalog: {
        Args: { p_branch_id: string }
        Returns: {
          branch_id: string
          code: string
          duration_days: number
          expiry_days: number
          id: string
          name: string
          net_per_session_piastres: number
          per_session_piastres: number
          price_piastres: number
          session_count: number
          sort_order: number
          type: Database["public"]["Enums"]["product_type"]
        }[]
      }
      fn_decide_approval: {
        Args: { p_approval_id: string; p_approve: boolean; p_note?: string }
        Returns: undefined
      }
      fn_e1rm: { Args: { p_reps: number; p_weight: number }; Returns: number }
      fn_emit_event: {
        Args: {
          p_branch_id: string
          p_payload?: Json
          p_subject_id: string
          p_subject_table: string
          p_type: string
        }
        Returns: number
      }
      fn_end_freeze: { Args: { p_freeze_id: string }; Returns: undefined }
      fn_end_schedule_slot: {
        Args: { p_ends_on?: string; p_slot_id: string }
        Returns: undefined
      }
      fn_expire_credits: { Args: never; Returns: number }
      fn_extend_expiry: {
        Args: { p_lot_id: string; p_new_expires_at: string; p_reason: string }
        Returns: Json
      }
      fn_find_by_phone: { Args: { p_phone: string }; Returns: Json }
      fn_flag_for_sales: {
        Args: { p_client_id: string; p_kind?: string; p_note: string }
        Returns: string
      }
      fn_flag_for_sales_internal: {
        Args: {
          p_client_id: string
          p_kind?: string
          p_note: string
          p_session_id?: string
        }
        Returns: string
      }
      fn_hourly_notifications: { Args: never; Returns: number }
      fn_is_sales_of_branch: { Args: { p_branch_id: string }; Returns: boolean }
      fn_issue_credits: {
        Args: {
          p_client_id: string
          p_coach_membership_id?: string
          p_deal_item_id: string
          p_expiry_days?: number
          p_per_session_value: number
          p_qty: number
        }
        Returns: string
      }
      fn_issue_onboarding_token: {
        Args: { p_lead_id: string }
        Returns: string
      }
      fn_kiosk_check_in: {
        Args: { p_branch: string; p_phone: string }
        Returns: Json
      }
      fn_kiosk_code: { Args: { p_branch: string }; Returns: string }
      fn_kiosk_code_for: {
        Args: { p_branch: string; p_day: string }
        Returns: string
      }
      fn_kiosk_notify_sales: {
        Args: { p_branch: string; p_client_id: string }
        Returns: Json
      }
      fn_lead_breakdown: {
        Args: { p_branch_id: string; p_month: string }
        Returns: {
          dimension: string
          key: string
          n: number
        }[]
      }
      fn_lead_sla_state: {
        Args: { p_lead: Database["public"]["Tables"]["leads"]["Row"] }
        Returns: string
      }
      fn_lead_stage_since: {
        Args: { p_lead: Database["public"]["Tables"]["leads"]["Row"] }
        Returns: string
      }
      fn_log_touch: {
        Args: {
          p_client_id: string
          p_direction?: Database["public"]["Enums"]["touch_direction"]
          p_lead_id: string
          p_note?: string
          p_type: Database["public"]["Enums"]["touch_type"]
        }
        Returns: string
      }
      fn_mark_lapsed: { Args: never; Returns: number }
      fn_mark_notifications_read: {
        Args: { p_ids?: string[] }
        Returns: number
      }
      fn_materialize_sessions: {
        Args: { p_coach_membership_id?: string; p_date?: string }
        Returns: number
      }
      fn_membership_name: { Args: { p_membership_id: string }; Returns: string }
      fn_money_summary: {
        Args: { p_branch_id?: string; p_month: string }
        Returns: Json
      }
      fn_my_coach_membership: { Args: { p_branch: string }; Returns: string }
      fn_new_program_version: {
        Args: { p_program_id: string }
        Returns: string
      }
      fn_nightly: { Args: never; Returns: Json }
      fn_normalize_phone: { Args: { p: string }; Returns: string }
      fn_notify: {
        Args: {
          p_body?: string
          p_channel?: Database["public"]["Enums"]["notification_channel"]
          p_data?: Json
          p_recipient: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      fn_notify_client: {
        Args: {
          p_body?: string
          p_channel?: Database["public"]["Enums"]["notification_channel"]
          p_client_id: string
          p_data?: Json
          p_title: string
          p_type: string
        }
        Returns: string
      }
      fn_notify_role: {
        Args: {
          p_body?: string
          p_branch: string
          p_data?: Json
          p_role: Database["public"]["Enums"]["app_role"]
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      fn_onboarding_state: { Args: { p_token: string }; Returns: Json }
      fn_price_deal: {
        Args: { p_deal_id: string }
        Returns: {
          approval_id: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          client_id: string | null
          closer_membership_id: string | null
          created_at: string
          created_by: string | null
          discount_fixed_piastres: number
          discount_pct: number
          discount_piastres: number
          first_paid_at: string | null
          id: string
          installments_count: number
          is_renewal: boolean
          lead_id: string | null
          notes: string | null
          paid_at: string | null
          paid_piastres: number
          payment_plan: Database["public"]["Enums"]["payment_plan"]
          rep_membership_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          subtotal_piastres: number
          total_piastres: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_program: { Args: { p_program: string }; Returns: Json }
      fn_program_templates: { Args: never; Returns: Json }
      fn_pt_commission_pct: { Args: { p_sessions: number }; Returns: number }
      fn_rank_coaches: {
        Args: { p_client_id?: string; p_lead_id?: string }
        Returns: {
          active_clients: number
          capacity: number
          coach_membership_id: string
          coach_name: string
          over_capacity: boolean
          reasons: Json
          score: number
        }[]
      }
      fn_record_attendance: {
        Args: {
          p_outcome: Database["public"]["Enums"]["session_status"]
          p_session_id: string
          p_waive?: boolean
          p_waive_reason?: string
        }
        Returns: Json
      }
      fn_record_payment: {
        Args: {
          p_amount: number
          p_deal_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_received_at?: string
          p_reference?: string
        }
        Returns: Json
      }
      fn_refresh_views: { Args: { p_heavy?: boolean }; Returns: undefined }
      fn_request_approval: {
        Args: {
          p_branch_id: string
          p_payload?: Json
          p_reason: string
          p_subject_id: string
          p_subject_table: string
          p_type: Database["public"]["Enums"]["approval_type"]
        }
        Returns: string
      }
      fn_request_freeze: {
        Args: {
          p_client_id: string
          p_ends_at: string
          p_reason: string
          p_starts_at: string
        }
        Returns: string
      }
      fn_request_payment_void: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: string
      }
      fn_require_client: {
        Args: never
        Returns: {
          coach_membership_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          home_branch_id: string
          id: string
          injuries: string | null
          instagram_handle: string | null
          joined_at: string
          last_visit_at: string | null
          lead_id: string | null
          nutritionist_membership_id: string | null
          onboarding_responses: Json
          phone: string
          profile_id: string | null
          rep_membership_id: string | null
          risk_reasons: Json
          risk_score: number
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_resolve_days: { Args: { p_days: Json }; Returns: Json }
      fn_restore_credit: {
        Args: { p_reason: string; p_session_id: string }
        Returns: undefined
      }
      fn_review_lead: {
        Args: { p_approve: boolean; p_lead_id: string; p_note?: string }
        Returns: undefined
      }
      fn_round_robin_next: { Args: { p_branch_id: string }; Returns: string }
      fn_sales_approvals: { Args: { p_branch_id: string }; Returns: Json }
      fn_sales_client: { Args: { p_client_id: string }; Returns: Json }
      fn_sales_deals: {
        Args: {
          p_branch_id: string
          p_search?: string
          p_status?: Database["public"]["Enums"]["deal_status"]
        }
        Returns: {
          client_id: string
          created_at: string
          first_paid_at: string
          id: string
          is_renewal: boolean
          lead_id: string
          name: string
          paid_piastres: number
          phone: string
          rep_name: string
          status: Database["public"]["Enums"]["deal_status"]
          total_piastres: number
        }[]
      }
      fn_sales_lead: { Args: { p_lead_id: string }; Returns: Json }
      fn_sales_leads: {
        Args: {
          p_branch_id?: string
          p_include_closed?: boolean
          p_search?: string
          p_status?: Database["public"]["Enums"]["lead_status"]
        }
        Returns: {
          branch_id: string
          created_at: string
          email: string
          first_contact_at: string
          first_contact_due_at: string
          full_name: string
          id: string
          interest_tags: string[]
          is_stale: boolean
          last_touch_at: string
          lost_reason: Database["public"]["Enums"]["lost_reason"]
          next_follow_up_at: string
          onboarding_completed_at: string
          owner_membership_id: string
          owner_name: string
          phone: string
          review_status: Database["public"]["Enums"]["review_status"]
          sla_state: string
          source_code: string
          source_name: string
          stage_since: string
          status: Database["public"]["Enums"]["lead_status"]
        }[]
      }
      fn_sales_queue: { Args: { p_branch_id: string }; Returns: Json }
      fn_sales_reps: {
        Args: { p_branch_id: string }
        Returns: {
          full_name: string
          membership_id: string
          role: Database["public"]["Enums"]["app_role"]
          rotation_paused: boolean
        }[]
      }
      fn_sales_team: {
        Args: { p_branch_id: string; p_month: string }
        Returns: {
          commission_piastres: number
          contacted: number
          conversion_pct: number
          full_name: string
          leads: number
          lost: number
          median_response_min: number
          membership_collected: number
          membership_id: string
          onboarded: number
          open_flags: number
          overdue_follow_ups: number
          quoted: number
          rotation_paused: boolean
          target_won_revenue: number
          won: number
          won_revenue: number
        }[]
      }
      fn_sales_today: { Args: { p_branch_id: string }; Returns: Json }
      fn_save_bundle_items: {
        Args: { p_bundle_id: string; p_items: Json }
        Returns: undefined
      }
      fn_save_deal_draft: {
        Args: {
          p_deal_id: string
          p_discount_fixed_piastres?: number
          p_discount_pct?: number
          p_installments_count?: number
          p_items: Json
          p_notes?: string
          p_payment_plan?: Database["public"]["Enums"]["payment_plan"]
        }
        Returns: Json
      }
      fn_save_membership: {
        Args: {
          p_branch_id: string
          p_capacity?: number
          p_discount_allowance_pct?: number
          p_is_active?: boolean
          p_membership_id: string
          p_profile_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_specialties?: string[]
        }
        Returns: string
      }
      fn_save_product: {
        Args: {
          p_branch_id: string
          p_code: string
          p_duration_days?: number
          p_expiry_days?: number
          p_id: string
          p_is_active?: boolean
          p_name: string
          p_price_piastres: number
          p_session_count?: number
          p_session_minutes?: number
          p_sort_order?: number
          p_type: Database["public"]["Enums"]["product_type"]
        }
        Returns: string
      }
      fn_save_program: {
        Args: {
          p_client_id: string
          p_days: Json
          p_goal: string
          p_name: string
          p_program_id: string
          p_weeks: number
        }
        Returns: Json
      }
      fn_save_template: {
        Args: { p_days: Json; p_gym_wide?: boolean; p_name: string }
        Returns: string
      }
      fn_schedulable_clients: {
        Args: { p_coach: string }
        Returns: {
          client_id: string
          credits_left: number
          full_name: string
          is_primary: boolean
          next_expiry: string
          pref_days: Json
          pref_time: string
          weekly_slots: number
        }[]
      }
      fn_set_availability: {
        Args: { p_coach: string; p_hours: Json }
        Returns: undefined
      }
      fn_set_lead_stage: {
        Args: {
          p_lead_id: string
          p_lost_note?: string
          p_lost_reason?: Database["public"]["Enums"]["lost_reason"]
          p_status: Database["public"]["Enums"]["lead_status"]
        }
        Returns: undefined
      }
      fn_set_primary_coach: {
        Args: {
          p_client_id: string
          p_coach_membership_id: string
          p_reason: string
        }
        Returns: undefined
      }
      fn_set_profile_active: {
        Args: { p_active: boolean; p_profile_id: string }
        Returns: undefined
      }
      fn_set_rotation_paused: {
        Args: { p_membership_id: string; p_paused: boolean }
        Returns: undefined
      }
      fn_setting: { Args: { k: string }; Returns: Json }
      fn_setting_bool: { Args: { d: boolean; k: string }; Returns: boolean }
      fn_setting_int: { Args: { d: number; k: string }; Returns: number }
      fn_setting_num: { Args: { d: number; k: string }; Returns: number }
      fn_setting_text: { Args: { d: string; k: string }; Returns: string }
      fn_settle_unpaid_sessions: {
        Args: { p_client_id: string; p_coach_membership_id: string }
        Returns: number
      }
      fn_skip_slot: {
        Args: { p_date: string; p_reason?: string; p_slot_id: string }
        Returns: undefined
      }
      fn_start_walkin_session: {
        Args: { p_client_id: string; p_notes?: string }
        Returns: string
      }
      fn_submit_deal: {
        Args: { p_deal_id: string }
        Returns: {
          approval_id: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          client_id: string | null
          closer_membership_id: string | null
          created_at: string
          created_by: string | null
          discount_fixed_piastres: number
          discount_pct: number
          discount_piastres: number
          first_paid_at: string | null
          id: string
          installments_count: number
          is_renewal: boolean
          lead_id: string | null
          notes: string | null
          paid_at: string | null
          paid_piastres: number
          payment_plan: Database["public"]["Enums"]["payment_plan"]
          rep_membership_id: string | null
          status: Database["public"]["Enums"]["deal_status"]
          subtotal_piastres: number
          total_piastres: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_submit_onboarding: {
        Args: {
          p_answers: Json
          p_complete?: boolean
          p_step: string
          p_token: string
        }
        Returns: Json
      }
      fn_today_live: { Args: never; Returns: Json }
      fn_update_my_profile: {
        Args: {
          p_consent_content?: boolean
          p_consent_marketing?: boolean
          p_instagram?: string
          p_language?: string
          p_pt_prefs?: Json
        }
        Returns: undefined
      }
      fn_update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        SetofOptions: {
          from: "*"
          to: "settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_upsert_schedule_slot: {
        Args: {
          p_client_id?: string
          p_coach_membership_id: string
          p_duration?: number
          p_ends_on?: string
          p_kind?: Database["public"]["Enums"]["slot_kind"]
          p_label?: string
          p_slot_id?: string
          p_start_time: string
          p_starts_on?: string
          p_weekday: number
        }
        Returns: string
      }
      fn_weekday_name: { Args: { d: number }; Returns: string }
      fn_within_opening_hours: {
        Args: { p_branch_id: string; p_t: string }
        Returns: string
      }
      has_role: {
        Args: { b?: string; r: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_coach_of_branch: { Args: { b: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_top_management: { Args: never; Returns: boolean }
      my_branch_ids: { Args: never; Returns: string[] }
      my_client_id: { Args: never; Returns: string }
      my_coach_client_ids: { Args: never; Returns: string[] }
      my_lead_ids: { Args: never; Returns: string[] }
      my_membership_ids: { Args: never; Returns: string[] }
      my_profile_id: { Args: never; Returns: string }
      my_roles: {
        Args: never
        Returns: {
          branch_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      my_sales_client_ids: { Args: never; Returns: string[] }
      week_start_sat: { Args: { d: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "top_management"
        | "head_coach"
        | "coach"
        | "nutritionist"
        | "sales_manager"
        | "sales_rep"
        | "front_desk"
        | "client"
      approval_status: "pending" | "approved" | "rejected"
      approval_type:
        | "discount"
        | "installments"
        | "freeze"
        | "refund"
        | "transfer"
        | "attendance_edit"
        | "payment_void"
        | "lead_reassign"
        | "expiry_extension"
      client_status: "active" | "frozen" | "lapsed"
      credit_entry_type:
        | "issue"
        | "consume"
        | "expire"
        | "refund"
        | "adjust"
        | "restore"
      deal_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "partially_paid"
        | "paid"
        | "cancelled"
      entitlement_status: "active" | "frozen" | "expired" | "cancelled"
      entitlement_type: "membership" | "nutrition"
      follow_up_status: "open" | "done" | "skipped"
      freeze_status: "pending" | "active" | "ended" | "rejected"
      lead_status: "new" | "contacted" | "onboarded" | "quoted" | "won" | "lost"
      lost_reason:
        | "price"
        | "location"
        | "timing"
        | "went_elsewhere"
        | "no_response"
        | "not_interested"
        | "duplicate"
        | "other"
      lot_status: "active" | "exhausted" | "expired" | "refunded"
      note_visibility: "coaching" | "sales" | "all"
      notification_channel: "in_app" | "whatsapp" | "email" | "push"
      notification_status: "pending" | "sent" | "failed" | "read"
      payment_method: "cash" | "card" | "instapay" | "bank_transfer" | "other"
      payment_plan: "single" | "installments"
      product_type: "membership" | "pt_pack" | "nutrition" | "bundle"
      program_status: "draft" | "active" | "archived"
      review_status: "not_required" | "pending" | "approved" | "rejected"
      session_status: "booked" | "completed" | "no_show" | "cancelled"
      slot_kind: "client" | "class" | "blocked"
      target_scope: "branch" | "membership"
      touch_direction: "outbound" | "inbound"
      touch_type: "call" | "whatsapp" | "visit" | "email" | "instagram" | "note"
      visit_method: "qr" | "phone" | "staff" | "session"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "top_management",
        "head_coach",
        "coach",
        "nutritionist",
        "sales_manager",
        "sales_rep",
        "front_desk",
        "client",
      ],
      approval_status: ["pending", "approved", "rejected"],
      approval_type: [
        "discount",
        "installments",
        "freeze",
        "refund",
        "transfer",
        "attendance_edit",
        "payment_void",
        "lead_reassign",
        "expiry_extension",
      ],
      client_status: ["active", "frozen", "lapsed"],
      credit_entry_type: [
        "issue",
        "consume",
        "expire",
        "refund",
        "adjust",
        "restore",
      ],
      deal_status: [
        "draft",
        "pending_approval",
        "approved",
        "partially_paid",
        "paid",
        "cancelled",
      ],
      entitlement_status: ["active", "frozen", "expired", "cancelled"],
      entitlement_type: ["membership", "nutrition"],
      follow_up_status: ["open", "done", "skipped"],
      freeze_status: ["pending", "active", "ended", "rejected"],
      lead_status: ["new", "contacted", "onboarded", "quoted", "won", "lost"],
      lost_reason: [
        "price",
        "location",
        "timing",
        "went_elsewhere",
        "no_response",
        "not_interested",
        "duplicate",
        "other",
      ],
      lot_status: ["active", "exhausted", "expired", "refunded"],
      note_visibility: ["coaching", "sales", "all"],
      notification_channel: ["in_app", "whatsapp", "email", "push"],
      notification_status: ["pending", "sent", "failed", "read"],
      payment_method: ["cash", "card", "instapay", "bank_transfer", "other"],
      payment_plan: ["single", "installments"],
      product_type: ["membership", "pt_pack", "nutrition", "bundle"],
      program_status: ["draft", "active", "archived"],
      review_status: ["not_required", "pending", "approved", "rejected"],
      session_status: ["booked", "completed", "no_show", "cancelled"],
      slot_kind: ["client", "class", "blocked"],
      target_scope: ["branch", "membership"],
      touch_direction: ["outbound", "inbound"],
      touch_type: ["call", "whatsapp", "visit", "email", "instagram", "note"],
      visit_method: ["qr", "phone", "staff", "session"],
    },
  },
} as const

