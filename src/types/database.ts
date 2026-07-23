export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      events: {
        Row: {
          app_version: string;
          event_name: string;
          id: string;
          occurred_at: string;
          platform: string;
          properties: Json;
          user_id: string;
        };
        Insert: {
          app_version: string;
          event_name: string;
          id?: string;
          occurred_at?: string;
          platform: string;
          properties?: Json;
          user_id: string;
        };
        Update: {
          app_version?: string;
          event_name?: string;
          id?: string;
          occurred_at?: string;
          platform?: string;
          properties?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
