/** Role helper kept after site assignment was removed. */
export function isAdmin(session) {
  return (session?.role || '').toLowerCase() === 'admin';
}

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}
