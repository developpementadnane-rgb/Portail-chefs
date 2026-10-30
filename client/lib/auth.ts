import { supabase } from './supabase';

export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function getChefProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_chefs')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting chef profile:', error);
    return null;
  }
}

export async function logout() {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Error logging out:', error);
  }
}

export function isUserLoggedIn(): boolean {
  const user = localStorage.getItem('user');
  return !!user;
}
