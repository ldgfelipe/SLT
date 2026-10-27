'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppUser } from '@/types/database';

const AUTH_COOKIE = 'slt_session';

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionVal = cookieStore.get(AUTH_COOKIE)?.value;
    if (!sessionVal) return null;

    const sessionData = JSON.parse(sessionVal);
    if (!sessionData.id) return null;

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, role, client_id, created_at')
      .eq('id', sessionData.id)
      .maybeSingle();

    if (!user) return null;

    return user as AppUser;
  } catch (err) {
    console.error('[getCurrentUser] error:', err);
    return null;
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const supabase = getSupabaseAdmin();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Buscar usuario
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    // 2. Verificar contraseña
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Credenciales inválidas' };
    }

    // 3. Crear sesión en cookie segura
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, JSON.stringify({ id: user.id, role: user.role }), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      httpOnly: true,
      sameSite: 'lax',
    });

    // 4. Si el usuario está asignado a un cliente específico, fijar su cliente activo
    if (user.role === 'client_admin' && user.client_id) {
      cookieStore.set('slt_active_client_id', user.client_id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error durante inicio de sesión' };
  }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect('/login');
}

export async function createUserAccount(userData: {
  name: string;
  email: string;
  password: string;
  role: 'root' | 'client_admin';
  client_id?: string | null;
}) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'root') {
      return { success: false, error: 'Solo el administrador Root puede crear usuarios.' };
    }

    const supabase = getSupabaseAdmin();
    const cleanEmail = userData.email.trim().toLowerCase();
    const passwordHash = hashPassword(userData.password);

    const { data, error } = await supabase
      .from('users')
      .insert({
        name: userData.name,
        email: cleanEmail,
        password_hash: passwordHash,
        role: userData.role,
        client_id: userData.role === 'client_admin' ? userData.client_id : null,
      })
      .select('id, name, email, role, client_id, created_at')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear usuario' };
  }
}

export async function deleteUserAccount(userId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'root') {
      return { success: false, error: 'Solo el administrador Root puede eliminar usuarios.' };
    }

    if (currentUser.id === userId) {
      return { success: false, error: 'No puedes eliminar tu propia cuenta.' };
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('users').delete().eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar usuario' };
  }
}
