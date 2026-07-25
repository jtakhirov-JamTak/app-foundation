// OPTIONAL FEATURE GENERATED DATABASE TYPES.
// Deleted with the feature folder.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      example_records: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_example_record: {
        Args: { p_idempotency_key: string; p_title: string };
        Returns: {
          archived_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          title: string;
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "example_records";
          isOneToOne: false;
          isSetofReturn: true;
        };
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
