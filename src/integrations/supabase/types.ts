export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
      student_subscriptions: {
        Row: {
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
          terms_accepted_at: string;
          terms_version: string;
          updated_at: string;
        };
        Insert: {
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
          terms_accepted_at: string;
          terms_version?: string;
          updated_at?: string;
        };
        Update: {
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
          terms_accepted_at?: string;
          terms_version?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
          teacher_id?: string;
          transaction_type?: Database["public"]["Enums"]["teacher_wallet_transaction_type"];
          withdrawal_request_id?: string | null;
        };
        Relationships: [];
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
          processed_at?: string | null;
          requested_at?: string;
          status?: Database["public"]["Enums"]["teacher_withdrawal_status"];
          teacher_id?: string;
          teacher_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
      complete_student_profile: {
        Args: {
          _age: number;
          _avatar_url?: string | null;
          _comprehension_level: Database["public"]["Enums"]["language_level"];
          _cpf: string;
          _desired_language: string;
          _full_name: string;
        };
        Returns: void;
      };
      complete_teacher_profile: {
        Args: {
          _age: number;
          _avatar_url?: string | null;
          _bio: string;
          _countries_lived?: string | null;
          _cpf: string;
          _custom_prices?: Json;
          _experiences?: string | null;
          _full_name: string;
          _languages_spoken: string[];
          _languages_taught: string[];
          _levels_taught: Database["public"]["Enums"]["language_level"][];
          _lived_abroad: boolean;
          _use_custom_pricing: boolean;
        };
        Returns: void;
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
      get_teacher_wallet_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          available_balance: number;
          pending_withdrawals: number;
          total_received: number;
          total_withdrawn: number;
        }[];
      };
      get_own_onboarding_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          age: number | null;
          avatar_url: string | null;
          cpf: string | null;
          full_name: string | null;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
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
