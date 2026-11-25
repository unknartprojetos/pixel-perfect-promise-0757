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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          autopilot: boolean
          card_rates: Json
          delay_max: number
          delay_min: number
          evolution_api_key: string | null
          evolution_url: string | null
          message_template: string
          night_pause: boolean
          store_whatsapp: string | null
          updated_at: string
          user_id: string
          webhook_token: string
        }
        Insert: {
          autopilot?: boolean
          card_rates?: Json
          delay_max?: number
          delay_min?: number
          evolution_api_key?: string | null
          evolution_url?: string | null
          message_template?: string
          night_pause?: boolean
          store_whatsapp?: string | null
          updated_at?: string
          user_id: string
          webhook_token?: string
        }
        Update: {
          autopilot?: boolean
          card_rates?: Json
          delay_max?: number
          delay_min?: number
          evolution_api_key?: string | null
          evolution_url?: string | null
          message_template?: string
          night_pause?: boolean
          store_whatsapp?: string | null
          updated_at?: string
          user_id?: string
          webhook_token?: string
        }
        Relationships: []
      }
      devices_catalog: {
        Row: {
          battery_health: number | null
          color: string | null
          condition_grade: string | null
          created_at: string
          final_price_card_12x: number | null
          final_price_pix: number
          id: string
          is_sealed: boolean
          margin_applied: number
          media_urls: string[]
          model: string
          raw_text: string | null
          sold_detected_at: string | null
          sold_reason: string | null
          source_group_jid: string
          source_group_name: string | null
          status: string
          storage: string
          supplier_cost: number
          supplier_message_id: string
          supplier_name: string | null
          supplier_sender_jid: string
          technical_alerts: string[]
          user_id: string
        }
        Insert: {
          battery_health?: number | null
          color?: string | null
          condition_grade?: string | null
          created_at?: string
          final_price_card_12x?: number | null
          final_price_pix: number
          id?: string
          is_sealed?: boolean
          margin_applied: number
          media_urls?: string[]
          model: string
          raw_text?: string | null
          sold_detected_at?: string | null
          sold_reason?: string | null
          source_group_jid: string
          source_group_name?: string | null
          status?: string
          storage: string
          supplier_cost: number
          supplier_message_id: string
          supplier_name?: string | null
          supplier_sender_jid: string
          technical_alerts?: string[]
          user_id: string
        }
        Update: {
          battery_health?: number | null
          color?: string | null
          condition_grade?: string | null
          created_at?: string
          final_price_card_12x?: number | null
          final_price_pix?: number
          id?: string
          is_sealed?: boolean
          margin_applied?: number
          media_urls?: string[]
          model?: string
          raw_text?: string | null
          sold_detected_at?: string | null
          sold_reason?: string | null
          source_group_jid?: string
          source_group_name?: string | null
          status?: string
          storage?: string
          supplier_cost?: number
          supplier_message_id?: string
          supplier_name?: string | null
          supplier_sender_jid?: string
          technical_alerts?: string[]
          user_id?: string
        }
        Relationships: []
      }
      dispatch_queue: {
        Row: {
          attempts: number
          created_at: string
          device_id: string
          error_message: string | null
          id: string
          media_url: string | null
          payload_caption: string
          scheduled_for: string
          status: string
          target_group_jid: string
          target_group_name: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          device_id: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          payload_caption: string
          scheduled_for: string
          status?: string
          target_group_jid: string
          target_group_name?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          device_id?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          payload_caption?: string
          scheduled_for?: string
          status?: string
          target_group_jid?: string
          target_group_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_queue_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatched_posts: {
        Row: {
          device_id: string
          id: string
          sent_at: string
          sent_message_id: string
          status: string
          target_group_jid: string
          target_group_name: string | null
          user_id: string
        }
        Insert: {
          device_id: string
          id?: string
          sent_at?: string
          sent_message_id: string
          status?: string
          target_group_jid: string
          target_group_name?: string | null
          user_id: string
        }
        Update: {
          device_id?: string
          id?: string
          sent_at?: string
          sent_message_id?: string
          status?: string
          target_group_jid?: string
          target_group_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatched_posts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          device_id: string | null
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          device_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          device_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_settings: {
        Row: {
          category_name: string
          fixed_margin: number
          id: string
          is_active: boolean
          round_to_90: boolean
          user_id: string
        }
        Insert: {
          category_name: string
          fixed_margin?: number
          id?: string
          is_active?: boolean
          round_to_90?: boolean
          user_id: string
        }
        Update: {
          category_name?: string
          fixed_margin?: number
          id?: string
          is_active?: boolean
          round_to_90?: boolean
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          cost: number
          created_at: string
          description: string
          device_id: string | null
          id: string
          lead_id: string | null
          profit: number
          sale_price: number
          user_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          description: string
          device_id?: string | null
          id?: string
          lead_id?: string | null
          profit: number
          sale_price: number
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          device_id?: string | null
          id?: string
          lead_id?: string | null
          profit?: number
          sale_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          group_jid: string
          group_type: string
          id: string
          instance_id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_jid: string
          group_type: string
          id?: string
          instance_id: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_jid?: string
          group_type?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          phone_number: string | null
          profile_name: string | null
          profile_pic_url: string | null
          qr_code_base64: string | null
          role: string
          session_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          phone_number?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          qr_code_base64?: string | null
          role: string
          session_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          phone_number?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          qr_code_base64?: string | null
          role?: string
          session_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
