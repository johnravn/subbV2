export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
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
      addresses: {
        Row: {
          address_line: string
          city: string
          company_id: string | null
          country: string
          created_at: string
          deleted: boolean
          id: string
          is_personal: boolean
          name: string | null
          updated_at: string
          zip_code: string
        }
        Insert: {
          address_line: string
          city: string
          company_id?: string | null
          country: string
          created_at?: string
          deleted?: boolean
          id?: string
          is_personal?: boolean
          name?: string | null
          updated_at?: string
          zip_code: string
        }
        Update: {
          address_line?: string
          city?: string
          company_id?: string | null
          country?: string
          created_at?: string
          deleted?: boolean
          id?: string
          is_personal?: boolean
          name?: string | null
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_person_id: string | null
          created_at: string
          general_email: string | null
          id: string
          name: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          contact_person_id?: string | null
          created_at?: string
          general_email?: string | null
          id?: string
          name: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          contact_person_id?: string | null
          created_at?: string
          general_email?: string | null
          id?: string
          name?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_contact_person_id_fkey"
            columns: ["contact_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          company_text: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          title: string | null
        }
        Insert: {
          company_id: string
          company_text?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
        }
        Update: {
          company_id?: string
          company_text?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_partner: boolean
          name: string
          notes: string | null
          phone: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_partner?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_partner?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_auth_logs: {
        Row: {
          context: string | null
          created_at: string
          detail: string | null
          hint: string | null
          id: string
          message: string | null
          sqlstate: string | null
          user_id: string | null
          where_hint: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          detail?: string | null
          hint?: string | null
          id?: string
          message?: string | null
          sqlstate?: string | null
          user_id?: string | null
          where_hint?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          detail?: string | null
          hint?: string | null
          id?: string
          message?: string | null
          sqlstate?: string | null
          user_id?: string | null
          where_hint?: string | null
        }
        Relationships: []
      }
      group_items: {
        Row: {
          group_id: string
          item_id: string
          quantity: number
        }
        Insert: {
          group_id: string
          item_id: string
          quantity: number
        }
        Update: {
          group_id?: string
          item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
        ]
      }
      group_price_history: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          group_id: string
          id: string
          set_by: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          group_id: string
          id?: string
          set_by?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          group_id?: string
          id?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_price_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_price_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      item_brands: {
        Row: {
          company_id: string
          id: string
          name: string
          url: string | null
        }
        Insert: {
          company_id?: string
          id?: string
          name: string
          url?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_brands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          company_id: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      item_groups: {
        Row: {
          active: boolean
          category_id: string | null
          company_id: string
          deleted: boolean
          description: string | null
          external_owner_id: string | null
          id: string
          internally_owned: boolean
          name: string
          unique: boolean
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          company_id: string
          deleted?: boolean
          description?: string | null
          external_owner_id?: string | null
          id?: string
          internally_owned?: boolean
          name: string
          unique?: boolean
        }
        Update: {
          active?: boolean
          category_id?: string | null
          company_id?: string
          deleted?: boolean
          description?: string | null
          external_owner_id?: string | null
          id?: string
          internally_owned?: boolean
          name?: string
          unique?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "item_groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_groups_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      item_price_history: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          item_id: string
          set_by: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          item_id: string
          set_by?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          item_id?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
        ]
      }
      item_related: {
        Row: {
          id: string
          item_a_id: string
          item_b_id: string
        }
        Insert: {
          id?: string
          item_a_id: string
          item_b_id: string
        }
        Update: {
          id?: string
          item_a_id?: string
          item_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_related_item_a_id_fkey"
            columns: ["item_a_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_related_item_a_id_fkey"
            columns: ["item_a_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_related_item_a_id_fkey"
            columns: ["item_a_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_related_item_b_id_fkey"
            columns: ["item_b_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_related_item_b_id_fkey"
            columns: ["item_b_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_related_item_b_id_fkey"
            columns: ["item_b_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          active: boolean
          allow_individual_booking: boolean
          brand_id: string | null
          category_id: string | null
          company_id: string
          deleted: boolean
          external_owner_id: string | null
          id: string
          internal_owner_company_id: string | null
          internally_owned: boolean
          model: string | null
          name: string
          notes: string | null
          total_quantity: number
        }
        Insert: {
          active?: boolean
          allow_individual_booking?: boolean
          brand_id?: string | null
          category_id?: string | null
          company_id: string
          deleted?: boolean
          external_owner_id?: string | null
          id?: string
          internal_owner_company_id?: string | null
          internally_owned?: boolean
          model?: string | null
          name: string
          notes?: string | null
          total_quantity?: number
        }
        Update: {
          active?: boolean
          allow_individual_booking?: boolean
          brand_id?: string | null
          category_id?: string | null
          company_id?: string
          deleted?: boolean
          external_owner_id?: string | null
          id?: string
          internal_owner_company_id?: string | null
          internally_owned?: boolean
          model?: string | null
          name?: string
          notes?: string | null
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "item_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_internal_owner_company_id_fkey"
            columns: ["internal_owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_contacts: {
        Row: {
          contact_id: string
          created_at: string
          job_id: string
          notes: string | null
          role: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          job_id: string
          notes?: string | null
          role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          job_id?: string
          notes?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_contacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_files: {
        Row: {
          created_at: string
          filename: string | null
          id: string
          job_id: string
          mime_type: string | null
          path: string
          size_bytes: number | null
          uploaded_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          filename?: string | null
          id?: string
          job_id: string
          mime_type?: string | null
          path: string
          size_bytes?: number | null
          uploaded_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          filename?: string | null
          id?: string
          job_id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number | null
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_files_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_notes: {
        Row: {
          author_user_id: string | null
          content: string
          created_at: string
          id: string
          job_id: string
          title: string
        }
        Insert: {
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
          job_id: string
          title: string
        }
        Update: {
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
          job_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_history: {
        Row: {
          changed_at: string
          id: string
          job_id: string
          set_by: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          changed_at?: string
          id?: string
          job_id: string
          set_by?: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          changed_at?: string
          id?: string
          job_id?: string
          set_by?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company_id: string
          created_at: string
          customer_contact_id: string | null
          customer_id: string | null
          description: string | null
          end_at: string | null
          id: string
          job_address_id: string | null
          project_lead_user_id: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_contact_id?: string | null
          customer_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          job_address_id?: string | null
          project_lead_user_id?: string | null
          start_at?: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_contact_id?: string | null
          customer_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          job_address_id?: string | null
          project_lead_user_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_job_address_id_fkey"
            columns: ["job_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_lead_user_id_fkey"
            columns: ["project_lead_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          inviter_user_id: string
          role: Database["public"]["Enums"]["company_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          inviter_user_id: string
          role: Database["public"]["Enums"]["company_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          inviter_user_id?: string
          role?: Database["public"]["Enums"]["company_role"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          last_name: string | null
          locale: string | null
          phone: string | null
          preferences: Json | null
          primary_address_id: string | null
          selected_company_id: string | null
          superuser: boolean
          timezone: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          last_name?: string | null
          locale?: string | null
          phone?: string | null
          preferences?: Json | null
          primary_address_id?: string | null
          selected_company_id?: string | null
          superuser?: boolean
          timezone?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          last_name?: string | null
          locale?: string | null
          phone?: string | null
          preferences?: Json | null
          primary_address_id?: string | null
          selected_company_id?: string | null
          superuser?: boolean
          timezone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_address_id_fkey"
            columns: ["primary_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_selected_company_id_fkey"
            columns: ["selected_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_crew: {
        Row: {
          created_at: string
          during: unknown
          id: string
          notes: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["crew_request_status"]
          time_period_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          during?: unknown
          id?: string
          notes?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["crew_request_status"]
          time_period_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          during?: unknown
          id?: string
          notes?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["crew_request_status"]
          time_period_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserved_crew_time_period_id_fkey"
            columns: ["time_period_id"]
            isOneToOne: false
            referencedRelation: "time_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_crew_time_period_id_fkey"
            columns: ["time_period_id"]
            isOneToOne: false
            referencedRelation: "vehicle_detail"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "reserved_crew_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reserved_items: {
        Row: {
          end_at: string | null
          external_note: string | null
          external_status:
            | Database["public"]["Enums"]["external_request_status"]
            | null
          forced: boolean
          id: string
          item_id: string
          quantity: number
          source_group_id: string | null
          source_kind: Database["public"]["Enums"]["reservation_source_kind"]
          start_at: string | null
          time_period_id: string
        }
        Insert: {
          end_at?: string | null
          external_note?: string | null
          external_status?:
            | Database["public"]["Enums"]["external_request_status"]
            | null
          forced?: boolean
          id?: string
          item_id: string
          quantity: number
          source_group_id?: string | null
          source_kind?: Database["public"]["Enums"]["reservation_source_kind"]
          start_at?: string | null
          time_period_id: string
        }
        Update: {
          end_at?: string | null
          external_note?: string | null
          external_status?:
            | Database["public"]["Enums"]["external_request_status"]
            | null
          forced?: boolean
          id?: string
          item_id?: string
          quantity?: number
          source_group_id?: string | null
          source_kind?: Database["public"]["Enums"]["reservation_source_kind"]
          start_at?: string | null
          time_period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserved_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_items_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_items_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_items_time_period_id_fkey"
            columns: ["time_period_id"]
            isOneToOne: false
            referencedRelation: "time_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_items_time_period_id_fkey"
            columns: ["time_period_id"]
            isOneToOne: false
            referencedRelation: "vehicle_detail"
            referencedColumns: ["next_reservation_id"]
          },
        ]
      }
      reserved_vehicles: {
        Row: {
          created_at: string
          during: unknown
          end_at: string | null
          external_note: string | null
          external_status:
            | Database["public"]["Enums"]["external_request_status"]
            | null
          id: string
          start_at: string | null
          time_period_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          during?: unknown
          end_at?: string | null
          external_note?: string | null
          external_status?:
            | Database["public"]["Enums"]["external_request_status"]
            | null
          id?: string
          start_at?: string | null
          time_period_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          during?: unknown
          end_at?: string | null
          external_note?: string | null
          external_status?:
            | Database["public"]["Enums"]["external_request_status"]
            | null
          id?: string
          start_at?: string | null
          time_period_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserved_vehicles_time_period_id_fkey"
            columns: ["time_period_id"]
            isOneToOne: false
            referencedRelation: "time_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_vehicles_time_period_id_fkey"
            columns: ["time_period_id"]
            isOneToOne: false
            referencedRelation: "vehicle_detail"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "reserved_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_index_mat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserved_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_periods: {
        Row: {
          company_id: string
          created_at: string
          deleted: boolean
          during: unknown
          end_at: string
          id: string
          is_role: boolean | null
          job_id: string | null
          needed_count: number | null
          notes: string | null
          reserved_by_user_id: string | null
          role_category: string | null
          start_at: string
          title: string | null
          updated_at: string | null
          updated_by_user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted?: boolean
          during?: unknown
          end_at: string
          id?: string
          is_role?: boolean | null
          job_id?: string | null
          needed_count?: number | null
          notes?: string | null
          reserved_by_user_id?: string | null
          role_category?: string | null
          start_at: string
          title?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted?: boolean
          during?: unknown
          end_at?: string
          id?: string
          is_role?: boolean | null
          job_id?: string | null
          needed_count?: number | null
          notes?: string | null
          reserved_by_user_id?: string | null
          role_category?: string | null
          start_at?: string
          title?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_periods_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_periods_reserved_by_user_id_fkey"
            columns: ["reserved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "time_periods_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          deleted: boolean
          external_owner_id: string | null
          fuel: Database["public"]["Enums"]["fuel"] | null
          id: string
          image_path: string | null
          internally_owned: boolean
          name: string
          notes: string | null
          registration_no: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          deleted?: boolean
          external_owner_id?: string | null
          fuel?: Database["public"]["Enums"]["fuel"] | null
          id?: string
          image_path?: string | null
          internally_owned?: boolean
          name: string
          notes?: string | null
          registration_no?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          deleted?: boolean
          external_owner_id?: string | null
          fuel?: Database["public"]["Enums"]["fuel"] | null
          id?: string
          image_path?: string | null
          internally_owned?: boolean
          name?: string
          notes?: string | null
          registration_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_user_profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["company_role"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      group_current_price: {
        Row: {
          current_price: number | null
          effective_from: string | null
          group_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_price_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_price_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_on_hand: {
        Row: {
          group_id: string | null
          on_hand: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_parts: {
        Row: {
          group_id: string | null
          item_current_price: number | null
          item_id: string | null
          item_name: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
        ]
      }
      group_price_history_with_profile: {
        Row: {
          amount: number | null
          company_id: string | null
          effective_from: string | null
          effective_to: string | null
          group_id: string | null
          id: string | null
          set_by: string | null
          set_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_price_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_rollups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_price_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups_with_rollups: {
        Row: {
          company_id: string | null
          currency: string | null
          current_price: number | null
          id: string | null
          name: string | null
          on_hand: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_index: {
        Row: {
          active: boolean | null
          allow_individual_booking: boolean | null
          brand_name: string | null
          category_name: string | null
          company_id: string | null
          currency: string | null
          current_price: number | null
          deleted: boolean | null
          external_owner_id: string | null
          external_owner_name: string | null
          id: string | null
          internally_owned: boolean | null
          is_group: boolean | null
          name: string | null
          on_hand: number | null
          unique: boolean | null
        }
        Relationships: []
      }
      item_current_price: {
        Row: {
          current_price: number | null
          effective_from: string | null
          item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
        ]
      }
      item_index_ext: {
        Row: {
          active: boolean | null
          allow_individual_booking: boolean | null
          brand_id: string | null
          category_id: string | null
          company_id: string | null
          deleted: boolean | null
          external_owner_id: string | null
          id: string | null
          internal_owner_company_id: string | null
          is_external: boolean | null
          model: string | null
          name: string | null
          notes: string | null
          owner_name: string | null
          total_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "item_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_internal_owner_company_id_fkey"
            columns: ["internal_owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      item_price_history_with_profile: {
        Row: {
          amount: number | null
          company_id: string | null
          effective_from: string | null
          effective_to: string | null
          id: string | null
          item_id: string | null
          set_by: string | null
          set_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_index_ext"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items_with_price"
            referencedColumns: ["id"]
          },
        ]
      }
      items_with_price: {
        Row: {
          category_name: string | null
          company_id: string | null
          current_price: number | null
          id: string | null
          name: string | null
          total_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_detail: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          deleted: boolean | null
          external_owner_email: string | null
          external_owner_id: string | null
          external_owner_is_partner: boolean | null
          external_owner_phone: string | null
          fuel: Database["public"]["Enums"]["fuel"] | null
          id: string | null
          image_path: string | null
          internally_owned: boolean | null
          name: string | null
          next_reservation_end_at: string | null
          next_reservation_id: string | null
          next_reservation_job_id: string | null
          next_reservation_start_at: string | null
          next_reservation_title: string | null
          notes: string | null
          owner_kind: string | null
          owner_name: string | null
          registration_no: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_periods_job_id_fkey"
            columns: ["next_reservation_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_index: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          deleted: boolean | null
          external_owner_id: string | null
          external_owner_name: string | null
          fuel: Database["public"]["Enums"]["fuel"] | null
          id: string | null
          image_path: string | null
          internally_owned: boolean | null
          name: string | null
          reg_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_index_mat: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          deleted: boolean | null
          external_owner_id: string | null
          external_owner_name: string | null
          fuel: Database["public"]["Enums"]["fuel"] | null
          id: string | null
          image_path: string | null
          internally_owned: boolean | null
          name: string | null
          reg_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_freelancer_or_invite:
        | {
            Args: {
              p_company_id: string
              p_email: string
              p_inviter_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_company_id: string
              p_email: string
              p_inviter_id: string
            }
            Returns: Json
          }
      add_member_or_invite: {
        Args: {
          p_company_id: string
          p_email: string
          p_inviter_id: string
          p_role: Database["public"]["Enums"]["company_role"]
        }
        Returns: Json
      }
      check_item_availability_for_job: {
        Args: { p_item_id: string; p_job_id: string }
        Returns: Json
      }
      create_group_with_price_and_parts: {
        Args: {
          p_active?: boolean
          p_category_id?: string
          p_company_id: string
          p_description?: string
          p_name: string
          p_parts?: Json
          p_price?: number
          p_unique?: boolean
        }
        Returns: undefined
      }
      create_item_with_price:
        | {
            Args: {
              p_active?: boolean
              p_allow_individual_booking?: boolean
              p_brand_id?: string
              p_category_id?: string
              p_company_id: string
              p_effective_from?: string
              p_model?: string
              p_name: string
              p_notes?: string
              p_price?: number
              p_total_quantity?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_active?: boolean
              p_allow_individual_booking?: boolean
              p_brand_id?: string
              p_category_id?: string
              p_company_id: string
              p_currency?: string
              p_model?: string
              p_name: string
              p_notes?: string
              p_price?: number
              p_total_quantity?: number
            }
            Returns: string
          }
      current_company_id: { Args: never; Returns: string }
      ensure_default_reservation: {
        Args: { p_job_id: string }
        Returns: string
      }
      ensure_profile_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      item_available_qty: {
        Args: {
          p_company_id: string
          p_ends_at: string
          p_item_id: string
          p_starts_at: string
        }
        Returns: number
      }
      set_company_user_role: {
        Args: {
          p_actor_user_id: string
          p_company_id: string
          p_new_role: Database["public"]["Enums"]["company_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_my_avatar: { Args: { p_path: string }; Returns: undefined }
      update_my_profile: {
        Args: {
          p_avatar_path: string
          p_bio: string
          p_display_name: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_preferences: Json
        }
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          last_name: string | null
          locale: string | null
          phone: string | null
          preferences: Json | null
          primary_address_id: string | null
          selected_company_id: string | null
          superuser: boolean
          timezone: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      company_role: "super_user" | "owner" | "employee" | "freelancer"
      crew_request_status: "planned" | "requested" | "declined" | "accepted"
      external_request_status: "planned" | "requested" | "confirmed"
      fuel: "electric" | "diesel" | "petrol"
      item_kind: "bulk" | "unique"
      job_status:
        | "draft"
        | "planned"
        | "requested"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "canceled"
        | "invoiced"
        | "paid"
      reservation_source_kind: "direct" | "group"
      reservation_status:
        | "tentative"
        | "requested"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "canceled"
      unit_status: "in_service" | "needs_service" | "lost" | "retired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      company_role: ["super_user", "owner", "employee", "freelancer"],
      crew_request_status: ["planned", "requested", "declined", "accepted"],
      external_request_status: ["planned", "requested", "confirmed"],
      fuel: ["electric", "diesel", "petrol"],
      item_kind: ["bulk", "unique"],
      job_status: [
        "draft",
        "planned",
        "requested",
        "confirmed",
        "in_progress",
        "completed",
        "canceled",
        "invoiced",
        "paid",
      ],
      reservation_source_kind: ["direct", "group"],
      reservation_status: [
        "tentative",
        "requested",
        "confirmed",
        "in_progress",
        "completed",
        "canceled",
      ],
      unit_status: ["in_service", "needs_service", "lost", "retired"],
    },
  },
} as const
