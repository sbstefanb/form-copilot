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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      failure_reports: {
        Row: {
          analizu_izvrsio: string | null
          broj_izvrsilaca: number | null
          created_at: string
          datum: string
          evidencioni_broj: string
          id: string
          imena_angazovanih: Json
          ispunio: string | null
          korektivna_mera: string | null
          korektivnu_meru_predlozio: string | null
          nacin_otklanjanja: string | null
          napomena: string | null
          ostale_usluge: string | null
          pogon: string | null
          posledice: string | null
          sklop_podsklop: string | null
          status: Database["public"]["Enums"]["report_status"]
          tehnicka_analiza: string | null
          tehnicki_sistem: string | null
          tehnoloska_linija: string | null
          ugradjeni_delovi: Json
          updated_at: string
          user_id: string
          uzrok: string | null
          vreme_otklanjanja: string | null
          vreme_prijave: string | null
          vrsta_kvara: string | null
          vrsta_kvara_ostalo: string | null
        }
        Insert: {
          analizu_izvrsio?: string | null
          broj_izvrsilaca?: number | null
          created_at?: string
          datum?: string
          evidencioni_broj: string
          id?: string
          imena_angazovanih?: Json
          ispunio?: string | null
          korektivna_mera?: string | null
          korektivnu_meru_predlozio?: string | null
          nacin_otklanjanja?: string | null
          napomena?: string | null
          ostale_usluge?: string | null
          pogon?: string | null
          posledice?: string | null
          sklop_podsklop?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          tehnicka_analiza?: string | null
          tehnicki_sistem?: string | null
          tehnoloska_linija?: string | null
          ugradjeni_delovi?: Json
          updated_at?: string
          user_id: string
          uzrok?: string | null
          vreme_otklanjanja?: string | null
          vreme_prijave?: string | null
          vrsta_kvara?: string | null
          vrsta_kvara_ostalo?: string | null
        }
        Update: {
          analizu_izvrsio?: string | null
          broj_izvrsilaca?: number | null
          created_at?: string
          datum?: string
          evidencioni_broj?: string
          id?: string
          imena_angazovanih?: Json
          ispunio?: string | null
          korektivna_mera?: string | null
          korektivnu_meru_predlozio?: string | null
          nacin_otklanjanja?: string | null
          napomena?: string | null
          ostale_usluge?: string | null
          pogon?: string | null
          posledice?: string | null
          sklop_podsklop?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          tehnicka_analiza?: string | null
          tehnicki_sistem?: string | null
          tehnoloska_linija?: string | null
          ugradjeni_delovi?: Json
          updated_at?: string
          user_id?: string
          uzrok?: string | null
          vreme_otklanjanja?: string | null
          vreme_prijave?: string | null
          vrsta_kvara?: string | null
          vrsta_kvara_ostalo?: string | null
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
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_counters: {
        Row: {
          last_seq: number
          year: number
        }
        Insert: {
          last_seq?: number
          year: number
        }
        Update: {
          last_seq?: number
          year?: number
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
      report_status: "u_izradi" | "ceka_analizu" | "zavrsen"
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
      report_status: ["u_izradi", "ceka_analizu", "zavrsen"],
    },
  },
} as const
