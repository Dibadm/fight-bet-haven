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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      bets: {
        Row: {
          fight_id: string
          id: string
          idempotency_key: string | null
          market_id: string
          odds_snapshot: number
          payout_amount: number
          placed_at: string
          potential_payout: number
          selection_id: string
          settled_at: string | null
          settlement_id: string | null
          stake: number
          status: Database["public"]["Enums"]["bet_status"]
          user_id: string
        }
        Insert: {
          fight_id: string
          id?: string
          idempotency_key?: string | null
          market_id: string
          odds_snapshot: number
          payout_amount?: number
          placed_at?: string
          potential_payout: number
          selection_id: string
          settled_at?: string | null
          settlement_id?: string | null
          stake: number
          status?: Database["public"]["Enums"]["bet_status"]
          user_id: string
        }
        Update: {
          fight_id?: string
          id?: string
          idempotency_key?: string | null
          market_id?: string
          odds_snapshot?: number
          payout_amount?: number
          placed_at?: string
          potential_payout?: number
          selection_id?: string
          settled_at?: string | null
          settlement_id?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["bet_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: false
            referencedRelation: "fights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sms_hash: string
          sms_text: string
          status: Database["public"]["Enums"]["deposit_status"]
          submitted_at: string
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sms_hash: string
          sms_text: string
          status?: Database["public"]["Enums"]["deposit_status"]
          submitted_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sms_hash?: string
          sms_text?: string
          status?: Database["public"]["Enums"]["deposit_status"]
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
          poster_url: string | null
          promotion: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
          poster_url?: string | null
          promotion?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          poster_url?: string | null
          promotion?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      fight_results: {
        Row: {
          confirmed_at: string
          ending_round: number | null
          ending_time: string | null
          entered_by: string | null
          fight_id: string
          method: Database["public"]["Enums"]["victory_method"]
          notes: string | null
          outcome: Database["public"]["Enums"]["fight_outcome"]
        }
        Insert: {
          confirmed_at?: string
          ending_round?: number | null
          ending_time?: string | null
          entered_by?: string | null
          fight_id: string
          method?: Database["public"]["Enums"]["victory_method"]
          notes?: string | null
          outcome: Database["public"]["Enums"]["fight_outcome"]
        }
        Update: {
          confirmed_at?: string
          ending_round?: number | null
          ending_time?: string | null
          entered_by?: string | null
          fight_id?: string
          method?: Database["public"]["Enums"]["victory_method"]
          notes?: string | null
          outcome?: Database["public"]["Enums"]["fight_outcome"]
        }
        Relationships: [
          {
            foreignKeyName: "fight_results_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: true
            referencedRelation: "fights"
            referencedColumns: ["id"]
          },
        ]
      }
      fighters: {
        Row: {
          created_at: string
          full_name: string
          id: string
          nationality: string | null
          nickname: string | null
          photo_url: string | null
          record_d: number
          record_l: number
          record_w: number
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          nationality?: string | null
          nickname?: string | null
          photo_url?: string | null
          record_d?: number
          record_l?: number
          record_w?: number
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          nationality?: string | null
          nickname?: string | null
          photo_url?: string | null
          record_d?: number
          record_l?: number
          record_w?: number
        }
        Relationships: []
      }
      fights: {
        Row: {
          bout_order: number
          created_at: string
          event_id: string
          fighter_a_id: string
          fighter_b_id: string
          id: string
          is_main_event: boolean
          result_notes: string | null
          scheduled_rounds: number
          settled_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["fight_status"]
          updated_at: string
          weight_class_id: string | null
        }
        Insert: {
          bout_order?: number
          created_at?: string
          event_id: string
          fighter_a_id: string
          fighter_b_id: string
          id?: string
          is_main_event?: boolean
          result_notes?: string | null
          scheduled_rounds?: number
          settled_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["fight_status"]
          updated_at?: string
          weight_class_id?: string | null
        }
        Update: {
          bout_order?: number
          created_at?: string
          event_id?: string
          fighter_a_id?: string
          fighter_b_id?: string
          id?: string
          is_main_event?: boolean
          result_notes?: string | null
          scheduled_rounds?: number
          settled_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["fight_status"]
          updated_at?: string
          weight_class_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fights_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fights_fighter_a_id_fkey"
            columns: ["fighter_a_id"]
            isOneToOne: false
            referencedRelation: "fighters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fights_fighter_b_id_fkey"
            columns: ["fighter_b_id"]
            isOneToOne: false
            referencedRelation: "fighters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fights_weight_class_id_fkey"
            columns: ["weight_class_id"]
            isOneToOne: false
            referencedRelation: "weight_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      market_types: {
        Row: {
          code: string
          description: string | null
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          closes_at: string | null
          created_at: string
          fight_id: string
          id: string
          market_type_code: string
          name: string
          status: Database["public"]["Enums"]["market_status"]
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          fight_id: string
          id?: string
          market_type_code: string
          name: string
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          fight_id?: string
          id?: string
          market_type_code?: string
          name?: string
          status?: Database["public"]["Enums"]["market_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: false
            referencedRelation: "fights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_market_type_code_fkey"
            columns: ["market_type_code"]
            isOneToOne: false
            referencedRelation: "market_types"
            referencedColumns: ["code"]
          },
        ]
      }
      odds_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_odds: number
          old_odds: number | null
          selection_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_odds: number
          old_odds?: number | null
          selection_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_odds?: number
          old_odds?: number | null
          selection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odds_history_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "selections"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          commission_rate: number
          demo_mode: boolean
          id: boolean
          max_payout_per_bet: number
          max_stake: number
          max_withdrawal: number
          min_stake: number
          min_withdrawal: number
          telebirr_instructions: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          demo_mode?: boolean
          id?: boolean
          max_payout_per_bet?: number
          max_stake?: number
          max_withdrawal?: number
          min_stake?: number
          min_withdrawal?: number
          telebirr_instructions?: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          demo_mode?: boolean
          id?: boolean
          max_payout_per_bet?: number
          max_stake?: number
          max_withdrawal?: number
          min_stake?: number
          min_withdrawal?: number
          telebirr_instructions?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          telegram_id: number | null
          telegram_username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          telegram_id?: number | null
          telegram_username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          telegram_id?: number | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      selections: {
        Row: {
          created_at: string
          id: string
          label: string
          market_id: string
          odds: number
          outcome_spec: Json
          sort_order: number
          status: Database["public"]["Enums"]["selection_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          market_id: string
          odds: number
          outcome_spec?: Json
          sort_order?: number
          status?: Database["public"]["Enums"]["selection_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          market_id?: string
          odds?: number
          outcome_spec?: Json
          sort_order?: number
          status?: Database["public"]["Enums"]["selection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selections_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          fight_id: string
          id: string
          performed_by: string | null
          totals: Json
        }
        Insert: {
          created_at?: string
          fight_id: string
          id?: string
          performed_by?: string | null
          totals?: Json
        }
        Update: {
          created_at?: string
          fight_id?: string
          id?: string
          performed_by?: string | null
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settlements_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: true
            referencedRelation: "fights"
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
          role: Database["public"]["Enums"]["app_role"]
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          held_after: number
          id: string
          idempotency_key: string | null
          notes: string | null
          ref_id: string | null
          ref_type: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          held_after: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          ref_id?: string | null
          ref_type?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          held_after?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          ref_id?: string | null
          ref_type?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          held_balance: number
          total_deposited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          held_balance?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          held_balance?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_classes: {
        Row: {
          created_at: string
          id: string
          limit_kg: number | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_kg?: number | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_kg?: number | null
          name?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          id: string
          paid_at: string | null
          payout_details: Json
          payout_method: string
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          paid_at?: string | null
          payout_details?: Json
          payout_method?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          paid_at?: string | null
          payout_details?: Json
          payout_method?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
      bet_status: "open" | "won" | "lost" | "void" | "cancelled" | "refunded"
      deposit_status: "pending" | "approved" | "rejected"
      event_status: "draft" | "published" | "cancelled"
      fight_outcome:
        | "fighter_a"
        | "fighter_b"
        | "draw"
        | "no_contest"
        | "cancelled"
      fight_status:
        | "draft"
        | "upcoming"
        | "open"
        | "suspended"
        | "live"
        | "result_pending"
        | "settled"
        | "cancelled"
        | "postponed"
      market_status:
        | "draft"
        | "open"
        | "suspended"
        | "closed"
        | "void"
        | "settled"
      selection_status: "active" | "suspended" | "void" | "won" | "lost"
      txn_type:
        | "deposit_pending"
        | "deposit_approved"
        | "deposit_rejected"
        | "bet_stake_held"
        | "bet_stake_returned"
        | "bet_winnings_paid"
        | "withdrawal_requested"
        | "withdrawal_approved"
        | "withdrawal_rejected"
        | "withdrawal_paid"
        | "admin_adjustment"
      victory_method:
        | "ko_tko"
        | "submission"
        | "decision"
        | "dq"
        | "draw"
        | "no_contest"
        | "na"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
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
      app_role: ["user", "admin", "super_admin"],
      bet_status: ["open", "won", "lost", "void", "cancelled", "refunded"],
      deposit_status: ["pending", "approved", "rejected"],
      event_status: ["draft", "published", "cancelled"],
      fight_outcome: [
        "fighter_a",
        "fighter_b",
        "draw",
        "no_contest",
        "cancelled",
      ],
      fight_status: [
        "draft",
        "upcoming",
        "open",
        "suspended",
        "live",
        "result_pending",
        "settled",
        "cancelled",
        "postponed",
      ],
      market_status: [
        "draft",
        "open",
        "suspended",
        "closed",
        "void",
        "settled",
      ],
      selection_status: ["active", "suspended", "void", "won", "lost"],
      txn_type: [
        "deposit_pending",
        "deposit_approved",
        "deposit_rejected",
        "bet_stake_held",
        "bet_stake_returned",
        "bet_winnings_paid",
        "withdrawal_requested",
        "withdrawal_approved",
        "withdrawal_rejected",
        "withdrawal_paid",
        "admin_adjustment",
      ],
      victory_method: [
        "ko_tko",
        "submission",
        "decision",
        "dq",
        "draw",
        "no_contest",
        "na",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
