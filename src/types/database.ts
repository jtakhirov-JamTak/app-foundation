export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
    Views: {
      [_ in never]: never;
    };
    Functions: {
      analytics_event_valid: {
        Args: { p_event_name: string; p_properties: Json };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
