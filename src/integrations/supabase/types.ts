export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      validapay_webhook_events: {
        Row: {
          created_at: string;
          event_id: string | null;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          processing_error: string | null;
          provider_reference: string | null;
        };
        Insert: {
          created_at?: string;
          event_id?: string | null;
          event_type: string;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          provider_reference?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          provider_reference?: string | null;
        };
        Relationships: [];
      };
      asaas_webhook_events: {
        Row: {
          created_at: string;
          event_key: string;
          event_type: string | null;
          id: string;
          payload: Json;
          processed_at: string | null;
          processing_error: string | null;
        };
        Insert: {
          created_at?: string;
          event_key: string;
          event_type?: string | null;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          processing_error?: string | null;
        };
        Update: {
          created_at?: string;
          event_key?: string;
          event_type?: string | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
        };
        Relationships: [];
      };
      asaas_subscription_payments: {
        Row: {
          amount: number;
          asaas_payment_id: string;
          created_at: string;
          due_date: string;
          id: string;
          invoice_url: string | null;
          payment_reference: string;
          payload: Json | null;
          period_end: string;
          period_start: string;
          status: string | null;
          subscription_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          asaas_payment_id: string;
          created_at?: string;
          due_date: string;
          id?: string;
          invoice_url?: string | null;
          payment_reference: string;
          payload?: Json | null;
          period_end: string;
          period_start: string;
          status?: string | null;
          subscription_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          asaas_payment_id?: string;
          created_at?: string;
          due_date?: string;
          id?: string;
          invoice_url?: string | null;
          payment_reference?: string;
          payload?: Json | null;
          period_end?: string;
          period_start?: string;
          status?: string | null;
          subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asaas_subscription_payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "student_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          created_at: string;
          duration_minutes: number;
          id: string;
          meeting_url: string | null;
          notes: string | null;
          scheduled_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          student_id: string;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          meeting_url?: string | null;
          notes?: string | null;
          scheduled_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          student_id: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          meeting_url?: string | null;
          notes?: string | null;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          student_id?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      class_assignments: {
        Row: {
          class_id: string;
          created_at: string;
          due_at: string | null;
          external_url: string | null;
          file_mime_type: string | null;
          file_name: string | null;
          file_path: string | null;
          id: string;
          instructions: string | null;
          teacher_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          due_at?: string | null;
          external_url?: string | null;
          file_mime_type?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          id?: string;
          instructions?: string | null;
          teacher_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          due_at?: string | null;
          external_url?: string | null;
          file_mime_type?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          id?: string;
          instructions?: string | null;
          teacher_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_groups: {
        Row: {
          created_at: string;
          day_of_week: number | null;
          description: string | null;
          end_time: string | null;
          id: string;
          language: string;
          level: Database["public"]["Enums"]["language_level"] | null;
          meeting_url: string | null;
          name: string;
          start_time: string | null;
          status: string;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week?: number | null;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          language: string;
          level?: Database["public"]["Enums"]["language_level"] | null;
          meeting_url?: string | null;
          name: string;
          start_time?: string | null;
          status?: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number | null;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          language?: string;
          level?: Database["public"]["Enums"]["language_level"] | null;
          meeting_url?: string | null;
          name?: string;
          start_time?: string | null;
          status?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_groups_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_materials: {
        Row: {
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          external_url: string | null;
          file_mime_type: string | null;
          file_name: string | null;
          file_path: string | null;
          id: string;
          source: string;
          teacher_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          external_url?: string | null;
          file_mime_type?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          id?: string;
          source?: string;
          teacher_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          external_url?: string | null;
          file_mime_type?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          id?: string;
          source?: string;
          teacher_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_materials_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_materials_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_materials_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_members: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          joined_at: string;
          status: string;
          student_id: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          joined_at?: string;
          status?: string;
          student_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          joined_at?: string;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_members_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      material_requests: {
        Row: {
          class_id: string | null;
          created_at: string;
          director_response: string | null;
          id: string;
          message: string;
          status: string;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          director_response?: string | null;
          id?: string;
          message: string;
          status?: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          director_response?: string | null;
          id?: string;
          message?: string;
          status?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_requests_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_requests_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_wallet_transactions: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          description: string;
          fee_rate: number;
          gross_amount: number | null;
          id: string;
          student_id: string | null;
          subscription_id: string | null;
          subscription_payment_reference: string | null;
          teacher_id: string | null;
          transaction_type: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          description: string;
          fee_rate?: number;
          gross_amount?: number | null;
          id?: string;
          student_id?: string | null;
          subscription_id?: string | null;
          subscription_payment_reference?: string | null;
          teacher_id?: string | null;
          transaction_type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          fee_rate?: number;
          gross_amount?: number | null;
          id?: string;
          student_id?: string | null;
          subscription_id?: string | null;
          subscription_payment_reference?: string | null;
          teacher_id?: string | null;
          transaction_type?: string;
        };
        Relationships: [];
      };
      platform_withdrawal_requests: {
        Row: {
          account_holder_name: string;
          amount: number;
          created_at: string;
          id: string;
          paid_at: string | null;
          payout_error: string | null;
          payout_external_id: string | null;
          payout_external_status: string | null;
          payout_provider: string | null;
          payout_receipt_url: string | null;
          payout_requested_at: string | null;
          payout_response: Json | null;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          processed_at: string | null;
          requested_by: string | null;
          status: Database["public"]["Enums"]["teacher_withdrawal_status"];
          updated_at: string;
          wallet_transaction_id: string | null;
        };
        Insert: {
          account_holder_name: string;
          amount: number;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          payout_error?: string | null;
          payout_external_id?: string | null;
          payout_external_status?: string | null;
          payout_provider?: string | null;
          payout_receipt_url?: string | null;
          payout_requested_at?: string | null;
          payout_response?: Json | null;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          processed_at?: string | null;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["teacher_withdrawal_status"];
          updated_at?: string;
          wallet_transaction_id?: string | null;
        };
        Update: {
          account_holder_name?: string;
          amount?: number;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          payout_error?: string | null;
          payout_external_id?: string | null;
          payout_external_status?: string | null;
          payout_provider?: string | null;
          payout_receipt_url?: string | null;
          payout_requested_at?: string | null;
          payout_response?: Json | null;
          pix_key?: string;
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"];
          processed_at?: string | null;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["teacher_withdrawal_status"];
          updated_at?: string;
          wallet_transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_withdrawal_requests_wallet_transaction_id_fkey";
            columns: ["wallet_transaction_id"];
            isOneToOne: false;
            referencedRelation: "platform_wallet_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          age: number | null;
          avatar_url: string | null;
          cpf: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          age?: number | null;
          avatar_url?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          age?: number | null;
          avatar_url?: string | null;
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          booking_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          student_id: string;
          teacher_id: string;
        };
        Insert: {
          booking_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          student_id: string;
          teacher_id: string;
        };
        Update: {
          booking_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          student_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      student_profiles: {
        Row: {
          comprehension_level: Database["public"]["Enums"]["language_level"];
          created_at: string;
          desired_language: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          comprehension_level?: Database["public"]["Enums"]["language_level"];
          created_at?: string;
          desired_language: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          comprehension_level?: Database["public"]["Enums"]["language_level"];
          created_at?: string;
          desired_language?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_scores: {
        Row: {
          class_id: string | null;
          created_at: string;
          id: string;
          note: string | null;
          score: number | null;
          student_id: string;
          teacher_id: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          score?: number | null;
          student_id: string;
          teacher_id: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          score?: number | null;
          student_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_scores_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_scores_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_scores_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_subscriptions: {
        Row: {
          asaas_customer_id: string | null;
          asaas_payment_id: string | null;
          asaas_payment_status: string | null;
          asaas_pix_authorization_id: string | null;
          asaas_pix_authorization_status: string | null;
          asaas_pix_conciliation_id: string | null;
          asaas_pix_contract_id: string | null;
          asaas_pix_encoded_image: string | null;
          asaas_pix_expiration_date: string | null;
          asaas_pix_payload: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          last_payment_at: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          student_id: string;
          teacher_id: string | null;
          terms_accepted_at: string;
          terms_version: string;
          updated_at: string;
          validapay_charge_id: string | null;
          validapay_checkout_session_id: string | null;
          validapay_customer_id: string | null;
          validapay_payment_id: string | null;
          validapay_payment_status: string | null;
          validapay_payload: Json | null;
          validapay_subscription_id: string | null;
        };
        Insert: {
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_payment_status?: string | null;
          asaas_pix_authorization_id?: string | null;
          asaas_pix_authorization_status?: string | null;
          asaas_pix_conciliation_id?: string | null;
          asaas_pix_contract_id?: string | null;
          asaas_pix_encoded_image?: string | null;
          asaas_pix_expiration_date?: string | null;
          asaas_pix_payload?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          last_payment_at?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          plan_id: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          student_id: string;
          teacher_id?: string | null;
          terms_accepted_at: string;
          terms_version?: string;
          updated_at?: string;
          validapay_charge_id?: string | null;
          validapay_checkout_session_id?: string | null;
          validapay_customer_id?: string | null;
          validapay_payment_id?: string | null;
          validapay_payment_status?: string | null;
          validapay_payload?: Json | null;
          validapay_subscription_id?: string | null;
        };
        Update: {
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_payment_status?: string | null;
          asaas_pix_authorization_id?: string | null;
          asaas_pix_authorization_status?: string | null;
          asaas_pix_conciliation_id?: string | null;
          asaas_pix_contract_id?: string | null;
          asaas_pix_encoded_image?: string | null;
          asaas_pix_expiration_date?: string | null;
          asaas_pix_payload?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          last_payment_at?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          plan_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          student_id?: string;
          teacher_id?: string | null;
          terms_accepted_at?: string;
          terms_version?: string;
          updated_at?: string;
          validapay_charge_id?: string | null;
          validapay_checkout_session_id?: string | null;
          validapay_customer_id?: string | null;
          validapay_payment_id?: string | null;
          validapay_payment_status?: string | null;
          validapay_payload?: Json | null;
          validapay_subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_subscriptions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          created_at: string;
          description: string | null;
          features: string[];
          hours_per_week: number | null;
          id: string;
          installments: number;
          interval: Database["public"]["Enums"]["plan_interval"];
          is_active: boolean;
          name: string;
          price: number;
          slug: string;
          sort_order: number;
          stripe_price_id_card: string | null;
          updated_at: string;
          validapay_price_id: string | null;
          validapay_product_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          features?: string[];
          hours_per_week?: number | null;
          id?: string;
          installments?: number;
          interval?: Database["public"]["Enums"]["plan_interval"];
          is_active?: boolean;
          name: string;
          price: number;
          slug: string;
          sort_order?: number;
          stripe_price_id_card?: string | null;
          updated_at?: string;
          validapay_price_id?: string | null;
          validapay_product_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          features?: string[];
          hours_per_week?: number | null;
          id?: string;
          installments?: number;
          interval?: Database["public"]["Enums"]["plan_interval"];
          is_active?: boolean;
          name?: string;
          price?: number;
          slug?: string;
          sort_order?: number;
          stripe_price_id_card?: string | null;
          updated_at?: string;
          validapay_price_id?: string | null;
          validapay_product_id?: string | null;
        };
        Relationships: [];
      };
      teacher_announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          link_url: string | null;
          published_at: string;
          title: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          link_url?: string | null;
          published_at?: string;
          title: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          link_url?: string | null;
          published_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_availability: {
        Row: {
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          start_time: string;
          teacher_id: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          start_time: string;
          teacher_id: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          start_time?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_meetings: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          meeting_url: string | null;
          notes: string | null;
          scheduled_at: string;
          teacher_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_url?: string | null;
          notes?: string | null;
          scheduled_at: string;
          teacher_id?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_url?: string | null;
          notes?: string | null;
          scheduled_at?: string;
          teacher_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_meetings_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_posts: {
        Row: {
          caption: string;
          created_at: string;
          id: string;
          image_path: string | null;
          image_url: string | null;
          teacher_id: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          caption: string;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          teacher_id: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          caption?: string;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          teacher_id?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_posts_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_profiles: {
        Row: {
          bio: string | null;
          countries_lived: string | null;
          created_at: string;
          custom_prices: Json;
          experiences: string | null;
          hourly_rate: number | null;
          id: string;
          is_active: boolean;
          languages_spoken: string[];
          languages_taught: string[];
          levels_taught: Database["public"]["Enums"]["language_level"][];
          lived_abroad: boolean | null;
          monthly_rate: number | null;
          package_8_rate: number | null;
          updated_at: string;
          use_custom_pricing: boolean;
        };
        Insert: {
          bio?: string | null;
          countries_lived?: string | null;
          created_at?: string;
          custom_prices?: Json;
          experiences?: string | null;
          hourly_rate?: number | null;
          id: string;
          is_active?: boolean;
          languages_spoken?: string[];
          languages_taught?: string[];
          levels_taught?: Database["public"]["Enums"]["language_level"][];
          lived_abroad?: boolean | null;
          monthly_rate?: number | null;
          package_8_rate?: number | null;
          updated_at?: string;
          use_custom_pricing?: boolean;
        };
        Update: {
          bio?: string | null;
          countries_lived?: string | null;
          created_at?: string;
          custom_prices?: Json;
          experiences?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean;
          languages_spoken?: string[];
          languages_taught?: string[];
          levels_taught?: Database["public"]["Enums"]["language_level"][];
          lived_abroad?: boolean | null;
          monthly_rate?: number | null;
          package_8_rate?: number | null;
          updated_at?: string;
          use_custom_pricing?: boolean;
        };
        Relationships: [];
      };
      teacher_secretariat_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
          sender_role: string;
          teacher_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
          sender_role?: string;
          teacher_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
          sender_role?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_secretariat_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_secretariat_messages_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_student_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
          student_id: string;
          teacher_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
          student_id: string;
          teacher_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
          student_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_student_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_student_messages_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "student_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_student_messages_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_wallet_transactions: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          gross_amount: number | null;
          id: string;
          platform_fee: number | null;
          platform_fee_rate: number;
          subscription_id: string | null;
          subscription_payment_reference: string | null;
          teacher_id: string;
          transaction_type: Database["public"]["Enums"]["teacher_wallet_transaction_type"];
          withdrawal_request_id: string | null;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          gross_amount?: number | null;
          id?: string;
          platform_fee?: number | null;
          platform_fee_rate?: number;
          subscription_id?: string | null;
          subscription_payment_reference?: string | null;
          teacher_id: string;
          transaction_type: Database["public"]["Enums"]["teacher_wallet_transaction_type"];
          withdrawal_request_id?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          gross_amount?: number | null;
          id?: string;
          platform_fee?: number | null;
          platform_fee_rate?: number;
          subscription_id?: string | null;
          subscription_payment_reference?: string | null;
          teacher_id?: string;
          transaction_type?: Database["public"]["Enums"]["teacher_wallet_transaction_type"];
          withdrawal_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_wallet_transactions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_wallet_transactions_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "student_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_wallet_transactions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_wallet_transactions_withdrawal_request_id_fkey";
            columns: ["withdrawal_request_id"];
            isOneToOne: false;
            referencedRelation: "teacher_withdrawal_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_withdrawal_requests: {
        Row: {
          account_holder_document: string | null;
          account_holder_name: string;
          admin_notes: string | null;
          amount: number;
          created_at: string;
          id: string;
          paid_at: string | null;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          payout_error: string | null;
          payout_external_id: string | null;
          payout_external_status: string | null;
          payout_provider: string | null;
          payout_receipt_url: string | null;
          payout_requested_at: string | null;
          payout_response: Json | null;
          processed_at: string | null;
          requested_at: string;
          status: Database["public"]["Enums"]["teacher_withdrawal_status"];
          teacher_id: string;
          teacher_notes: string | null;
          updated_at: string;
        };
        Insert: {
          account_holder_document?: string | null;
          account_holder_name: string;
          admin_notes?: string | null;
          amount: number;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          payout_error?: string | null;
          payout_external_id?: string | null;
          payout_external_status?: string | null;
          payout_provider?: string | null;
          payout_receipt_url?: string | null;
          payout_requested_at?: string | null;
          payout_response?: Json | null;
          processed_at?: string | null;
          requested_at?: string;
          status?: Database["public"]["Enums"]["teacher_withdrawal_status"];
          teacher_id: string;
          teacher_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          account_holder_document?: string | null;
          account_holder_name?: string;
          admin_notes?: string | null;
          amount?: number;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          pix_key?: string;
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"];
          payout_error?: string | null;
          payout_external_id?: string | null;
          payout_external_status?: string | null;
          payout_provider?: string | null;
          payout_receipt_url?: string | null;
          payout_requested_at?: string | null;
          payout_response?: Json | null;
          processed_at?: string | null;
          requested_at?: string;
          status?: Database["public"]["Enums"]["teacher_withdrawal_status"];
          teacher_id?: string;
          teacher_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_withdrawal_requests_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teacher_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      anonymous_reports: {
        Row: {
          admin_notes: string | null;
          body: string;
          category: string;
          created_at: string;
          id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          body: string;
          category?: string;
          created_at?: string;
          id?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          body?: string;
          category?: string;
          created_at?: string;
          id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      director_alerts: {
        Row: {
          active: boolean;
          body: string;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          starts_at: string;
          target_class_id: string | null;
          target_role: Database["public"]["Enums"]["app_role"] | null;
          target_type: string;
          target_user_id: string | null;
          title: string;
          tone: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          starts_at?: string;
          target_class_id?: string | null;
          target_role?: Database["public"]["Enums"]["app_role"] | null;
          target_type: string;
          target_user_id?: string | null;
          title: string;
          tone?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          starts_at?: string;
          target_class_id?: string | null;
          target_role?: Database["public"]["Enums"]["app_role"] | null;
          target_type?: string;
          target_user_id?: string | null;
          title?: string;
          tone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "director_alerts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "director_alerts_target_class_id_fkey";
            columns: ["target_class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "director_alerts_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      director_message_reads: {
        Row: {
          message_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          message_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          message_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "director_message_reads_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "director_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "director_message_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      director_messages: {
        Row: {
          body: string;
          created_at: string;
          created_by: string;
          id: string;
          priority: string;
          target_class_id: string | null;
          target_role: Database["public"]["Enums"]["app_role"] | null;
          target_type: string;
          target_user_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by: string;
          id?: string;
          priority?: string;
          target_class_id?: string | null;
          target_role?: Database["public"]["Enums"]["app_role"] | null;
          target_type: string;
          target_user_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          priority?: string;
          target_class_id?: string | null;
          target_role?: Database["public"]["Enums"]["app_role"] | null;
          target_type?: string;
          target_user_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "director_messages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "director_messages_target_class_id_fkey";
            columns: ["target_class_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "director_messages_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      director_user_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          sender_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "director_user_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "director_user_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_paid_student_subscription: {
        Args: {
          _period_end?: string | null;
          _period_start?: string;
          _payment_reference?: string | null;
          _stripe_subscription_id?: string | null;
          _subscription_id: string;
        };
        Returns: {
          gross_amount: number;
          platform_amount: number;
          platform_transaction_id: string;
          teacher_amount: number;
          teacher_transaction_id: string;
        }[];
      };
      complete_student_profile: {
        Args: {
          _age: number;
          _avatar_url?: string;
          _comprehension_level: Database["public"]["Enums"]["language_level"];
          _cpf: string;
          _desired_language: string;
          _full_name: string;
        };
        Returns: undefined;
      };
      complete_teacher_profile: {
        Args: {
          _age: number;
          _avatar_url?: string;
          _bio: string;
          _countries_lived: string;
          _cpf: string;
          _custom_prices?: Json;
          _experiences: string;
          _full_name: string;
          _languages_spoken: string[];
          _languages_taught: string[];
          _levels_taught: Database["public"]["Enums"]["language_level"][];
          _lived_abroad: boolean;
          _use_custom_pricing: boolean;
        };
        Returns: undefined;
      };
      create_teacher_withdrawal_request: {
        Args: {
          _account_holder_document?: string | null;
          _account_holder_name: string;
          _amount: number;
          _pix_key: string;
          _pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          _teacher_id: string;
          _teacher_notes?: string | null;
        };
        Returns: string;
      };
      credit_teacher_for_completed_booking: {
        Args: { _booking_id: string };
        Returns: {
          gross_amount: number;
          platform_amount: number;
          teacher_amount: number;
          transaction_id: string;
        }[];
      };
      get_own_onboarding_profile: {
        Args: never;
        Returns: {
          age: number;
          avatar_url: string;
          cpf: string;
          full_name: string;
        }[];
      };
      get_teacher_wallet_summary: {
        Args: never;
        Returns: {
          available_balance: number;
          pending_withdrawals: number;
          total_received: number;
          total_withdrawn: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_valid_cpf: { Args: { _cpf: string }; Returns: boolean };
      request_teacher_withdrawal: {
        Args: {
          _account_holder_document?: string | null;
          _account_holder_name: string;
          _amount: number;
          _pix_key: string;
          _pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          _teacher_notes?: string | null;
        };
        Returns: string;
      };
      student_can_book: { Args: { _student_id: string }; Returns: boolean };
      student_can_book_with_teacher: {
        Args: { _student_id: string; _teacher_id: string };
        Returns: boolean;
      };
      teacher_wallet_available_balance: {
        Args: { _teacher_id: string };
        Returns: number;
      };
    };
    Enums: {
      app_role: "dev" | "professor" | "aluno";
      booking_status: "pendente" | "confirmado" | "concluido" | "cancelado";
      language_level: "iniciante" | "basico" | "intermediario" | "avancado" | "fluente";
      payment_method: "card" | "pix";
      pix_key_type: "cpf" | "email" | "telefone" | "aleatoria";
      plan_interval: "mensal" | "trimestral" | "anual";
      subscription_status: "pendente" | "ativa" | "inadimplente" | "cancelada" | "expirada";
      teacher_wallet_transaction_type:
        | "lesson_credit"
        | "withdrawal_hold"
        | "withdrawal_reversal"
        | "manual_adjustment";
      teacher_withdrawal_status: "pendente" | "em_processamento" | "pago" | "falhou" | "cancelado";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["dev", "professor", "aluno"],
      booking_status: ["pendente", "confirmado", "concluido", "cancelado"],
      language_level: ["iniciante", "basico", "intermediario", "avancado", "fluente"],
      payment_method: ["card", "pix"],
      pix_key_type: ["cpf", "email", "telefone", "aleatoria"],
      plan_interval: ["mensal", "trimestral", "anual"],
      subscription_status: ["pendente", "ativa", "inadimplente", "cancelada", "expirada"],
      teacher_wallet_transaction_type: [
        "lesson_credit",
        "withdrawal_hold",
        "withdrawal_reversal",
        "manual_adjustment",
      ],
      teacher_withdrawal_status: ["pendente", "em_processamento", "pago", "falhou", "cancelado"],
    },
  },
} as const;
