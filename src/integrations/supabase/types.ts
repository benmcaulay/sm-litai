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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      case_files: {
        Row: {
          created_at: string
          created_by: string
          firm_id: string
          id: string
          metadata: Json | null
          name: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          firm_id: string
          id?: string
          metadata?: Json | null
          name: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          firm_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      database_documents: {
        Row: {
          created_at: string
          external_database_id: string
          filename: string
          firm_id: string
          id: string
          mime_type: string | null
          size_bytes: number
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          external_database_id: string
          filename: string
          firm_id: string
          id?: string
          mime_type?: string | null
          size_bytes?: number
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          external_database_id?: string
          filename?: string
          firm_id?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      external_databases: {
        Row: {
          api_key: string | null
          auto_sync_enabled: boolean | null
          created_at: string
          created_by: string
          encrypted_oauth_access_token: string | null
          encrypted_oauth_refresh_token: string | null
          firm_id: string
          id: string
          last_document_sync_at: string | null
          last_sync_at: string | null
          name: string
          netdocs_repository_id: string | null
          netdocs_workspace_id: string | null
          oauth_access_token: string | null
          oauth_expires_at: string | null
          oauth_refresh_token: string | null
          status: string
          sync_frequency_hours: number | null
          type: string
          updated_at: string
          upload_endpoint: string | null
        }
        Insert: {
          api_key?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string
          created_by: string
          encrypted_oauth_access_token?: string | null
          encrypted_oauth_refresh_token?: string | null
          firm_id: string
          id?: string
          last_document_sync_at?: string | null
          last_sync_at?: string | null
          name: string
          netdocs_repository_id?: string | null
          netdocs_workspace_id?: string | null
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          status?: string
          sync_frequency_hours?: number | null
          type: string
          updated_at?: string
          upload_endpoint?: string | null
        }
        Update: {
          api_key?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string
          created_by?: string
          encrypted_oauth_access_token?: string | null
          encrypted_oauth_refresh_token?: string | null
          firm_id?: string
          id?: string
          last_document_sync_at?: string | null
          last_sync_at?: string | null
          name?: string
          netdocs_repository_id?: string | null
          netdocs_workspace_id?: string | null
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          status?: string
          sync_frequency_hours?: number | null
          type?: string
          updated_at?: string
          upload_endpoint?: string | null
        }
        Relationships: []
      }
      firms: {
        Row: {
          created_at: string | null
          database_config: Json | null
          domain: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          database_config?: Json | null
          domain: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          database_config?: Json | null
          domain?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          created_at: string
          created_by: string
          firm_id: string
          id: string
          metadata: Json | null
          output_type: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          firm_id: string
          id?: string
          metadata?: Json | null
          output_type?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          firm_id?: string
          id?: string
          metadata?: Json | null
          output_type?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      netdocs_documents: {
        Row: {
          ai_analysis: Json | null
          cabinet_id: string | null
          content_hash: string | null
          created_at: string
          document_name: string
          document_path: string | null
          document_version: string | null
          external_database_id: string
          file_extension: string | null
          firm_id: string
          id: string
          last_modified: string | null
          last_sync_at: string | null
          metadata: Json | null
          netdocs_document_id: string
          relevance_score: number | null
          size_bytes: number | null
          sync_status: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          cabinet_id?: string | null
          content_hash?: string | null
          created_at?: string
          document_name: string
          document_path?: string | null
          document_version?: string | null
          external_database_id: string
          file_extension?: string | null
          firm_id: string
          id?: string
          last_modified?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          netdocs_document_id: string
          relevance_score?: number | null
          size_bytes?: number | null
          sync_status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          cabinet_id?: string | null
          content_hash?: string | null
          created_at?: string
          document_name?: string
          document_path?: string | null
          document_version?: string | null
          external_database_id?: string
          file_extension?: string | null
          firm_id?: string
          id?: string
          last_modified?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          netdocs_document_id?: string
          relevance_score?: number | null
          size_bytes?: number | null
          sync_status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      netdocs_search_queries: {
        Row: {
          created_at: string
          created_by: string
          execution_time_ms: number | null
          external_database_id: string
          firm_id: string
          id: string
          query_type: string
          results_count: number | null
          search_parameters: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          execution_time_ms?: number | null
          external_database_id: string
          firm_id: string
          id?: string
          query_type: string
          results_count?: number | null
          search_parameters?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          execution_time_ms?: number | null
          external_database_id?: string
          firm_id?: string
          id?: string
          query_type?: string
          results_count?: number | null
          search_parameters?: Json
        }
        Relationships: []
      }
      netdocs_tokens: {
        Row: {
          access_token: string
          expires_at: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          expires_at: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          firm_id: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          firm_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          firm_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          content: string | null
          created_at: string | null
          created_by: string
          file_path: string | null
          file_type: string | null
          firm_id: string
          id: string
          name: string
          template_variables: Json | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          created_by: string
          file_path?: string | null
          file_type?: string | null
          firm_id: string
          id?: string
          name: string
          template_variables?: Json | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string
          file_path?: string | null
          file_type?: string | null
          firm_id?: string
          id?: string
          name?: string
          template_variables?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_oauth_token: {
        Args: { encrypted_token: string }
        Returns: string
      }
      encrypt_oauth_token: {
        Args: { token_value: string }
        Returns: string
      }
      firm_exists: {
        Args: { p_domain: string }
        Returns: boolean
      }
      get_decrypted_oauth_tokens: {
        Args: { db_id: string }
        Returns: {
          access_token: string
          expires_at: string
          refresh_token: string
        }[]
      }
      get_firm_storage_usage_bytes: {
        Args: { bucket?: string }
        Returns: number
      }
      get_netdocs_secret: {
        Args: Record<PropertyKey, never>
        Returns: {
          client_id: string
          client_secret: string
        }[]
      }
      get_user_firm_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      insert_netdocs_secret: {
        Args: { client_id: string; client_secret: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      search_firms: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      store_encrypted_oauth_tokens: {
        Args: {
          access_token: string
          db_id: string
          expires_at: string
          refresh_token: string
        }
        Returns: undefined
      }
      wipe_firm_uploads: {
        Args: { bucket?: string }
        Returns: number
      }
    }
    Enums: {
      user_role: "admin" | "user"
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
  public: {
    Enums: {
      user_role: ["admin", "user"],
    },
  },
} as const
