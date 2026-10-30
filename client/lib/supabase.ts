import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      user_chefs: {
        Row: {
          id: string;
          cin: string;
          first_name: string;
          last_name: string;
          date_of_birth: string | null;
          can: string;
          phone: string;
          role: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          cin: string;
          first_name: string;
          last_name: string;
          date_of_birth?: string | null;
          can: string;
          phone: string;
          role: string;
          password_hash: string;
        };
      };
      member_profiles: {
        Row: {
          id: string;
          generated_id: string | null;
          first_name: string | null;
          last_name: string | null;
          birth_date: string | null;
          age: number | null;
          gender: string | null;
          patrol_name: string | null;
          role_name: string | null;
          is_high_patrol: boolean | null;
          user_phone: string | null;
          guardian_first_name: string | null;
          guardian_last_name: string | null;
          guardian_relationship: string | null;
          guardian_cin: string | null;
          father_phone: string | null;
          mother_phone: string | null;
          home_phone: string | null;
          additional_info: string | null;
          pdf_url: string | null;
          qr_code_url: string | null;
          documents_generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reports: {
        Row: {
          id: string;
          title: string | null;
          location: string | null;
          time: string | null;
          objective: string | null;
          participants_boys: number | null;
          participants_girls: number | null;
          leaders_count: number | null;
          responsible: string | null;
          category: string | null;
          beneficiary: string | null;
          description_original: string | null;
          description_reformulated: string | null;
          evaluation_positive: string | null;
          evaluation_negative: string | null;
          recommendations: string | null;
          pdf_url: string | null;
          created_at: string;
          unit_logo: string | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          title: string | null;
          date_time: string | null;
          location: string | null;
          target_audience: string | null;
          objective: string | null;
          methodology_original: string | null;
          methodology_reformulated: string | null;
          pdf_url: string | null;
          created_at: string;
          methodology: string | null;
          logos: string[] | null;
          unit_logo: string | null;
          participants_boys: number | null;
          participants_girls: number | null;
          leaders_count: number | null;
          evaluation_positive: string | null;
          evaluation_negative: string | null;
          recommendations: string | null;
        };
      };
      ideas: {
        Row: {
          id: string;
          title: string | null;
          description: string | null;
          budget_estimate: number | null;
          requirements: string | null;
          status: string | null;
          admin_notes: string | null;
          submitted_at: string | null;
          updated_at: string | null;
        };
      };
      daily_camp_reports: {
        Row: {
          id: string;
          report_date: string | null;
          patrol_id: number | null;
          morning_program_rating: string | null;
          evening_program_rating: string | null;
          night_program_rating: string | null;
          nutrition_rating: string | null;
          relationships_rating: string | null;
          general_notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      patrols: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
