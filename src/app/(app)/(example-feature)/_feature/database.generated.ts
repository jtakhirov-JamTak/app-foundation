// EXAMPLE-ONLY GENERATED DATABASE TYPES.
// Deleted with the example feature folder.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
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
    Views: { [_ in never]: never };
    Functions: {
      create_example_record: {
        Args: {
          p_idempotency_key: string;
          p_title: string;
        };
        Returns: {
          archived_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          title: string;
          updated_at: string;
          user_id: string;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
