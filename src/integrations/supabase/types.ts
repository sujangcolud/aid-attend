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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_summaries: {
        Row: {
          created_at: string
          generated_on: string
          id: string
          student_id: string
          summary_text: string
          summary_type: string
        }
        Insert: {
          created_at?: string
          generated_on?: string
          id?: string
          student_id: string
          summary_text: string
          summary_type: string
        }
        Update: {
          created_at?: string
          generated_on?: string
          id?: string
          student_id?: string
          summary_text?: string
          summary_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          status: string
          student_id: string
          time_in: string | null
          time_out: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          status: string
          student_id: string
          time_in?: string | null
          time_out?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          status?: string
          student_id?: string
          time_in?: string | null
          time_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          address: string | null
          center_name: string
          contact_number: string | null
          created_at: string
          id: string
        }
        Insert: {
          address?: string | null
          center_name: string
          contact_number?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          address?: string | null
          center_name?: string
          contact_number?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chapter_teachings: {
        Row: {
          chapter_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          students_present: Json | null
        }
        Insert: {
          chapter_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          students_present?: Json | null
        }
        Update: {
          chapter_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          students_present?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_teachings_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          center_id: string | null
          chapter_name: string
          created_at: string
          date_taught: string
          id: string
          notes: string | null
          subject: string
        }
        Insert: {
          center_id?: string | null
          chapter_name: string
          created_at?: string
          date_taught: string
          id?: string
          notes?: string | null
          subject: string
        }
        Update: {
          center_id?: string | null
          chapter_name?: string
          created_at?: string
          date_taught?: string
          id?: string
          notes?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters_studied: {
        Row: {
          chapter_name: string
          created_at: string
          date: string
          id: string
          notes: string | null
          student_id: string
          subject: string
        }
        Insert: {
          chapter_name: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          student_id: string
          subject: string
        }
        Update: {
          chapter_name?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          student_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_studied_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_chapters: {
        Row: {
          chapter_id: string
          completed: boolean
          created_at: string
          date_completed: string
          id: string
          student_id: string
        }
        Insert: {
          chapter_id: string
          completed?: boolean
          created_at?: string
          date_completed?: string
          id?: string
          student_id: string
        }
        Update: {
          chapter_id?: string
          completed?: boolean
          created_at?: string
          date_completed?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_chapters_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_chapters_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          center_id: string | null
          contact_number: string
          created_at: string
          grade: string
          id: string
          name: string
          parent_name: string
          school_name: string
        }
        Insert: {
          center_id?: string | null
          contact_number: string
          created_at?: string
          grade: string
          id?: string
          name: string
          parent_name: string
          school_name: string
        }
        Update: {
          center_id?: string | null
          contact_number?: string
          created_at?: string
          grade?: string
          id?: string
          name?: string
          parent_name?: string
          school_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          ai_suggested_marks: number | null
          created_at: string
          date_taken: string
          id: string
          marks_obtained: number
          notes: string | null
          student_answer: string | null
          student_id: string
          test_id: string
        }
        Insert: {
          ai_suggested_marks?: number | null
          created_at?: string
          date_taken?: string
          id?: string
          marks_obtained: number
          notes?: string | null
          student_answer?: string | null
          student_id: string
          test_id: string
        }
        Update: {
          ai_suggested_marks?: number | null
          created_at?: string
          date_taken?: string
          id?: string
          marks_obtained?: number
          notes?: string | null
          student_answer?: string | null
          student_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          center_id: string | null
          created_at: string
          date: string
          extracted_text: string | null
          grade: string | null
          id: string
          name: string
          subject: string
          total_marks: number
          uploaded_file_url: string | null
        }
        Insert: {
          center_id?: string | null
          created_at?: string
          date: string
          extracted_text?: string | null
          grade?: string | null
          id?: string
          name: string
          subject: string
          total_marks: number
          uploaded_file_url?: string | null
        }
        Update: {
          center_id?: string | null
          created_at?: string
          date?: string
          extracted_text?: string | null
          grade?: string | null
          id?: string
          name?: string
          subject?: string
          total_marks?: number
          uploaded_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tests_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          center_id: string | null
          created_at: string
          id: string
          is_active: boolean
          last_login: string | null
          password_hash: string
          role: Database["public"]["Enums"]["app_role"]
          username: string
        }
        Insert: {
          center_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          password_hash: string
          role?: Database["public"]["Enums"]["app_role"]
          username: string
        }
        Update: {
          center_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          password_hash?: string
          role?: Database["public"]["Enums"]["app_role"]
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "center"
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
      app_role: ["admin", "center"],
    },
  },
} as const
