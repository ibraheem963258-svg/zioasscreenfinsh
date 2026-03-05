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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      content: {
        Row: {
          created_at: string
          duration: number
          file_size: number | null
          id: string
          name: string
          thumbnail_url: string | null
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          duration?: number
          file_size?: number | null
          id?: string
          name: string
          thumbnail_url?: string | null
          type: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          duration?: number
          file_size?: number | null
          id?: string
          name?: string
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      content_assignments: {
        Row: {
          content_id: string
          created_at: string
          display_order: number | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          content_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          content_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_assignments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      display_settings: {
        Row: {
          content_scaling: string
          created_at: string
          id: string
          playback_order: string
          slide_duration: number
          target_id: string
          target_type: string
          transition_duration: number
          transition_type: string
          updated_at: string
        }
        Insert: {
          content_scaling?: string
          created_at?: string
          id?: string
          playback_order?: string
          slide_duration?: number
          target_id: string
          target_type: string
          transition_duration?: number
          transition_type?: string
          updated_at?: string
        }
        Update: {
          content_scaling?: string
          created_at?: string
          id?: string
          playback_order?: string
          slide_duration?: number
          target_id?: string
          target_type?: string
          transition_duration?: number
          transition_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          content_id: string
          created_at: string
          display_order: number
          duration: number
          id: string
          playlist_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          display_order?: number
          duration?: number
          id?: string
          playlist_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          display_order?: number
          duration?: number
          id?: string
          playlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          content_id: string
          created_at: string
          end_date: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          priority: number
          start_date: string
          start_time: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          end_date: string
          end_time?: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          start_date: string
          start_time?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          end_date?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          start_date?: string
          start_time?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_group_assignments: {
        Row: {
          created_at: string
          group_id: string
          id: string
          screen_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          screen_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_group_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "screen_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_group_assignments_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_groups: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          branch_id: string
          created_at: string
          current_playlist_id: string | null
          force_refresh_at: string | null
          id: string
          is_active: boolean
          is_playing: boolean
          last_heartbeat: string | null
          live_stream_enabled: boolean | null
          live_stream_url: string | null
          name: string
          orientation: string
          resolution: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          current_playlist_id?: string | null
          force_refresh_at?: string | null
          id?: string
          is_active?: boolean
          is_playing?: boolean
          last_heartbeat?: string | null
          live_stream_enabled?: boolean | null
          live_stream_url?: string | null
          name: string
          orientation?: string
          resolution?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          current_playlist_id?: string | null
          force_refresh_at?: string | null
          id?: string
          is_active?: boolean
          is_playing?: boolean
          last_heartbeat?: string | null
          live_stream_enabled?: boolean | null
          live_stream_url?: string | null
          name?: string
          orientation?: string
          resolution?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screens_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screens_current_playlist_id_fkey"
            columns: ["current_playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      estimate_monthly_egress: {
        Args: {
          p_android_screens?: number
          p_samsung_screens?: number
          p_updates_per_month?: number
        }
        Returns: Json
      }
      get_content_storage_stats: { Args: never; Returns: Json }
      get_screens_with_status: {
        Args: never
        Returns: {
          branch_id: string
          computed_status: string
          current_playlist_id: string
          force_refresh_at: string
          id: string
          is_active: boolean
          is_playing: boolean
          last_heartbeat: string
          live_stream_enabled: boolean
          live_stream_url: string
          minutes_since_heartbeat: number
          name: string
          orientation: string
          resolution: string
          slug: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_stale_screens_offline: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
