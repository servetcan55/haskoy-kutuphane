'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from './supabase';
import { useStaffAuth } from './useStaffAuth';

export function useRouteGuard(requiredPermission = null) {
  const { user, loading: authLoading } = useStaffAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [allowedRoutes, setAllowedRoutes] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const verifyAccess = async () => {
      if (authLoading) return;

      if (!user) {
        if (active) {
          setAuthorized(false);
          setChecking(false);
        }
        return;
      }

      if (user.role === 'admin') {
        if (active) {
          setAllowedRoutes(null);
          setPermissions({
            can_add_book: true,
            can_edit_book: true,
            can_delete_book: true,
            can_manage_students: true,
            can_manage_duties: true,
            can_manage_users: true,
          });
          setAuthorized(true);
          setChecking(false);
        }
        return;
      }

      const slug = user.role === 'librarian' ? 'teacher_librarian' : user.role;
      const { data } = await supabase
        .from('user_groups')
        .select('allowed_routes, permissions')
        .eq('slug', slug)
        .maybeSingle();

      if (!active) return;

      const routes = Array.isArray(data?.allowed_routes) ? data.allowed_routes : [];
      const perms = data?.permissions || {};
      const routeAllowed = routes.includes(pathname);
      const permAllowed = requiredPermission ? Boolean(perms[requiredPermission]) : true;

      setAllowedRoutes(routes);
      setPermissions(perms);
      setAuthorized(routeAllowed && permAllowed);
      setChecking(false);

      if (!routeAllowed) {
        const fallback = routes.includes('/dashboard')
          ? '/dashboard'
          : routes[0] || '/odunc-ver';
        if (fallback && fallback !== pathname) {
          router.replace(fallback);
        }
      }
    };

    verifyAccess();
    return () => {
      active = false;
    };
  }, [user, authLoading, pathname, requiredPermission, router]);

  return {
    user,
    loading: authLoading || checking,
    authorized,
    allowedRoutes,
    permissions,
  };
}