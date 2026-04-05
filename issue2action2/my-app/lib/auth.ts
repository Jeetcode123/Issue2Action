interface AuthData {
  token: string | null;
  userId: string | null;
}

export function saveAuth(token: string, userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('i2a_token', token);
    localStorage.setItem('i2a_user_id', userId);
  }
}

export function getAuth(): AuthData {
  if (typeof window === 'undefined') {
    return { token: null, userId: null };
  }
  return {
    token: localStorage.getItem('i2a_token'),
    userId: localStorage.getItem('i2a_user_id'),
  };
}

export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('i2a_token');
    localStorage.removeItem('i2a_user_id');
  }
}

export function isLoggedIn(): boolean {
  return !!getAuth().token;
}
